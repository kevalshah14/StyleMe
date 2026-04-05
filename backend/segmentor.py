"""
SAM 3 — Promptable Concept Segmentation with text (see docs/SAM3.md).

One or more noun phrases (e.g. "clothes") segment all matching instances in the image.
Weights: download `sam3.pt` from Hugging Face (facebook/sam3) after access approval, then set SAM3_WEIGHTS or place file in CWD.
"""

from __future__ import annotations

import base64
import io
import os
import re
import threading
from typing import Any

import numpy as np
from PIL import Image
from ultralytics.models.sam import SAM3SemanticPredictor

MAX_TEXT_PROMPTS = 16
DEFAULT_TEXT_PROMPTS: tuple[str, ...] = ("clothes",)

SAM3_WEIGHTS = os.environ.get("SAM3_WEIGHTS", "sam3.pt")
SAM3_IMG_SIZE = int(os.environ.get("SAM3_IMG_SIZE", "1024"))

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


def segment_image(
    image_bytes: bytes,
    mime_type: str | None = None,
    *,
    prompts: list[str] | None = None,
    conf: float = 0.25,
) -> dict[str, Any]:
    """
    Run SAM 3 text concept segmentation. Each phrase can yield multiple instances (e.g. all garments for "clothes").

    prompts=None → DEFAULT_TEXT_PROMPTS ("clothes",).
    """
    _ = mime_type
    text_prompts: list[str] = list(prompts) if prompts else list(DEFAULT_TEXT_PROMPTS)

    im = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = im.size
    rgb = np.asarray(im, dtype=np.uint8)
    im_bgr = rgb[:, :, ::-1].copy()

    with _predictor_lock:
        predictor = _get_predictor(conf=conf)
        results = predictor(source=im_bgr, text=text_prompts)

    if not results:
        return {
            "width": w,
            "height": h,
            "detector": "sam3-text",
            "output": "mask",
            "prompts": text_prompts,
            "items": [],
        }

    r0 = results[0]
    items_out: list[dict[str, Any]] = []

    if r0.masks is None or len(r0.masks) == 0:
        return {
            "width": w,
            "height": h,
            "detector": "sam3-text",
            "output": "mask",
            "prompts": text_prompts,
            "items": [],
        }

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

        items_out.append(
            {
                "category": str(category),
                "bbox": [int(round(x)) for x in xyxy[:4]],
                "confidence": round(score, 4),
                "mask_png": base64.b64encode(png).decode("ascii"),
            }
        )

    return {
        "width": w,
        "height": h,
        "detector": "sam3-text",
        "output": "mask",
        "prompts": text_prompts,
        "items": items_out,
    }
