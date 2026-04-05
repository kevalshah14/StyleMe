"""Store pre-segmented wardrobe items (skips SAM — goes straight to embed + cluster + store)."""

import io

from fastapi import APIRouter
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
