from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

from core.auth import get_current_user
from models.event import EventInput
from models.outfit import AcceptOutfitRequest, OutfitRecommendation
from services.learning import record_preference
from services.stylist import recommend_outfits
from services.wardrobe import get_style_preferences, match_wardrobe_embeddings, search_wardrobe

router = APIRouter(prefix="/api/recommend", tags=["recommend"])


class WardrobeMatchQuery(BaseModel):
    query: str
    limit: int = Field(default=12, ge=1, le=24)


@router.post("", response_model=list[OutfitRecommendation])
async def get_recommendations(
    body: EventInput,
    user: dict = Depends(get_current_user),
):
    """Get outfit recommendations for an event using dual-path HydraDB recall + Gemini."""
    user_id = user["user_id"]

    # Dual-path recall from HydraDB
    wardrobe_results = await search_wardrobe(user_id, body.event_description)

    # Build simplified items list for Gemini prompt
    wardrobe_items = []
    for r in wardrobe_results:
        if isinstance(r, dict):
            wardrobe_items.append(r)
        elif hasattr(r, "model_dump"):
            wardrobe_items.append(r.model_dump())
        elif hasattr(r, "__dict__"):
            wardrobe_items.append(r.__dict__)

    # Get style preferences
    style_prefs = await get_style_preferences(user_id)

    # Generate recommendations with Gemini
    outfits = await recommend_outfits(
        event_description=body.event_description,
        dress_code=body.dress_code,
        time_of_day=body.time_of_day,
        weather=body.weather,
        vibe=body.vibe,
        constraints=body.constraints,
        wardrobe_items=wardrobe_items,
        style_preferences=style_prefs,
        num_outfits=body.num_outfits,
    )

    return outfits


@router.post("/accept")
async def accept_outfit(
    body: AcceptOutfitRequest,
    user: dict = Depends(get_current_user),
):
    """Record that user selected an outfit (for style learning)."""
    success = await record_preference(
        user_id=user["user_id"],
        outfit_name=body.outfit_name,
        event_description=body.event_description,
        item_ids=body.selected_item_ids,
        reaction=body.reaction,
    )
    return {"recorded": success}


@router.post("/search")
async def search_matches(
    body: WardrobeMatchQuery,
    user: dict = Depends(get_current_user),
):
    """Return the closest wardrobe items from HydraDB raw embeddings for a natural-language query."""
    matches = await match_wardrobe_embeddings(
        user_id=user["user_id"],
        query=body.query,
        limit=body.limit,
    )
    return {
        "query": body.query,
        "matches": matches,
        "count": len(matches),
    }
