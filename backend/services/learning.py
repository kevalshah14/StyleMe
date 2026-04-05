"""Style preference tracking and Style DNA computation."""

import json
import logging
from collections import Counter

from hydra_db import HydraDB
from hydra_db.types.memory_item import MemoryItem

from core.config import settings

logger = logging.getLogger(__name__)

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


def compute_style_dna(wardrobe_items: list[dict]) -> dict:
    """Compute style analytics from wardrobe data."""
    if not wardrobe_items:
        return {
            "style_archetypes": [],
            "dominant_colors": [],
            "formality_range": {"min": 0, "max": 0, "average": 0},
            "formality_distribution": {},
            "season_coverage": {"spring": 0, "summer": 0, "fall": 0, "winter": 0},
            "category_breakdown": {},
            "total_items": 0,
            "wardrobe_gaps": ["Upload some clothes to see your Style DNA!"],
        }

    # Color analysis
    color_counter = Counter()
    for item in wardrobe_items:
        color = item.get("primary_color", "unknown")
        if color:
            color_counter[color.lower()] += 1

    total = len(wardrobe_items)
    dominant_colors = [
        {"color": color.title(), "hex": "#808080", "percentage": round(count / total * 100)}
        for color, count in color_counter.most_common(6)
    ]

    # Formality distribution
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

    # Season coverage
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

    # Category breakdown
    type_counter = Counter(item.get("garment_type", "other").lower() for item in wardrobe_items)
    category_breakdown = dict(type_counter.most_common(10))

    # Style tags
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

    # Wardrobe gaps analysis
    gaps = []
    has_shoes = any("shoe" in item.get("garment_type", "").lower() or "boot" in item.get("garment_type", "").lower() or "sneaker" in item.get("garment_type", "").lower() for item in wardrobe_items)
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
    }
