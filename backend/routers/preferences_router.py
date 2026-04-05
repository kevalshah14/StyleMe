from fastapi import APIRouter, Depends

from core.auth import get_current_user
from services.learning import compute_style_dna
from services.wardrobe import search_wardrobe

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


@router.get("/style-dna")
async def get_style_dna(user: dict = Depends(get_current_user)):
    """Compute and return the user's Style DNA analytics."""
    user_id = user["user_id"]

    # Get all wardrobe items
    results = await search_wardrobe(user_id, None)

    items = []
    for r in results:
        if isinstance(r, dict):
            items.append(r)
        elif hasattr(r, "model_dump"):
            items.append(r.model_dump())
        elif hasattr(r, "__dict__"):
            items.append(r.__dict__)

    dna = compute_style_dna(items)
    return dna
