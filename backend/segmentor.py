"""
SAM 3 — Promptable Concept Segmentation with text (see docs/SAM3.md).

One or more noun phrases (e.g. "clothes") segment all matching instances in the image.
Weights: download `sam3.pt` from Hugging Face (facebook/sam3) after access approval, then set SAM3_WEIGHTS or place file in CWD.
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
import threading
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from ultralytics.models.sam import SAM3SemanticPredictor

MAX_TEXT_PROMPTS = 16
DEFAULT_TEXT_PROMPTS: tuple[str, ...] = (
    "shirt", "t-shirt", "pants", "jeans", "shorts", "jacket", "coat",
    "hoodie", "sweater", "dress", "skirt", "shoes", "sneakers", "hat", "bag",
)

SAM3_WEIGHTS = os.environ.get("SAM3_WEIGHTS", "sam3.pt")
SAM3_IMG_SIZE = int(os.environ.get("SAM3_IMG_SIZE", "1024"))
# Drop detections below this score (default 60%).
MIN_CONFIDENCE = max(0.01, min(0.999, float(os.environ.get("SAM3_MIN_CONFIDENCE", "0.60"))))

_BACKEND_ROOT = Path(__file__).resolve().parent
# Each run writes to SEGMENTS_OUTPUT_DIR/<run_id>/*.png (RGBA cutouts). Set SAVE_SEGMENTS=0 to disable.
SEGMENTS_OUTPUT_DIR = Path(
    os.environ.get("SEGMENTS_OUTPUT_DIR", str(_BACKEND_ROOT / "segments")),
).expanduser()
SAVE_SEGMENTS = os.environ.get("SAVE_SEGMENTS", "1").strip().lower() not in ("0", "false", "no")

_predictor: SAM3SemanticPredictor | None = None
_predictor_lock = threading.Lock()


def parse_prompts_param(raw: str | None) -> list[str] | None:
    """
    Split user text into SAM 3 noun phrases (comma / newline).
    Returns None → use DEFAULT_TEXT_PROMPTS.
    """
    if not raw or not str(raw).strip():
        return None
    parts = re.split(r"[\n,]+", raw)
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        s = p.strip()
        if not s or len(s) > 96:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
        if len(out) >= MAX_TEXT_PROMPTS:
            break
    return out if out else None


def _get_predictor(conf: float) -> SAM3SemanticPredictor:
    """Lazy-load SAM3; conf is applied via fresh predictor when conf changes — keep one instance, use args update."""
    global _predictor
    if _predictor is None:
        if not os.path.isfile(SAM3_WEIGHTS):
            raise RuntimeError(
                f"SAM 3 weights not found at {SAM3_WEIGHTS!r}. "
                "Request access at https://huggingface.co/facebook/sam3 then download sam3.pt "
                "or set SAM3_WEIGHTS to the full path (see docs/SAM3.md)."
            )
        _predictor = SAM3SemanticPredictor(
            overrides=dict(
                conf=conf,
                iou=0.5,
                task="segment",
                mode="predict",
                model=SAM3_WEIGHTS,
                imgsz=SAM3_IMG_SIZE,
                half=False,
                save=False,
                verbose=False,
            )
        )
    else:
        _predictor.args.conf = conf
    return _predictor


def _mask_tensor_to_png(mask: Any, width: int, height: int) -> bytes | None:
    """Binary mask (tensor or array) → PNG grayscale bytes, size (width, height)."""
    if mask is None:
        return None
    if hasattr(mask, "float"):
        m = mask.float().cpu().numpy()
    else:
        m = np.asarray(mask, dtype=np.float32)
    if m.ndim > 2:
        m = m.squeeze()
    m = (m > 0.5).astype(np.uint8) * 255
    if m.shape[:2] != (height, width):
        im = Image.fromarray(m, mode="L")
        im = im.resize((width, height), Image.Resampling.NEAREST)
        m = np.array(im)
    buf = io.BytesIO()
    Image.fromarray(m, mode="L").save(buf, format="PNG")
    return buf.getvalue()


def _safe_segment_filename(category: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", str(category).strip(), flags=re.UNICODE)
    return (s[:48] or "segment").strip("_")


def _write_rgba_cutout(rgb: Image.Image, mask_png_bytes: bytes, path: Path) -> None:
    """Save masked region as PNG with alpha (outside mask transparent)."""
    mask = Image.open(io.BytesIO(mask_png_bytes)).convert("L")
    if mask.size != rgb.size:
        mask = mask.resize(rgb.size, Image.Resampling.NEAREST)
    r, g, b = rgb.split()
    rgba = Image.merge("RGBA", (r, g, b, mask))
    path.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(path, format="PNG")


def _persist_segment_files(rgb: Image.Image, items: list[dict[str, Any]]) -> str | None:
    """
    Write one RGBA PNG per item. Mutates items with key segment_file (filename only).
    Returns absolute path to the run directory, or None if disabled / empty.
    """
    if not SAVE_SEGMENTS or not items:
        return None
    run_id = f"{datetime.now():%Y%m%d-%H%M%S}_{uuid.uuid4().hex[:8]}"
    run_dir = SEGMENTS_OUTPUT_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    for idx, it in enumerate(items):
        key = "mask_png"
        if key not in it:
            continue
        mask_bytes = base64.b64decode(it[key])
        fname = f"{idx:03d}_{_safe_segment_filename(it.get('category', 'object'))}.png"
        out_path = run_dir / fname
        _write_rgba_cutout(rgb, mask_bytes, out_path)
        it["segment_file"] = fname
    return str(run_dir.resolve())


SEGMENTS_MANIFEST_NAME = "segments.json"


def _items_for_manifest(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Strip bulky mask_png; keep stable index ↔ PNG mapping."""
    rows: list[dict[str, Any]] = []
    for i, it in enumerate(items):
        row: dict[str, Any] = {
            "index": i,
            "segment_file": it.get("segment_file"),
            "category": it.get("category"),
            "bbox": it.get("bbox"),
            "confidence": it.get("confidence"),
        }
        if "clothing" in it:
            row["clothing"] = it["clothing"]
        rows.append(row)
    return rows


def _write_segments_manifest(
    run_dir: Path,
    *,
    width: int,
    height: int,
    prompts: list[str],
    min_confidence: float,
    gemini_model: str | None,
    gemini_annotation_error: str | None,
    items: list[dict[str, Any]],
) -> None:
    doc: dict[str, Any] = {
        "schema": "styleme-segments-v1",
        "manifest": SEGMENTS_MANIFEST_NAME,
        "image": {"width": width, "height": height},
        "prompts": prompts,
        "min_confidence": min_confidence,
        "gemini_model": gemini_model,
        "gemini_annotation_error": gemini_annotation_error,
        "items": _items_for_manifest(items),
    }
    path = run_dir / SEGMENTS_MANIFEST_NAME
    path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def segment_image(
    image_bytes: bytes,
    mime_type: str | None = None,
    *,
    prompts: list[str] | None = None,
    conf: float = 0.60,
    annotate: bool = False,
    write_segment_files: bool = True,
) -> dict[str, Any]:
    """
    Run SAM 3 text concept segmentation. Each phrase can yield multiple instances (e.g. all garments for "clothes").

    prompts=None → DEFAULT_TEXT_PROMPTS ("clothes",).
    Results with confidence below MIN_CONFIDENCE (default 0.60) are omitted.
    annotate=True runs Gemini on segment crops (requires GEMINI_API_KEY); see gemini_annotator.py.
    write_segment_files=False skips PNG exports and segments.json (for callers that only need in-memory masks).
    """
    _ = mime_type
    text_prompts: list[str] = list(prompts) if prompts else list(DEFAULT_TEXT_PROMPTS)
    # Model threshold cannot be lower than the output floor (avoids wasted low-conf proposals).
    model_conf = max(float(conf), MIN_CONFIDENCE)

    im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = im.size
    rgb = np.asarray(im, dtype=np.uint8)
    im_bgr = rgb[:, :, ::-1].copy()

    with _predictor_lock:
        predictor = _get_predictor(conf=model_conf)
        results = predictor(source=im_bgr, text=text_prompts)

    empty_base = {
        "width": w,
        "height": h,
        "detector": "sam3-text",
        "output": "mask",
        "min_confidence": MIN_CONFIDENCE,
        "prompts": text_prompts,
        "segments_dir": None,
        "segment_manifest": None,
        "gemini_model": None,
        "gemini_annotation_error": None,
        "items": [],
    }

    if not results:
        return {**empty_base}

    r0 = results[0]
    items_out: list[dict[str, Any]] = []

    if r0.masks is None or len(r0.masks) == 0:
        return {**empty_base}

    n_m = len(r0.masks)
    boxes = r0.boxes

    for i in range(n_m):
        mask_data = r0.masks.data[i]
        png = _mask_tensor_to_png(mask_data, w, h)
        if not png:
            continue

        if boxes is not None and i < len(boxes):
            xyxy = boxes.xyxy[i].detach().cpu().numpy().ravel().tolist()
            score = float(boxes.conf[i].detach().cpu())
            cid = int(boxes.cls[i].detach().cpu())
        else:
            xyxy = [0, 0, w, h]
            score = 1.0
            cid = 0

        try:
            category = r0.names[cid]
        except (KeyError, IndexError, TypeError):
            category = text_prompts[cid] if 0 <= cid < len(text_prompts) else (text_prompts[0] if text_prompts else "object")

        if score < MIN_CONFIDENCE:
            continue

        items_out.append(
            {
                "category": str(category),
                "bbox": [int(round(x)) for x in xyxy[:4]],
                "confidence": round(score, 4),
                "mask_png": base64.b64encode(png).decode("ascii"),
            }
        )

    return _finish_segment_response(
        im,
        items_out,
        w=w,
        h=h,
        text_prompts=text_prompts,
        annotate=annotate,
        write_segment_files=write_segment_files,
    )


def _finish_segment_response(
    im: Image.Image,
    items_out: list[dict[str, Any]],
    *,
    w: int,
    h: int,
    text_prompts: list[str],
    annotate: bool,
    write_segment_files: bool,
    extra_response_keys: dict[str, Any] | None = None,
    gemini_prefill: tuple[str | None, str | None] | None = None,
) -> dict[str, Any]:
    segments_dir: str | None = _persist_segment_files(im, items_out) if write_segment_files else None

    gemini_model: str | None = None
    gemini_annotation_error: str | None = None
    if gemini_prefill is not None:
        gemini_model, gemini_annotation_error = gemini_prefill
    elif annotate and items_out:
        from gemini_annotator import run_clothing_annotation

        gmeta = run_clothing_annotation(im, items_out)
        gemini_model = gmeta.get("gemini_model")
        gemini_annotation_error = gmeta.get("gemini_annotation_error")

    segment_manifest: str | None = None
    if segments_dir:
        _write_segments_manifest(
            Path(segments_dir),
            width=w,
            height=h,
            prompts=text_prompts,
            min_confidence=MIN_CONFIDENCE,
            gemini_model=gemini_model,
            gemini_annotation_error=gemini_annotation_error,
            items=items_out,
        )
        segment_manifest = SEGMENTS_MANIFEST_NAME

    out: dict[str, Any] = {
        "width": w,
        "height": h,
        "detector": "sam3-text",
        "output": "mask",
        "min_confidence": MIN_CONFIDENCE,
        "prompts": text_prompts,
        "segments_dir": segments_dir,
        "segment_manifest": segment_manifest,
        "gemini_model": gemini_model,
        "gemini_annotation_error": gemini_annotation_error,
        "items": items_out,
    }
    if extra_response_keys:
        out.update(extra_response_keys)
    return out


def run_sam_clothes_only(
    image_bytes: bytes,
    mime_type: str | None = None,
    *,
    prompts: list[str] | None = None,
    conf: float = 0.60,
) -> tuple[Image.Image, int, int, list[str], list[dict[str, Any]]]:
    """
    SAM 3 clothes segmentation only: no disk, no Gemini.

    Returns (RGB PIL image, width, height, text_prompts, items with mask_png).
    """
    _ = mime_type
    text_prompts: list[str] = list(prompts) if prompts else list(DEFAULT_TEXT_PROMPTS)
    model_conf = max(float(conf), MIN_CONFIDENCE)

    im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = im.size
    rgb = np.asarray(im, dtype=np.uint8)
    im_bgr = rgb[:, :, ::-1].copy()

    with _predictor_lock:
        predictor = _get_predictor(conf=model_conf)
        results = predictor(source=im_bgr, text=text_prompts)

    items_out: list[dict[str, Any]] = []
    if not results:
        return im, w, h, text_prompts, items_out

    r0 = results[0]
    if r0.masks is None or len(r0.masks) == 0:
        return im, w, h, text_prompts, items_out

    n_m = len(r0.masks)
    boxes = r0.boxes

    for i in range(n_m):
        mask_data = r0.masks.data[i]
        png = _mask_tensor_to_png(mask_data, w, h)
        if not png:
            continue

        if boxes is not None and i < len(boxes):
            xyxy = boxes.xyxy[i].detach().cpu().numpy().ravel().tolist()
            score = float(boxes.conf[i].detach().cpu())
            cid = int(boxes.cls[i].detach().cpu())
        else:
            xyxy = [0, 0, w, h]
            score = 1.0
            cid = 0

        try:
            category = r0.names[cid]
        except (KeyError, IndexError, TypeError):
            category = text_prompts[cid] if 0 <= cid < len(text_prompts) else (text_prompts[0] if text_prompts else "object")

        if score < MIN_CONFIDENCE:
            continue

        items_out.append(
            {
                "category": str(category),
                "bbox": [int(round(x)) for x in xyxy[:4]],
                "confidence": round(score, 4),
                "mask_png": base64.b64encode(png).decode("ascii"),
            }
        )

    return im, w, h, text_prompts, items_out


def segment_image_for_enrolled_user(
    user_id: str,
    image_bytes: bytes,
    mime_type: str | None = None,
    *,
    prompts: list[str] | None = None,
    conf: float = 0.60,
    annotate: bool = False,
    write_segment_files: bool = True,
) -> dict[str, Any]:
    """
    Face-grounded clothing segmentation: match enrolled user in image, keep only ``clothes`` masks
    overlapping the expanded person region. Response includes ``matcher`` and ``face_grounded`` keys.
    Raises ValueError if the user has no stored embedding (enroll first).
    """
    import identity_face as idf

    emb = idf.load_user_embedding(user_id)
    if emb is None:
        raise ValueError(
            "Enroll first: POST /api/identity/enroll with a clear face photo (JWT required).",
        )

    im, w, h, text_prompts, items = run_sam_clothes_only(
        image_bytes,
        mime_type=mime_type,
        prompts=prompts,
        conf=conf,
    )
    bgr = idf.image_bytes_to_bgr(image_bytes)
    gate = idf.find_best_face_match(bgr, emb)
    matcher = idf.matcher_to_dict(gate)
    extra: dict[str, Any] = {"matcher": matcher, "face_grounded": True}

    if not gate.matched or gate.face_bbox_xyxy is None:
        return _finish_segment_response(
            im,
            [],
            w=w,
            h=h,
            text_prompts=text_prompts,
            annotate=False,
            write_segment_files=False,
            extra_response_keys=extra,
            gemini_prefill=None,
        )

    pmask = idf.person_region_mask(h, w, gate.face_bbox_xyxy)
    filtered = idf.filter_clothing_items_by_person(items, pmask, w, h)

    gemini_prefill: tuple[str | None, str | None] | None = None
    if annotate and filtered:
        from gemini_annotator import run_clothing_annotation

        gmeta = run_clothing_annotation(im, filtered)
        gemini_prefill = (
            gmeta.get("gemini_model"),
            gmeta.get("gemini_annotation_error"),
        )

    return _finish_segment_response(
        im,
        filtered,
        w=w,
        h=h,
        text_prompts=text_prompts,
        annotate=False,
        write_segment_files=write_segment_files,
        extra_response_keys=extra,
        gemini_prefill=gemini_prefill,
    )
