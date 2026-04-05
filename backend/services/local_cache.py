"""Local JSON cache for wardrobe items — fallback when HydraDB is slow/unavailable."""

import json
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR.mkdir(exist_ok=True)


def _cache_path(user_id: str) -> Path:
    return CACHE_DIR / f"wardrobe_{user_id}.json"


def save_to_cache(user_id: str, garment: dict):
    """Append a garment to the user's local JSON cache."""
    path = _cache_path(user_id)
    items = load_cache(user_id)
    # Avoid duplicates
    existing_ids = {i.get("garment_id") for i in items}
    if garment.get("garment_id") not in existing_ids:
        items.append(garment)
        path.write_text(json.dumps(items, indent=2))


def load_cache(user_id: str) -> list[dict]:
    """Load all cached garments for a user."""
    path = _cache_path(user_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def delete_from_cache(user_id: str, garment_id: str):
    """Remove a garment from cache."""
    items = load_cache(user_id)
    items = [i for i in items if i.get("garment_id") != garment_id]
    _cache_path(user_id).write_text(json.dumps(items, indent=2))
