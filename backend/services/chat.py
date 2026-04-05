"""Chat service: HydraDB recall-first wardrobe assistant with image-grounded matches."""

import json
import logging

from hydra_db import HydraDB
from config import settings

logger = logging.getLogger(__name__)

_client: HydraDB | None = None


def _get_client() -> HydraDB:
    global _client
    if _client is None:
        _client = HydraDB(token=settings.hydradb_api_key)
    return _client


def _parse_tenant_metadata(raw: str | dict | None) -> dict:
    """Safely parse tenant_metadata which may be a JSON string or dict."""
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def _normalize_recall_item(item) -> dict:
    """Normalize a HydraDB recall chunk/source into a frontend-safe garment card."""
    d = item.model_dump() if hasattr(item, "model_dump") else (item if isinstance(item, dict) else {})
    meta = _parse_tenant_metadata(d.get("tenant_metadata"))

    return {
        "garment_id": meta.get("garment_id") or d.get("source_id", ""),
        "garment_type": meta.get("garment_type", ""),
        "primary_color": meta.get("primary_color", ""),
        "cluster": meta.get("cluster", ""),
        "body_region": meta.get("body_region", ""),
        "pattern": meta.get("pattern", ""),
        "material_estimate": meta.get("material_estimate", ""),
        "layering_role": meta.get("layering_role", ""),
        "description": d.get("text", "")[:200] if d.get("text") else "",
        "image_base64": meta.get("image_base64", ""),
        "score": d.get("score") or d.get("relevance_score"),
    }


async def chat_response(
    user_id: str,
    message: str,
    history: list[dict] | None = None,
) -> dict:
    """
    HydraDB-primary retrieval: full_recall with the user's query.
    HydraDB handles embedding, indexing, and ranking internally.
    Returns closest wardrobe matches with images.
    """
    _ = history  # kept for API compat
    query = (message or "").strip()
    if not query:
        return {
            "reply": "Ask about a piece or outfit and I'll search your wardrobe.",
            "wardrobe_items_used": 0,
            "sources": [],
            "matches": [],
        }

    client = _get_client()
    sub_tenant = f"user_{user_id}"
    matches: list[dict] = []

    # Primary: HydraDB full_recall (handles embeddings + semantic + lexical internally)
    try:
        result = client.recall.full_recall(
            query=query,
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
            mode="fast",
            max_results=12,
            request_options={"timeout_in_seconds": 15},
        )
        if result and result.chunks:
            for chunk in result.chunks:
                normalized = _normalize_recall_item(chunk)
                if normalized.get("garment_id"):
                    matches.append(normalized)
        if result and result.sources:
            existing_ids = {m.get("garment_id") for m in matches}
            for source in result.sources:
                normalized = _normalize_recall_item(source)
                if normalized.get("garment_id") and normalized["garment_id"] not in existing_ids:
                    matches.append(normalized)
                    existing_ids.add(normalized["garment_id"])
        logger.info(f"HydraDB recall: {len(matches)} matches for '{query}'")
    except Exception as e:
        logger.error(f"HydraDB recall failed: {e}")

    # Fallback: local cache keyword search
    if not matches:
        try:
            from services.local_cache import search_cache
            matches = search_cache(user_id, query, limit=8)
            logger.info(f"Local cache fallback: {len(matches)} matches for '{query}'")
        except Exception as e:
            logger.error(f"Local cache search failed: {e}")

    top = matches[:8]
    if not top:
        return {
            "reply": "No matches found. Try a more specific query like 'blue shirt' or 'warm jacket'.",
            "wardrobe_items_used": 0,
            "sources": [],
            "matches": [],
        }

    summary = ", ".join(
        f"{(m.get('primary_color') or '').strip()} {(m.get('garment_type') or 'item').strip()}".strip()
        for m in top[:3]
    )
    reply = f"Found {len(top)} matches: {summary}."
    if len(top) > 3:
        reply += f" Plus {len(top) - 3} more."

    return {
        "reply": reply,
        "wardrobe_items_used": len(top),
        "sources": [
            {
                "type": m.get("garment_type", "item"),
                "color": m.get("primary_color", ""),
                "garment_id": m.get("garment_id", ""),
                "score": m.get("score"),
            }
            for m in top
        ],
        "matches": top,
    }
