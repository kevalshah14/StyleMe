"""
Gemini multimodal labels for each SAM segment: garment type and body region.

Uses cost-efficient `gemini-3.1-flash-lite-preview` by default (GEMINI_MODEL).
Requires GEMINI_API_KEY. Safe to import without the key — calls no-op until annotate runs.
"""

from __future__ import annotations

import base64
import io
import json
import os
from typing import Any

from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel, Field

DEFAULT_MODEL = "gemini-3.1-flash-lite-preview"
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
# Longest side of the full-frame image sent for context (smaller = cheaper).
CONTEXT_MAX_EDGE = max(256, min(2048, int(os.environ.get("GEMINI_CONTEXT_MAX_EDGE", "1024"))))
CROP_PAD_FRAC = max(0.0, min(0.25, float(os.environ.get("GEMINI_CROP_PAD_FRAC", "0.06"))))


class ClothingSegmentAnnotation(BaseModel):
    index: int = Field(
        ge=0,
        description="0-based segment index; must match the crop order (Segment 0, 1, …).",
    )
    garment_type: str = Field(
        ...,
        description='Concrete garment or accessory, e.g. "straight-leg denim jeans", "oversized hoodie".',
    )
    body_region: str = Field(
        ...,
        description='Body coverage: e.g. "lower body / legs", "upper body / torso", "feet", "full body garment".',
    )
    short_label: str = Field(
        ...,
        description="At most 6 words for a compact UI label.",
    )
    notable_details: str = Field(
        default="",
        description="Optional: color/pattern, texture, layering (outer vs inner).",
    )


class ClothingAnnotationsBatch(BaseModel):
    segments: list[ClothingSegmentAnnotation]


def _resize_long_edge(im: Image.Image, max_edge: int) -> Image.Image:
    w, h = im.size
    m = max(w, h)
    if m <= max_edge:
        return im
    scale = max_edge / m
    nw = int(round(w * scale))
    nh = int(round(h * scale))
    return im.resize((max(1, nw), max(1, nh)), Image.Resampling.LANCZOS)


def _rgba_cutout(rgb: Image.Image, mask_png_b64: str) -> Image.Image:
    mask = Image.open(io.BytesIO(base64.b64decode(mask_png_b64))).convert("L")
    if mask.size != rgb.size:
        mask = mask.resize(rgb.size, Image.Resampling.NEAREST)
    r, g, b = rgb.split()
    return Image.merge("RGBA", (r, g, b, mask))


def _crop_patch_bytes(rgba: Image.Image, bbox: list[int], *, pad_frac: float) -> bytes:
    x1, y1, x2, y2 = (int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3]))
    w, h = rgba.size
    bw, bh = max(1, x2 - x1), max(1, y2 - y1)
    pad_x = int(bw * pad_frac)
    pad_y = int(bh * pad_frac)
    cx1 = max(0, x1 - pad_x)
    cy1 = max(0, y1 - pad_y)
    cx2 = min(w, x2 + pad_x)
    cy2 = min(h, y2 + pad_y)
    if cx2 <= cx1 or cy2 <= cy1:
        cx1, cy1, cx2, cy2 = 0, 0, w, h
    crop = rgba.crop((cx1, cy1, cx2, cy2))
    buf = io.BytesIO()
    crop.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def run_clothing_annotation(rgb: Image.Image, items: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Mutates each item with key ``clothing`` (dict) when successful.

    Returns ``{ "gemini_model": str | None, "gemini_annotation_error": str | None }``.
    """
    meta: dict[str, Any] = {"gemini_model": None, "gemini_annotation_error": None}
    if not items:
        return meta
    if not GEMINI_API_KEY:
        meta["gemini_annotation_error"] = "GEMINI_API_KEY is not set"
        return meta

    meta["gemini_model"] = GEMINI_MODEL
    n = len(items)
    ctx = _resize_long_edge(rgb, CONTEXT_MAX_EDGE)
    buf_full = io.BytesIO()
    ctx.save(buf_full, format="JPEG", quality=88)
    full_bytes = buf_full.getvalue()

    crops_bytes: list[bytes] = []
    for it in items:
        mkey = "mask_png"
        bkey = "bbox"
        if mkey not in it or bkey not in it:
            meta["gemini_annotation_error"] = "Segment items missing mask_png or bbox"
            return meta
        rgba = _rgba_cutout(rgb, it[mkey])
        crops_bytes.append(_crop_patch_bytes(rgba, it[bkey], pad_frac=CROP_PAD_FRAC))

    lines = [
        "You label clothing for a fashion app.",
        f"The first image is the full photo (context). The next {n} images are isolated clothing regions in order: Segment 0 through Segment {n - 1}.",
        "Outside the garment is transparent in those crops — infer garment type using both the full photo and the crop.",
        "For each segment, output structured fields: specific garment/accessory, body region covered, a short UI label (≤6 words), optional notable details.",
        f"Return JSON with exactly {n} entries in `segments`, indices 0..{n - 1}, no extra keys at the top level besides `segments`.",
    ]
    intro = "\n".join(lines)

    parts: list[Any] = [
        intro,
        types.Part.from_bytes(data=full_bytes, mime_type="image/jpeg"),
    ]
    for i, cbytes in enumerate(crops_bytes):
        parts.append(f"Segment {i} (isolated region):")
        parts.append(types.Part.from_bytes(data=cbytes, mime_type="image/png"))

    schema = ClothingAnnotationsBatch.model_json_schema()
    client = genai.Client(api_key=GEMINI_API_KEY)
    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=parts,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=schema,
                temperature=0.2,
            ),
        )
    except Exception as e:
        meta["gemini_annotation_error"] = f"Gemini request failed: {e}"
        return meta

    raw = (response.text or "").strip()
    if not raw:
        meta["gemini_annotation_error"] = "Empty response from Gemini"
        return meta
    try:
        data = json.loads(raw)
        batch = ClothingAnnotationsBatch.model_validate(data)
    except Exception as e:
        meta["gemini_annotation_error"] = f"Bad JSON from Gemini: {e}"
        return meta

    by_index: dict[int, ClothingSegmentAnnotation] = {s.index: s for s in batch.segments}
    ordered = sorted(batch.segments, key=lambda s: s.index)
    for i, it in enumerate(items):
        ann = by_index.get(i)
        if ann is None and i < len(ordered):
            ann = ordered[i]
        if ann is None:
            continue
        it["clothing"] = {
            "garment_type": ann.garment_type,
            "body_region": ann.body_region,
            "short_label": ann.short_label,
            "notable_details": ann.notable_details or "",
        }

    if len(batch.segments) != n:
        meta["gemini_annotation_error"] = (
            f"Expected {n} segment annotations, got {len(batch.segments)}; partial merge applied"
        )
    return meta
