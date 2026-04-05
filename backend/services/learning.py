"""Style preference tracking and Style DNA computation (Gemini-powered)."""

import json
import logging
from collections import Counter

from google import genai
from google.genai import types
from hydra_db import HydraDB
from hydra_db.types.memory_item import MemoryItem

from core.config import settings

logger = logging.getLogger(__name__)

_gemini: genai.Client | None = None

STYLE_DNA_MODEL = "gemini-3.1-flash-lite-preview"


def _get_gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=settings.gemini_api_key)
    return _gemini

_client: HydraDB | None = None


def _get_client() -> HydraDB:
    global _client
    if _client is None:
        _client = HydraDB(token=settings.hydradb_api_key)
    return _client


async def record_preference(
    user_id: str,
    outfit_name: str,
    event_description: str,
    item_ids: list[str],
    reaction: str = "positive",
) -> bool:
    """Record an outfit choice as a preference memory in HydraDB."""
    client = _get_client()
    sub_tenant = f"user_{user_id}"

    text = (
        f"User chose outfit '{outfit_name}' for event '{event_description}'. "
        f"Items used: {', '.join(item_ids)}. Reaction: {reaction}."
    )

    try:
        client.upload.add_memory(
            memories=[MemoryItem(text=text, infer=True)],
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to record preference: {e}")
        return False


_STYLE_DNA_PROMPT = """You are a fashion analyst. Given a user's wardrobe inventory, produce a comprehensive Style DNA profile.

WARDROBE ({total} items):
{wardrobe_summary}

Return JSON with EXACTLY these keys:
- "style_archetypes": top 3 fashion style labels (e.g. "Minimalist", "Streetwear", "Classic")
- "dominant_colors": top 6 colors, each with {{"color": "Navy", "hex": "#1B2A4A", "percentage": 25}}
- "formality_range": {{"min": 1, "max": 10, "average": 5.2}}
- "formality_distribution": {{"1-2": count, "3-4": count, "5-6": count, "7-8": count, "9-10": count}}
- "season_coverage": {{"spring": 0.0-1.0, "summer": 0.0-1.0, "fall": 0.0-1.0, "winter": 0.0-1.0}}
- "category_breakdown": {{"jeans": 3, "t-shirt": 5, ...}} (top 10 types)
- "total_items": {total}
- "wardrobe_gaps": array of 2-5 specific, actionable gap recommendations (e.g. "Add a navy blazer for smart-casual versatility" not generic "add more items")
- "style_summary": 2-3 sentence natural-language description of this person's style identity

Be specific and grounded in the actual data. Wardrobe gaps should name specific garment types, colors, or occasions that are underserved."""


def _build_wardrobe_summary(items: list[dict]) -> str:
    lines = []
    for item in items:
        parts = [item.get("garment_type", "item")]
        if item.get("primary_color"):
            parts.append(f"({item['primary_color']})")
        if item.get("hex_color") and item["hex_color"] != "#808080":
            parts.append(f"[{item['hex_color']}]")
        if item.get("pattern") and item["pattern"] != "solid":
            parts.append(f"pattern={item['pattern']}")
        if item.get("material_estimate"):
            parts.append(f"material={item['material_estimate']}")
        tags = item.get("style_tags", [])
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = []
        if tags:
            parts.append(f"style={','.join(tags[:3])}")
        parts.append(f"formality={item.get('formality_level', 5)}")
        season = item.get("season", [])
        if isinstance(season, str):
            try:
                season = json.loads(season)
            except (json.JSONDecodeError, TypeError):
                season = []
        if season and set(season) != {"spring", "summer", "fall", "winter"}:
            parts.append(f"season={','.join(season)}")
        lines.append(" ".join(parts))
    return "\n".join(lines)


def compute_style_dna(wardrobe_items: list[dict]) -> dict:
    """Compute style analytics using Gemini, with heuristic fallback."""
    empty = {
        "style_archetypes": [],
        "dominant_colors": [],
        "formality_range": {"min": 0, "max": 0, "average": 0},
        "formality_distribution": {},
        "season_coverage": {"spring": 0, "summer": 0, "fall": 0, "winter": 0},
        "category_breakdown": {},
        "total_items": 0,
        "wardrobe_gaps": ["Upload some clothes to see your Style DNA!"],
        "style_summary": "",
    }
    if not wardrobe_items:
        return empty

    try:
        return _compute_style_dna_gemini(wardrobe_items)
    except Exception as e:
        logger.warning(f"Gemini Style DNA failed, using heuristic fallback: {e}")
        return _compute_style_dna_heuristic(wardrobe_items)


def _compute_style_dna_gemini(wardrobe_items: list[dict]) -> dict:
    """Gemini-powered Style DNA — rich, contextual analysis."""
    client = _get_gemini()
    total = len(wardrobe_items)
    summary = _build_wardrobe_summary(wardrobe_items)

    prompt = _STYLE_DNA_PROMPT.format(total=total, wardrobe_summary=summary)
    response = client.models.generate_content(
        model=STYLE_DNA_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.3,
        ),
    )
    data = json.loads(response.text or "{}")
    data["total_items"] = total
    return data


def _compute_style_dna_heuristic(wardrobe_items: list[dict]) -> dict:
    """Heuristic fallback when Gemini is unavailable."""
    color_counter = Counter()
    for item in wardrobe_items:
        color = item.get("primary_color", "unknown")
        if color:
            color_counter[color.lower()] += 1

    total = len(wardrobe_items)
    hex_by_color: dict[str, str] = {}
    for item in wardrobe_items:
        c = (item.get("primary_color") or "").lower()
        h = (item.get("hex_color") or "").strip()
        if c and h.startswith("#") and len(h) == 7 and c not in hex_by_color:
            hex_by_color[c] = h

    dominant_colors = [
        {
            "color": color.title(),
            "hex": hex_by_color.get(color, "#808080"),
            "percentage": round(count / total * 100),
        }
        for color, count in color_counter.most_common(6)
    ]

    formality_levels = [item.get("formality_level", 5) for item in wardrobe_items]
    formality_dist = Counter()
    for f in formality_levels:
        if f <= 2:
            formality_dist["1-2"] += 1
        elif f <= 4:
            formality_dist["3-4"] += 1
        elif f <= 6:
            formality_dist["5-6"] += 1
        elif f <= 8:
            formality_dist["7-8"] += 1
        else:
            formality_dist["9-10"] += 1

    season_counter = Counter()
    for item in wardrobe_items:
        seasons = item.get("season", [])
        if isinstance(seasons, str):
            try:
                seasons = json.loads(seasons)
            except (json.JSONDecodeError, TypeError):
                seasons = []
        for s in seasons:
            season_counter[s.lower()] += 1

    season_coverage = {
        s: round(min(1.0, season_counter.get(s, 0) / max(total * 0.5, 1)), 2)
        for s in ["spring", "summer", "fall", "winter"]
    }

    type_counter = Counter(item.get("garment_type", "other").lower() for item in wardrobe_items)
    category_breakdown = dict(type_counter.most_common(10))

    tag_counter = Counter()
    for item in wardrobe_items:
        tags = item.get("style_tags", [])
        if isinstance(tags, str):
            try:
                tags = json.loads(tags)
            except (json.JSONDecodeError, TypeError):
                tags = []
        for t in tags:
            tag_counter[t.lower()] += 1

    style_archetypes = [tag.title() for tag, _ in tag_counter.most_common(3)]

    gaps = []
    has_shoes = any(
        kw in item.get("garment_type", "").lower()
        for item in wardrobe_items
        for kw in ("shoe", "boot", "sneaker")
    )
    has_outerwear = any(item.get("layering_role", "") == "outer" for item in wardrobe_items)
    has_formal = any(item.get("formality_level", 0) >= 8 for item in wardrobe_items)

    if not has_shoes:
        gaps.append("No shoes in your wardrobe — add some to complete your outfits")
    if not has_outerwear:
        gaps.append("Missing outerwear — a jacket or coat would add layering options")
    if not has_formal:
        gaps.append("No formal pieces — consider adding a blazer or dress for special occasions")
    if season_coverage.get("summer", 0) < 0.3:
        gaps.append("Low summer coverage — add lightweight, breathable pieces")
    if season_coverage.get("winter", 0) < 0.3:
        gaps.append("Low winter coverage — consider warm layers and heavier fabrics")
    if not gaps:
        gaps.append("Great wardrobe coverage! Keep adding pieces to expand your options.")

    avg_formality = round(sum(formality_levels) / len(formality_levels), 1) if formality_levels else 0

    return {
        "style_archetypes": style_archetypes,
        "dominant_colors": dominant_colors,
        "formality_range": {
            "min": min(formality_levels) if formality_levels else 0,
            "max": max(formality_levels) if formality_levels else 0,
            "average": avg_formality,
        },
        "formality_distribution": dict(formality_dist),
        "season_coverage": season_coverage,
        "category_breakdown": category_breakdown,
        "total_items": total,
        "wardrobe_gaps": gaps,
        "style_summary": "",
    }
