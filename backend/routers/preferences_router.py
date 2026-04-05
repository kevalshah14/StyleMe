import base64
import io
import json
import logging

from fastapi import APIRouter, Depends, File, UploadFile
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from core.auth import get_current_user
from core.config import settings
from services.learning import compute_style_dna
from services.wardrobe import search_wardrobe

router = APIRouter(prefix="/api/preferences", tags=["preferences"])
logger = logging.getLogger(__name__)


def _get_wardrobe_items(results: list) -> list[dict]:
    items = []
    for r in results:
        if isinstance(r, dict):
            items.append(r)
        elif hasattr(r, "model_dump"):
            items.append(r.model_dump())
        elif hasattr(r, "__dict__"):
            items.append(r.__dict__)
    return items


@router.get("/style-dna")
async def get_style_dna(user: dict = Depends(get_current_user)):
    """Compute and return the user's Style DNA analytics."""
    user_id = user["user_id"]
    results = await search_wardrobe(user_id, None)
    items = _get_wardrobe_items(results)

    from services.local_cache import load_cache
    if not items:
        items = load_cache(user_id)

    dna = compute_style_dna(items)
    return dna


# ── Rate My Outfit ────────────────────────────────────────────────────

_RATE_OUTFIT_PROMPT = """You are a fashion critic and personal stylist. The user has uploaded a photo of their outfit.

Analyze the outfit and return JSON with:
- "overall_score": integer 1-10
- "whats_working": array of 2-3 specific things that work well
- "improvements": array of 2-3 specific actionable improvements
- "color_analysis": 1 sentence on the color palette
- "fit_notes": 1 sentence on how the clothes fit
- "occasion_read": what occasion/setting this outfit is best suited for
- "style_vibe": 2-3 word style label (e.g. "Smart Casual", "Streetwear Chic")
{wardrobe_section}

Be specific, constructive, and encouraging. Reference actual visible details in the photo."""


@router.post("/rate-outfit")
async def rate_outfit(
    photo: UploadFile = File(..., description="Full-body outfit photo"),
    user: dict = Depends(get_current_user),
):
    """Gemini vision analyzes a user's outfit photo and returns feedback."""
    if not photo.content_type or not photo.content_type.startswith("image/"):
        from fastapi import HTTPException
        raise HTTPException(400, "Expected an image file.")

    photo_bytes = await photo.read()
    if not photo_bytes:
        from fastapi import HTTPException
        raise HTTPException(400, "Empty upload.")

    user_id = user["user_id"]
    wardrobe_section = ""

    from services.local_cache import load_cache
    cached = load_cache(user_id)
    if cached:
        wardrobe_summary = ", ".join(
            f"{g.get('primary_color', '')} {g.get('garment_type', '')}".strip()
            for g in cached[:20]
        )
        wardrobe_section = (
            '\n- "wardrobe_alternatives": array of 2-3 specific items from the user\'s wardrobe that could elevate this outfit'
            f"\n\nThe user owns these items: {wardrobe_summary}"
        )

    prompt = _RATE_OUTFIT_PROMPT.format(wardrobe_section=wardrobe_section)

    client = genai.Client(api_key=settings.gemini_api_key)
    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=[
            prompt,
            types.Part.from_bytes(data=photo_bytes, mime_type=photo.content_type or "image/jpeg"),
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.4,
        ),
    )

    try:
        return json.loads(response.text or "{}")
    except (json.JSONDecodeError, AttributeError):
        return {"overall_score": 0, "error": "Could not analyze the photo. Please try again."}


# ── Wardrobe Gaps ─────────────────────────────────────────────────────

_WARDROBE_GAPS_PROMPT = """You are a fashion consultant. Analyze this wardrobe inventory and identify the most impactful items the user should add.

WARDROBE ({total} items):
{wardrobe_summary}

Return JSON with:
- "gap_analysis": 2-3 sentence overview of wardrobe strengths and weaknesses
- "recommendations": array of 5 objects, each with:
    - "item": specific garment description (e.g. "Navy wool blazer")
    - "reason": why this fills a gap (1 sentence)
    - "priority": "high", "medium", or "low"
    - "complements": array of 1-2 existing wardrobe items it would pair with
    - "search_terms": array of 2-3 shopping search keywords
- "versatility_score": integer 1-10 rating of current wardrobe versatility
- "occasion_coverage": object mapping occasions to "covered" | "partial" | "missing" for: casual, business_casual, formal, athleisure, date_night, outdoor

Use Google Search to recommend items aligned with current fashion trends for 2026."""


class WardrobeGapsResponse(BaseModel):
    gap_analysis: str = ""
    recommendations: list[dict] = Field(default_factory=list)
    versatility_score: int = 5
    occasion_coverage: dict = Field(default_factory=dict)


@router.get("/wardrobe-gaps")
async def get_wardrobe_gaps(user: dict = Depends(get_current_user)):
    """Gemini-powered analysis of what's missing from the user's wardrobe."""
    user_id = user["user_id"]

    from services.local_cache import load_cache
    from services.learning import _build_wardrobe_summary

    cached = load_cache(user_id)
    if not cached:
        results = await search_wardrobe(user_id, None)
        cached = _get_wardrobe_items(results)

    if not cached:
        return {"gap_analysis": "Upload some clothes first!", "recommendations": [], "versatility_score": 0, "occasion_coverage": {}}

    total = len(cached)
    summary = _build_wardrobe_summary(cached)
    prompt = _WARDROBE_GAPS_PROMPT.format(total=total, wardrobe_summary=summary)

    client = genai.Client(api_key=settings.gemini_api_key)
    tools = [types.Tool(google_search=types.GoogleSearch())]

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            tools=tools,
            temperature=0.4,
        ),
    )

    try:
        return json.loads(response.text or "{}")
    except (json.JSONDecodeError, AttributeError):
        logger.warning("Wardrobe gaps: failed to parse Gemini response")
        return {"gap_analysis": "Analysis failed. Please try again.", "recommendations": [], "versatility_score": 0, "occasion_coverage": {}}
