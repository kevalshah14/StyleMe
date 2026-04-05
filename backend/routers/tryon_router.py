"""Virtual try-on endpoints — outfit compositing via Gemini image generation."""

import base64
import io
import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter(tags=["try-on"])
logger = logging.getLogger(__name__)


@router.post("/api/try-on")
async def try_on(
    user: UploadFile = File(..., description="Photo of the person to dress"),
    outfit: UploadFile = File(..., description="Photo containing the outfit to transfer"),
    prompts: str = Form(""),
    conf: float = Form(0.60),
    annotate: bool = Form(True),
) -> dict:
    """
    Segment clothing on outfit image, then composite onto user photo with Gemini image generation.
    """
    for label, uf in (("user", user), ("outfit", outfit)):
        if not uf.content_type or not uf.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Expected an image file for {label} (e.g. image/jpeg, image/png).",
            )

    user_bytes = await user.read()
    outfit_bytes = await outfit.read()
    if not user_bytes or not outfit_bytes:
        raise HTTPException(status_code=400, detail="Empty upload.")

    from services.segmentor import parse_prompts_param
    from services.tryon import apply_outfit_to_user

    try:
        parsed = parse_prompts_param(prompts)
        return apply_outfit_to_user(
            user_bytes,
            outfit_bytes,
            prompts=parsed,
            conf=conf,
            annotate=annotate,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


class TryOnWardrobeRequest(BaseModel):
    user_id: str
    garment_ids: list[str]
    query: str = ""


def _rgba_to_rgb_on_white(png_bytes: bytes) -> bytes:
    """Convert RGBA PNG to RGB on a white background so Gemini sees accurate colors."""
    from PIL import Image as PILImage

    im = PILImage.open(io.BytesIO(png_bytes)).convert("RGBA")
    bg = PILImage.new("RGB", im.size, (255, 255, 255))
    bg.paste(im, mask=im.split()[3])
    buf = io.BytesIO()
    bg.save(buf, format="JPEG", quality=95)
    return buf.getvalue()


def _pick_outfit_pieces(
    client: "genai.Client",
    query: str,
    garments: list[dict],
) -> list[str]:
    """Use Gemini text to select only the garments that form a coherent outfit."""
    import json

    from google.genai import types

    inventory = []
    for g in garments:
        inventory.append(
            f'  {{ "id": "{g["garment_id"]}", "type": "{g.get("garment_type", "")}", '
            f'"color": "{g.get("primary_color", "")}", "cluster": "{g.get("cluster", "")}", '
            f'"description": "{g.get("description", "")}" }}'
        )

    prompt = "\n".join([
        "You are a fashion stylist. A user asked for outfit help:",
        f'  "{query}"',
        "",
        "Here are the matching wardrobe pieces (JSON):",
        "[\n" + ",\n".join(inventory) + "\n]",
        "",
        "Pick ONLY the pieces that form one complete, coherent outfit.",
        "A typical outfit = 1 top + 1 bottom (or 1 full-body piece) + optionally 1 outerwear + optionally 1 pair of shoes.",
        "Do NOT duplicate body regions (e.g. don't pick 2 tops or 2 pairs of pants).",
        "Return a JSON array of the selected garment IDs only, e.g. [\"id1\", \"id2\", \"id3\"].",
        "Return ONLY the JSON array, nothing else.",
    ])

    try:
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
            ),
        )
        ids = json.loads(response.text or "[]")
        if isinstance(ids, list) and ids:
            return [str(i) for i in ids]
    except Exception as e:
        logger.warning(f"Outfit selection fallback: {e}")

    return [g["garment_id"] for g in garments[:4]]


@router.post("/api/try-on/wardrobe")
async def tryon_wardrobe(body: TryOnWardrobeRequest):
    """
    Virtual try-on using the user's onboarding full-body photo and pre-cut wardrobe items.
    """
    from PIL import Image

    from services.profile import load_full_body_photo
    from services.local_cache import load_cache

    photo = load_full_body_photo(body.user_id)
    if not photo:
        raise HTTPException(400, "No full-body photo found. Complete onboarding first.")
    user_bytes, _ = photo

    all_items = load_cache(body.user_id)
    id_set = set(body.garment_ids)
    candidates = [g for g in all_items if g.get("garment_id") in id_set]
    if not candidates:
        raise HTTPException(400, "No matching garments found in wardrobe.")

    from google import genai
    from google.genai import types

    from services.annotator import GEMINI_API_KEY, _resize_long_edge
    from services.tryon import GEMINI_IMAGE_MODEL, TRYON_MAX_SEGMENTS, TRYON_USER_MAX_EDGE, _extract_final_image

    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured.")

    client = genai.Client(api_key=GEMINI_API_KEY)

    logger.info(f"Try-on: {len(candidates)} candidate garments, query={body.query!r}")
    if body.query and len(candidates) > 1:
        logger.info("Try-on: asking Gemini to pick outfit pieces...")
        selected_ids = _pick_outfit_pieces(client, body.query, candidates)
        logger.info(f"Try-on: Gemini selected {len(selected_ids)} pieces")
        selected_set = set(selected_ids)
        garments = [g for g in candidates if g["garment_id"] in selected_set]
        if not garments:
            garments = candidates[:4]
    else:
        garments = candidates[:4]

    logger.info(f"Try-on: using {len(garments)} garments for image generation")

    user_im = Image.open(io.BytesIO(user_bytes)).convert("RGB")
    user_im = _resize_long_edge(user_im, TRYON_USER_MAX_EDGE)

    garment_images: list[bytes] = []
    lines: list[str] = []
    selected_garment_ids: list[str] = []
    for i, g in enumerate(garments[:TRYON_MAX_SEGMENTS]):
        img_b64 = g.get("image_base64", "")
        if img_b64.startswith("data:"):
            img_b64 = img_b64.split(",", 1)[1]
        if not img_b64:
            continue
        raw_png = base64.b64decode(img_b64)
        garment_images.append(_rgba_to_rgb_on_white(raw_png))
        label = g.get("garment_type", "garment")
        color = g.get("primary_color", "")
        lines.append(f"- Garment {i + 1} (image {i + 2}): {color} {label}".strip())
        selected_garment_ids.append(g["garment_id"])

    if not garment_images:
        raise HTTPException(400, "Could not load garment images.")

    n = len(garment_images)
    query_line = f'The user asked: "{body.query}"' if body.query else ""
    prompt = "\n".join(filter(None, [
        "Virtual fashion try-on for a style app.",
        "",
        "Image 1 is the TARGET PERSON. Preserve their identity: face, hair, skin tone, body shape, and expression.",
        "IMPORTANT: Replace the background with a clean, plain BLACK studio backdrop.",
        f"Images 2–{1 + n} are {n} clothing pieces shown on a white background. Use EXACTLY these colors and patterns — do not alter or reinterpret the garment colors.",
        query_line,
        "Dress the target person ONLY with the pieces that make sense for the request. If a garment does not fit the occasion or outfit, leave it out. Do NOT keep any clothing from the original photo — remove everything the person was wearing and ONLY use the provided garment pieces. Any body region not covered by the provided pieces should be bare or covered with plain neutral clothing that blends with the outfit.",
        "",
        "Requirements:",
        "- Photorealistic single output image.",
        "- Plain black studio background — no props, no scenery.",
        "- Use the exact colors visible in each garment image.",
        "- Correct layering (outerwear over shirts, pants under tops).",
        "- Natural fit with proper wrinkles, shadows, and proportions.",
        "",
        "Garment list:",
        *lines,
    ]))

    contents: list = [prompt, user_im]
    for buf in garment_images:
        contents.append(types.Part.from_bytes(data=buf, mime_type="image/jpeg"))

    logger.info(f"Try-on: calling {GEMINI_IMAGE_MODEL} with {n} garment images...")
    try:
        response = client.models.generate_content(
            model=GEMINI_IMAGE_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )
    except Exception as e:
        logger.error(f"Try-on: Gemini image generation failed: {e}")
        raise HTTPException(503, f"Gemini image generation failed: {e}") from e

    logger.info("Try-on: Gemini response received, extracting image...")
    raw, mime, note = _extract_final_image(response)
    if not raw:
        logger.warning(f"Try-on: No image in response. Model note: {note}")
        raise HTTPException(502, "Model returned no image (safety block or empty response).")

    result_im = Image.open(io.BytesIO(raw)).convert("RGB")
    result_im.thumbnail((768, 768), Image.LANCZOS)
    buf = io.BytesIO()
    result_im.save(buf, format="JPEG", quality=82)
    compressed = buf.getvalue()
    logger.info(f"Try-on: done. Original {len(raw)//1024}KB -> compressed {len(compressed)//1024}KB")

    return {
        "generated_image": f"data:image/jpeg;base64,{base64.b64encode(compressed).decode('ascii')}",
        "garments_applied": n,
        "selected_garment_ids": selected_garment_ids,
        "model_note": note,
    }
