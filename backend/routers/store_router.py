"""Store pre-segmented wardrobe items (skips SAM — goes straight to embed + cluster + store)."""

import io

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(tags=["store"])


class StoreSegmentsRequest(BaseModel):
    user_id: str
    image_base64: str
    segments: list[dict]


@router.post("/api/store")
async def store_segments(body: StoreSegmentsRequest):
    """
    Store already-segmented items. Accepts the original image + segment items
    from a prior /api/segment call. Skips SAM — goes straight to cutout -> embed -> cluster -> store.
    """
    import base64

    from PIL import Image

    if not body.segments:
        return {"message": "No segments to store", "items_saved": 0, "items": [], "clusters": {}}

    img_data = base64.b64decode(body.image_base64)
    rgb = Image.open(io.BytesIO(img_data)).convert("RGB")

    from services.ingest import ingest_segments

    saved = await ingest_segments(user_id=body.user_id, rgb=rgb, segments=body.segments)

    from services.local_cache import get_cluster_summary

    clusters = get_cluster_summary(body.user_id)

    return {
        "message": f"Stored {len(saved)} clothing items in {len(clusters)} clusters",
        "items_saved": len(saved),
        "items": [
            {
                "garment_id": g["garment_id"],
                "garment_type": g["garment_type"],
                "primary_color": g.get("primary_color", ""),
                "cluster": g.get("cluster", ""),
                "cluster_label": g.get("cluster_label", ""),
                "description": g.get("description", ""),
                "confidence": g.get("confidence", 0),
            }
            for g in saved
        ],
        "clusters": clusters,
    }


class ChatRequest(BaseModel):
    user_id: str
    message: str


@router.post("/api/chat")
async def chat(body: ChatRequest):
    """
    Search wardrobe by natural language. Uses HydraDB full_recall as primary,
    falls back to local cache keyword search.
    """
    import json
    import logging

    from services.local_cache import load_cache, search_cache

    logger = logging.getLogger(__name__)
    user_id = body.user_id
    message = body.message.strip()

    if not user_id or not message:
        return {"reply": "Send a user_id and message.", "matches": [], "total_wardrobe": 0}

    all_items = load_cache(user_id)
    matches: list[dict] = []

    try:
        from hydra_db import HydraDB
        from core.config import settings

        client = HydraDB(token=settings.hydradb_api_key)
        result = client.recall.full_recall(
            query=message,
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=f"user_{user_id}",
            mode="fast",
            max_results=12,
            request_options={"timeout_in_seconds": 15},
        )
        if result and result.chunks:
            for chunk in result.chunks:
                d = chunk.model_dump() if hasattr(chunk, "model_dump") else {}
                meta = d.get("tenant_metadata", "")
                if isinstance(meta, str):
                    try:
                        meta = json.loads(meta)
                    except (json.JSONDecodeError, TypeError):
                        meta = {}
                if meta.get("garment_id"):
                    matches.append({
                        "garment_id": meta.get("garment_id", ""),
                        "garment_type": meta.get("garment_type", ""),
                        "primary_color": meta.get("primary_color", ""),
                        "cluster": meta.get("cluster", ""),
                        "body_region": meta.get("body_region", ""),
                        "description": (d.get("text") or "")[:200],
                        "image_base64": meta.get("image_base64", ""),
                    })
        logger.info(f"HydraDB recall: {len(matches)} matches for '{message}'")
    except Exception as e:
        logger.warning(f"HydraDB recall failed, using local fallback: {e}")

    if not matches:
        matches = search_cache(user_id, message, limit=8)

    if not matches:
        matches = all_items[:8] if all_items else []

    top_names = ", ".join(
        f"{m.get('primary_color', '')} {m.get('garment_type', 'item')}".strip()
        for m in matches[:3]
    )
    reply = f"Found {len(matches)} matches: {top_names}" if matches else "No matches found."
    if len(matches) > 3:
        reply += f" and {len(matches) - 3} more"
    if matches:
        reply += "."

    return {
        "reply": reply,
        "matches": matches,
        "total_wardrobe": len(all_items),
        "search_method": "hydradb" if any(m.get("image_base64") for m in matches) else "keyword",
    }


@router.get("/api/wardrobe/{user_id}")
async def get_wardrobe(user_id: str, search: str | None = None):
    """Get all wardrobe items with cutout images. Optional keyword search."""
    from services.local_cache import load_cache, search_cache

    if search and search.strip():
        items = search_cache(user_id, search)
    else:
        items = load_cache(user_id)

    return {"items": items, "total": len(items), "user_id": user_id}


@router.get("/api/wardrobe/{user_id}/clusters")
async def get_wardrobe_clusters(user_id: str):
    """Get wardrobe items grouped by cluster."""
    from services.local_cache import get_cluster_summary

    return {"clusters": get_cluster_summary(user_id), "user_id": user_id}


@router.delete("/api/wardrobe/{user_id}/{garment_id}")
async def delete_wardrobe_item(user_id: str, garment_id: str):
    from services.local_cache import delete_from_cache

    delete_from_cache(user_id, garment_id)
    return {"deleted": True, "garment_id": garment_id}
