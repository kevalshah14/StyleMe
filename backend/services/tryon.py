"""
Apply segmented outfit pieces onto a user photo via Gemini native image generation
(Nano Banana 2: gemini-3.1-flash-image-preview).

Pipeline: SAM 3 on ``outfit`` image (writes cutouts + ``segments.json`` when
``SAVE_SEGMENTS`` is on) → optional Flash-Lite garment labels → Flash Image
model composites user + RGBA garment crops into one result.
"""

from __future__ import annotations

import base64
import io
import os
from typing import Any

from google import genai
from google.genai import types
from PIL import Image

from services.annotator import (
    GEMINI_API_KEY,
    CROP_PAD_FRAC,
    _crop_patch_bytes,
    _resize_long_edge,
    _rgba_cutout,
)

DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
GEMINI_IMAGE_MODEL = os.environ.get("GEMINI_IMAGE_MODEL", DEFAULT_IMAGE_MODEL).strip() or DEFAULT_IMAGE_MODEL
# Gemini 3.1 Flash Image allows many reference images; order is capped here (default = model max 14).
TRYON_MAX_SEGMENTS = max(1, min(14, int(os.environ.get("TRYON_MAX_SEGMENTS", "14"))))
TRYON_USER_MAX_EDGE = max(512, min(2048, int(os.environ.get("TRYON_USER_MAX_EDGE", "1536"))))


def _bbox_vertical_center(it: dict[str, Any]) -> float:
    b = it.get("bbox") or [0, 0, 0, 0]
    return (float(b[1]) + float(b[3])) / 2.0


def _order_items_for_tryon(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Top-to-bottom by bounding box so hats/shirts precede pants/shoes in the prompt order."""
    return sorted(items, key=_bbox_vertical_center)


def _garment_caption(it: dict[str, Any]) -> str:
    c = it.get("clothing") or {}
    if c.get("short_label"):
        return str(c["short_label"])
    if c.get("garment_type"):
        return str(c["garment_type"])
    return str(it.get("category", "garment"))


def _strip_items_for_response(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, it in enumerate(items):
        row: dict[str, Any] = {
            "index": i,
            "category": it.get("category"),
            "bbox": it.get("bbox"),
            "confidence": it.get("confidence"),
            "caption": _garment_caption(it),
        }
        if "clothing" in it:
            row["clothing"] = it["clothing"]
        out.append(row)
    return out


def _extract_final_image(response: Any) -> tuple[bytes | None, str | None, str | None]:
    """From GenerateContentResponse: last non-thought image bytes, mime, and any text."""
    parts = getattr(response, "parts", None) or []
    text_parts: list[str] = []
    last_data: tuple[bytes | None, str | None] = (None, None)
    for part in parts:
        if getattr(part, "thought", None):
            continue
        if part.text:
            text_parts.append(part.text)
        gimg = part.as_image()
        if gimg is not None and gimg.image_bytes:
            last_data = (gimg.image_bytes, gimg.mime_type or "image/png")
    note = "".join(text_parts).strip() or None
    return last_data[0], last_data[1], note


def apply_outfit_to_user(
    user_image_bytes: bytes,
    outfit_image_bytes: bytes,
    *,
    prompts: list[str] | None = None,
    conf: float = 0.60,
    annotate: bool = True,
) -> dict[str, Any]:
    """
    Segment ``outfit_image_bytes``, then ask Gemini Image to dress the person in ``user_image_bytes``.

    Returns JSON-serializable dict including ``generated_image_png`` (base64) when successful.
    """
    from services import segmentor

    seg: dict[str, Any] = segmentor.segment_image(
        outfit_image_bytes,
        prompts=prompts,
        conf=conf,
        annotate=annotate,
        write_segment_files=True,
    )
    items: list[dict[str, Any]] = list(seg.get("items") or [])
    outfit_summary: dict[str, Any] = {
        "width": seg.get("width"),
        "height": seg.get("height"),
        "prompts": seg.get("prompts"),
        "min_confidence": seg.get("min_confidence"),
        "segments_dir": seg.get("segments_dir"),
        "segment_manifest": seg.get("segment_manifest"),
        "gemini_model": seg.get("gemini_model"),
        "gemini_annotation_error": seg.get("gemini_annotation_error"),
        "items": _strip_items_for_response(items),
    }

    out: dict[str, Any] = {
        "outfit_summary": outfit_summary,
        "segments_detected": len(items),
        "segments_sent_to_model": 0,
        "segments_omitted": 0,
        "garments_applied": 0,
        "generated_image_mime": None,
        "generated_image_png": None,
        "gemini_image_model": None,
        "gemini_image_error": None,
        "image_model_text": None,
    }

    if not items:
        out["gemini_image_error"] = "No clothing segments found on the outfit image (try different prompts or lower threshold)."
        return out

    if not GEMINI_API_KEY:
        out["gemini_image_error"] = "GEMINI_API_KEY is not set"
        return out

    outfit_rgb = Image.open(io.BytesIO(outfit_image_bytes)).convert("RGB")
    ordered = _order_items_for_tryon(items)
    use_items = ordered[:TRYON_MAX_SEGMENTS]
    out["segments_omitted"] = max(0, len(items) - len(use_items))

    garment_pngs: list[bytes] = []
    lines: list[str] = []
    for i, it in enumerate(use_items):
        mask_b64 = it.get("mask_png")
        bbox = it.get("bbox")
        if not mask_b64 or not bbox:
            continue
        rgba = _rgba_cutout(outfit_rgb, mask_b64)
        garment_pngs.append(_crop_patch_bytes(rgba, bbox, pad_frac=CROP_PAD_FRAC))
        lines.append(f"- Garment {i + 1} (image {i + 2}): {_garment_caption(it)}")

    if not garment_pngs:
        out["gemini_image_error"] = "Could not build garment crops from segments."
        return out

    out["segments_sent_to_model"] = len(garment_pngs)
    n = len(garment_pngs)

    user_im = Image.open(io.BytesIO(user_image_bytes)).convert("RGB")
    user_im = _resize_long_edge(user_im, TRYON_USER_MAX_EDGE)

    intro = "\n".join(
        [
            "Virtual fashion try-on for a mobile app.",
            "",
            "Image 1 is the TARGET PERSON. Preserve their identity: face, hair, skin tone, body shape, pose, expression, and the background. Do not replace the person with someone else.",
            f"Images 2–{1 + n} are {n} separate isolated clothing pieces from ONE reference outfit photo (transparent pixels outside each garment).",
            f"You MUST apply ALL {n} pieces together on the target person in a single output. Do not omit, merge, or skip any listed garment — every piece should appear on the person where it belongs (e.g. top, bottom, outer layer, shoes).",
            "",
            "Requirements:",
            "- Photorealistic result, single final image.",
            "- Correct layering (e.g. outerwear over shirt, pants under top).",
            "- Match lighting and shadows to the target scene.",
            "- Natural wrinkles and hem.",
            "",
            "Garment list (same order as images 2 onward, roughly head-to-toe):",
            *lines,
        ]
    )

    contents: list[Any] = [intro, user_im]
    for buf in garment_pngs:
        contents.append(types.Part.from_bytes(data=buf, mime_type="image/png"))

    client = genai.Client(api_key=GEMINI_API_KEY)
    try:
        response = client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )
    except Exception as e:
        out["gemini_image_model"] = GEMINI_IMAGE_MODEL
        out["gemini_image_error"] = f"Gemini image request failed: {e}"
        out["garments_applied"] = len(garment_pngs)
        return out

    raw, mime, note = _extract_final_image(response)
    out["gemini_image_model"] = GEMINI_IMAGE_MODEL
    out["image_model_text"] = note
    out["garments_applied"] = len(garment_pngs)

    if not raw:
        out["gemini_image_error"] = "Model returned no image (safety block or empty response)."
        return out

    out["generated_image_mime"] = mime or "image/png"
    out["generated_image_png"] = base64.b64encode(raw).decode("ascii")
    return out
