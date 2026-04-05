"""Gemini Vision clothing extraction from photos."""

import base64
import json

from google import genai
from google.genai import types

from core.config import settings
from models.garment import GarmentExtracted

_client: genai.Client | None = None

SCRAPER_PROMPT = """You are an expert fashion analyst. Analyze this clothing item photo and extract detailed metadata.

Extract the following as a JSON object:

1. "garment_type": (shirt, pants, blazer, dress, jacket, sweater, skirt, shorts, shoes, sneakers, boots, hat, scarf, belt, bag, accessory, etc.)
2. "sub_type": specific style (e.g., "crew neck pullover", "slim-fit chinos", "block-heel ankle boot")
3. "primary_color": dominant color name
4. "secondary_colors": array of accent colors
5. "pattern": (solid, striped, plaid, floral, geometric, abstract, animal print, etc.)
6. "material_estimate": best guess (cotton, linen, wool, silk, denim, leather, synthetic, etc.)
7. "season": array of appropriate seasons from ["spring", "summer", "fall", "winter"]
8. "formality_level": integer 1-10 (1=loungewear, 5=smart casual, 8=business formal, 10=black tie)
9. "style_tags": array of 3-5 style descriptors
10. "layering_role": "inner", "mid", or "outer"
11. "versatility_score": integer 1-10 (how many outfit types could use this)
12. "color_hex": approximate hex code of primary color (e.g., "#1B2A4A")
13. "occasion_fit": array of 3-5 events this item suits (e.g., "business meeting", "date night")
14. "pairs_well_with": array of 3-5 complementary items
15. "care_notes": brief care recommendation
16. "gender_expression": "masculine", "feminine", "neutral", or "any"
17. "description": 2-3 sentence description capturing the item's character, best use cases, and styling potential.

Return ONLY valid JSON. Be specific and opinionated."""


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


async def scrape_clothing(image_base64: str) -> GarmentExtracted:
    """Extract clothing metadata from a base64 image using Gemini Vision."""
    client = _get_client()

    # Strip data URL prefix if present
    if "," in image_base64:
        image_base64 = image_base64.split(",", 1)[1]

    image_bytes = base64.b64decode(image_base64)

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=[
            types.Content(
                parts=[
                    types.Part(text=SCRAPER_PROMPT),
                    types.Part(
                        inline_data=types.Blob(
                            mime_type="image/jpeg", data=image_bytes
                        )
                    ),
                ]
            )
        ],
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
        ),
    )

    try:
        data = json.loads(response.text)
        # Handle case where Gemini returns a list (e.g., multiple items in one photo)
        if isinstance(data, list):
            data = data[0] if data else {}
        if not isinstance(data, dict):
            return GarmentExtracted(description="Could not extract details from this image.")
    except (json.JSONDecodeError, AttributeError):
        return GarmentExtracted(description="Could not extract details from this image.")

    return GarmentExtracted(**{k: v for k, v in data.items() if k in GarmentExtracted.model_fields})
