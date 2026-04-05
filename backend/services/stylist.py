"""Gemini outfit recommendation assembly."""

import json
import uuid

from google import genai
from google.genai import types

from core.config import settings
from models.outfit import ColorHarmony, OutfitItem, OutfitRecommendation

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


STYLIST_PROMPT = """You are a world-class personal stylist with deep knowledge of fashion, color theory, and occasion-appropriate dressing. You have access to the user's actual wardrobe.

EVENT: {event_description}
DRESS CODE: {dress_code}
TIME: {time_of_day}
WEATHER: {weather}
VIBE: {vibe}
CONSTRAINTS: {constraints}

USER'S STYLE PREFERENCES:
{style_preferences}

AVAILABLE WARDROBE ITEMS:
{items_json}

Create exactly {num_outfits} complete outfit recommendations. For each outfit, return a JSON object with:
- "name": catchy 2-3 word outfit name
- "items": array of objects with "garment_id", "garment_type", "description", "styling_note"
- "accessory_suggestions": array of strings
- "color_harmony": object with "palette" (array of hex colors) and "analysis" (1 sentence)
- "confidence": integer 1-10
- "explanation": 2-3 sentences on why this works
- "overall_styling": 1-2 sentences on how to put it all together

Return a JSON array of outfit objects. ONLY use garment_ids from the available items list.
Be creative but practical. Respect any constraints absolutely."""


async def recommend_outfits(
    event_description: str,
    dress_code: str | None,
    time_of_day: str | None,
    weather: str | None,
    vibe: list[str],
    constraints: str | None,
    wardrobe_items: list[dict],
    style_preferences: str,
    num_outfits: int = 3,
) -> list[OutfitRecommendation]:
    """Generate outfit recommendations using Gemini."""
    client = _get_client()

    prompt = STYLIST_PROMPT.format(
        event_description=event_description,
        dress_code=dress_code or "not specified",
        time_of_day=time_of_day or "not specified",
        weather=weather or "not specified",
        vibe=", ".join(vibe) if vibe else "not specified",
        constraints=constraints or "none",
        style_preferences=style_preferences,
        items_json=json.dumps(wardrobe_items, indent=2),
        num_outfits=num_outfits,
    )

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    try:
        outfits_data = json.loads(response.text)
    except (json.JSONDecodeError, AttributeError):
        return [
            OutfitRecommendation(
                outfit_id=str(uuid.uuid4()),
                name="Styling Suggestion",
                items=[],
                explanation="Unable to generate outfit recommendations. Please try again.",
            )
        ]

    if isinstance(outfits_data, dict):
        outfits_data = [outfits_data]

    recommendations = []
    for outfit in outfits_data[:num_outfits]:
        items = []
        for item in outfit.get("items", []):
            items.append(
                OutfitItem(
                    garment_id=item.get("garment_id", ""),
                    garment_type=item.get("garment_type", ""),
                    description=item.get("description", ""),
                    styling_note=item.get("styling_note", ""),
                )
            )

        harmony_data = outfit.get("color_harmony", {})
        recommendations.append(
            OutfitRecommendation(
                outfit_id=str(uuid.uuid4()),
                name=outfit.get("name", "Outfit"),
                items=items,
                accessory_suggestions=outfit.get("accessory_suggestions", []),
                color_harmony=ColorHarmony(
                    palette=harmony_data.get("palette", []),
                    analysis=harmony_data.get("analysis", ""),
                ),
                confidence=min(10, max(1, outfit.get("confidence", 7))),
                explanation=outfit.get("explanation", ""),
                overall_styling=outfit.get("overall_styling", ""),
            )
        )

    return recommendations
