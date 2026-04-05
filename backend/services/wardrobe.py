"""HydraDB wardrobe storage — dual path: user memory + raw embeddings."""

import base64
import io
import json
import logging

from hydra_db import HydraDB
from core.config import settings

logger = logging.getLogger(__name__)

_client: HydraDB | None = None


def _get_client() -> HydraDB:
    global _client
    if _client is None:
        _client = HydraDB(token=settings.hydradb_api_key)
    return _client


def _sub_tenant(user_id: str) -> str:
    return f"user_{user_id}"


def _compact_image_data_url(image_base64: str, max_size: int = 320, quality: int = 70) -> str:
    """Shrink image payload for metadata storage to reduce insert failures."""
    if not image_base64:
        return ""

    try:
        payload = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        raw = base64.b64decode(payload)
        img = Image.open(io.BytesIO(raw))
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
        img.thumbnail((max_size, max_size), Image.LANCZOS)

        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=quality)
        compact = base64.b64encode(buf.getvalue()).decode("utf-8")
        return f"data:image/jpeg;base64,{compact}"
    except Exception:
        # Fallback to original if compression fails.
        return image_base64


async def save_garment(user_id: str, garment: dict, image_base64: str) -> bool:
    """Save garment via HydraDB user memory."""
    client = _get_client()
    tenant = settings.hydradb_tenant_id
    sub_tenant = _sub_tenant(user_id)
    garment_id = garment["garment_id"]

    description = garment.get("description", "A clothing item")
    compact_image = _compact_image_data_url(image_base64)

    # Store as user memory (with image embedded in Markdown)
    try:
        metadata_str = json.dumps({
            "garment_id": garment_id,
            "garment_type": garment.get("garment_type", ""),
            "sub_type": garment.get("sub_type", ""),
            "primary_color": garment.get("primary_color", ""),
            "pattern": garment.get("pattern", ""),
            "formality_level": garment.get("formality_level", 5),
            "season": garment.get("season", []),
            "style_tags": garment.get("style_tags", []),
            "layering_role": garment.get("layering_role", ""),
            "versatility_score": garment.get("versatility_score", 5),
            "color_hex": garment.get("color_hex", ""),
            "occasion_fit": garment.get("occasion_fit", []),
            "description": description,
            "image_base64": compact_image,
        })
        
        garment_type = garment.get("garment_type", "clothing item")
        primary_color = garment.get("primary_color", "")
        text_content = f"![{primary_color} {garment_type}]({compact_image})\n\nDescription: {description}\nColor: {primary_color}\nCategory: {garment_type}"
        
        from hydra_db.types.memory_item import MemoryItem
        memory = MemoryItem(
            source_id=garment_id,
            text=text_content,
            is_markdown=True,
            infer=True,
            tenant_metadata=metadata_str,
        )
        client.upload.add_memory(
            memories=[memory],
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
        )
        logger.info(f"Saved memory for garment {garment_id}")
        return True
    except Exception as e:
        logger.error(f"Failed to save memory for {garment_id}: {e}")
        return False


async def search_wardrobe(user_id: str, query: str | None = None) -> list[dict]:
    """HydraDB recall search."""
    client = _get_client()
    tenant = settings.hydradb_tenant_id
    sub_tenant = _sub_tenant(user_id)
    results = []

    search_query = query or "all clothing items"

    try:
        retrieval = client.recall.full_recall(
            query=search_query,
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
            mode="fast",
            max_results=50,
            request_options={"timeout_in_seconds": 10},
        )
        if retrieval and retrieval.sources:
            for source in retrieval.sources:
                item = source.model_dump() if hasattr(source, "model_dump") else {"data": str(source)}
                results.append(item)
        if retrieval and retrieval.chunks:
            for chunk in retrieval.chunks:
                item = chunk.model_dump() if hasattr(chunk, "model_dump") else {"data": str(chunk)}
                existing_texts = {r.get("text", "")[:50] for r in results}
                chunk_text = item.get("text", "")[:50]
                if chunk_text and chunk_text not in existing_texts:
                    results.append(item)
    except Exception as e:
        logger.error(f"Memory recall failed: {e}")

    return results


def normalize_match(item: dict) -> dict:
    """Normalize HydraDB recall / embedding results into a frontend-safe garment card."""
    metadata = item.get("metadata", {}) if isinstance(item.get("metadata"), dict) else {}
    tenant_metadata = item.get("tenant_metadata", {})
    if isinstance(tenant_metadata, str):
        try:
            tenant_metadata = json.loads(tenant_metadata)
        except (json.JSONDecodeError, TypeError):
            tenant_metadata = {}
    elif not isinstance(tenant_metadata, dict):
        tenant_metadata = {}

    source_id = item.get("source_id") or metadata.get("garment_id") or tenant_metadata.get("garment_id") or ""
    garment_type = item.get("garment_type") or metadata.get("garment_type") or tenant_metadata.get("garment_type") or "item"
    primary_color = item.get("primary_color") or metadata.get("primary_color") or tenant_metadata.get("primary_color") or ""
    description = item.get("description") or metadata.get("description") or tenant_metadata.get("description") or item.get("text") or ""
    image_base64 = metadata.get("image_base64") or tenant_metadata.get("image_base64") or item.get("image_base64") or ""
    formality_level = item.get("formality_level") or metadata.get("formality_level") or tenant_metadata.get("formality_level") or 5

    season = item.get("season") or metadata.get("season") or tenant_metadata.get("season") or []
    if isinstance(season, str):
        try:
            season = json.loads(season)
        except (json.JSONDecodeError, TypeError):
            season = [season] if season else []

    style_tags = item.get("style_tags") or metadata.get("style_tags") or tenant_metadata.get("style_tags") or []
    if isinstance(style_tags, str):
        try:
            style_tags = json.loads(style_tags)
        except (json.JSONDecodeError, TypeError):
            style_tags = [style_tags] if style_tags else []

    score = item.get("score")
    if score is None and item.get("distance") is not None:
        score = item.get("distance")

    return {
        "garment_id": source_id,
        "source_id": source_id,
        "garment_type": garment_type,
        "primary_color": primary_color,
        "description": description,
        "image_base64": image_base64,
        "formality_level": formality_level,
        "season": season,
        "style_tags": style_tags,
        "score": score,
    }





def _dedupe_matches(matches: list[dict]) -> list[dict]:
    seen_ids: set[str] = set()
    deduped: list[dict] = []
    for item in matches:
        gid = str(item.get("garment_id") or item.get("source_id") or "").strip()
        if not gid or gid in seen_ids:
            continue
        seen_ids.add(gid)
        deduped.append(item)
    return deduped


def _merge_missing_fields(primary: list[dict], secondary: list[dict]) -> list[dict]:
    """Fill missing fields in primary rows using secondary rows matched by garment_id."""
    secondary_by_id: dict[str, dict] = {}
    for item in secondary:
        gid = str(item.get("garment_id") or item.get("source_id") or "").strip()
        if gid:
            secondary_by_id[gid] = item

    merged: list[dict] = []
    for item in primary:
        gid = str(item.get("garment_id") or item.get("source_id") or "").strip()
        source = secondary_by_id.get(gid, {})
        if not source:
            merged.append(item)
            continue

        patched = dict(item)
        for key in ["image_base64", "description", "garment_type", "primary_color", "season", "style_tags"]:
            if not patched.get(key):
                patched[key] = source.get(key, patched.get(key))
        merged.append(patched)
    return merged


async def _hydrate_images_from_memory(user_id: str, matches: list[dict]) -> list[dict]:
    """Ensure images are preserved for garments missing them by querying memory explicitly."""
    if not matches:
        return matches

    needs_image = [m for m in matches if not (m.get("image_base64") or "").strip()]
    if not needs_image:
        return matches

    try:
        recalled = await search_wardrobe(user_id, "all clothing items with images")
    except Exception as e:
        logger.error(f"Image hydration recall failed: {e}")
        return matches

    image_by_id: dict[str, str] = {}
    for item in recalled:
        if not isinstance(item, dict):
            continue
        normalized = normalize_match(item)
        gid = str(normalized.get("garment_id") or "").strip()
        img = str(normalized.get("image_base64") or "").strip()
        if gid and img:
            image_by_id[gid] = img

    hydrated: list[dict] = []
    for item in matches:
        gid = str(item.get("garment_id") or item.get("source_id") or "").strip()
        if gid and not (item.get("image_base64") or "").strip() and gid in image_by_id:
            patched = dict(item)
            patched["image_base64"] = image_by_id[gid]
            hydrated.append(patched)
        else:
            hydrated.append(item)
    return hydrated


async def get_wardrobe_items(user_id: str, search: str | None = None, limit: int = 100) -> list[dict]:
    """Return normalized wardrobe cards with image metadata, using HydraDB native search."""
    query = (search or "").strip()
    safe_limit = max(1, min(limit, 200))

    matches: list[dict] = []

    try:
        recalled = await search_wardrobe(user_id, query or "all clothing items in my wardrobe")
        matches = [normalize_match(item) for item in recalled if isinstance(item, dict)]
    except Exception as e:
        logger.error(f"Memory retrieval failed: {e}")

    # Fallback: local JSON cache (always works, no network)
    if not matches:
        from services.local_cache import load_cache
        logger.info(f"Using local cache fallback for user {user_id}")
        cached = load_cache(user_id)
        if query:
            q_lower = query.lower()
            cached = [
                item for item in cached
                if q_lower in (
                    item.get("garment_type", "") + " " +
                    item.get("primary_color", "") + " " +
                    item.get("description", "")
                ).lower()
            ]
        matches = cached

    normalized = _dedupe_matches(matches)
    normalized = await _hydrate_images_from_memory(user_id, normalized)
    return normalized[:safe_limit]


async def match_wardrobe_embeddings(user_id: str, query: str, limit: int = 12) -> list[dict]:
    """Embedding vector search over wardrobe items. Falls back to local cache semantic search."""
    matches: list[dict] = []

    try:
        from services.embedder import embed_query
        query_vec = embed_query(query)

        client = _get_client()
        results = client.embeddings.search(
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=_sub_tenant(user_id),
            query_embedding=query_vec,
            limit=limit,
            request_options={"timeout_in_seconds": 10},
        )
        matches = [normalize_match(r.model_dump() if hasattr(r, "model_dump") else {}) for r in results]
    except Exception as e:
        logger.warning(f"Embedding search failed, using local fallback: {e}")

    if not matches:
        try:
            from services.embedder import embed_query as eq
            from services.local_cache import semantic_search
            query_vec = eq(query)
            matches = semantic_search(user_id, query_vec, limit=limit)
        except Exception as e:
            logger.warning(f"Local semantic search also failed: {e}")

    if not matches:
        from services.local_cache import search_cache
        matches = search_cache(user_id, query, limit=limit)

    return _dedupe_matches(matches)[:limit]


async def get_style_preferences(user_id: str) -> str:
    """Recall user style preferences from HydraDB."""
    client = _get_client()
    tenant = settings.hydradb_tenant_id
    sub_tenant = _sub_tenant(user_id)

    try:
        prefs = client.recall.recall_preferences(
            query="preferred style, color preferences, and past outfit choices",
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
        )
        if prefs and prefs.chunks:
            return " ".join(chunk.text if hasattr(chunk, "text") else str(chunk) for chunk in prefs.chunks)
    except Exception as e:
        logger.error(f"Preference recall failed: {e}")

    return "No style preferences recorded yet."


async def delete_garment(user_id: str, garment_id: str) -> bool:
    """Remove garment from HydraDB."""
    client = _get_client()
    tenant = settings.hydradb_tenant_id
    sub_tenant = _sub_tenant(user_id)

    try:
        # First delete the actual memory data pointing to it
        client.data.delete(
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
            ids=[garment_id],
        )
    except Exception as e:
        logger.error(f"Failed to delete data {garment_id}: {e}")

    # Also make sure raw embeddings delete doesn't crash since we removed the raw embeddings logic, 
    # but some old garments might still have raw embeddings we want to delete.
    try:
        client.embeddings.delete(
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
            source_id=garment_id,
        )
    except Exception:
        pass

    try:
        client.data.delete(
            tenant_id=tenant,
            sub_tenant_id=sub_tenant,
            ids=[garment_id],
        )
    except Exception as e:
        logger.error(f"Failed to delete data {garment_id}: {e}")

    return True
