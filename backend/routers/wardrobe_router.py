from fastapi import APIRouter, Depends, HTTPException, Query

from auth import get_current_user
from models.garment import GarmentConfirmRequest
from services.wardrobe import delete_garment, get_wardrobe_items, save_garment

router = APIRouter(prefix="/api/wardrobe", tags=["wardrobe"])


@router.post("/confirm", status_code=201)
async def confirm_garments(
    body: GarmentConfirmRequest,
    user: dict = Depends(get_current_user),
):
    """Save confirmed garments to HydraDB (dual: memory + embeddings)."""
    user_id = user["user_id"]
    saved_ids = []
    failed_ids = []

    for item in body.items:
        garment_dict = item.model_dump()
        garment_dict["garment_id"] = item.garment_id
        image_b64 = item.image_base64

        ok = await save_garment(user_id, garment_dict, image_b64)
        if ok:
            saved_ids.append(item.garment_id)
        else:
            failed_ids.append(item.garment_id)

    if not saved_ids and failed_ids:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save garments to HydraDB: {', '.join(failed_ids)}",
        )

    return {
        "saved": len(saved_ids),
        "garment_ids": saved_ids,
        "failed": len(failed_ids),
        "failed_ids": failed_ids,
    }


@router.get("")
async def get_wardrobe(
    search: str | None = Query(None),
    limit: int = Query(default=100, ge=1, le=200),
    user: dict = Depends(get_current_user),
):
    """List or search wardrobe items via normalized HydraDB embedding retrieval."""
    user_id = user["user_id"]
    items = await get_wardrobe_items(user_id=user_id, search=search, limit=limit)
    return {"items": items, "total": len(items)}


@router.delete("/{garment_id}")
async def remove_garment(
    garment_id: str,
    user: dict = Depends(get_current_user),
):
    """Delete a garment from wardrobe."""
    await delete_garment(user["user_id"], garment_id)
    return {"deleted": True, "garment_id": garment_id}
