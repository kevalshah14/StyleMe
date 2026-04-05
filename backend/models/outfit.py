from pydantic import BaseModel, Field


class OutfitItem(BaseModel):
    garment_id: str
    garment_type: str
    description: str
    image_base64: str = ""
    styling_note: str = ""


class ColorHarmony(BaseModel):
    palette: list[str] = []
    analysis: str = ""


class OutfitRecommendation(BaseModel):
    outfit_id: str
    name: str
    items: list[OutfitItem]
    accessory_suggestions: list[str] = []
    color_harmony: ColorHarmony = ColorHarmony()
    confidence: int = Field(default=7, ge=1, le=10)
    explanation: str = ""
    overall_styling: str = ""


class AcceptOutfitRequest(BaseModel):
    outfit_id: str
    event_description: str
    outfit_name: str
    selected_item_ids: list[str]
    reaction: str = "positive"
