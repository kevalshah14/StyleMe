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


class CompatibilityScores(BaseModel):
    color_harmony: int = Field(default=7, ge=1, le=10, description="How well the colors work together")
    style_coherence: int = Field(default=7, ge=1, le=10, description="How unified the overall aesthetic is")
    occasion_fit: int = Field(default=7, ge=1, le=10, description="How appropriate for the stated event")
    trend_alignment: int = Field(default=5, ge=1, le=10, description="How aligned with current fashion trends")


class OutfitRecommendation(BaseModel):
    outfit_id: str
    name: str
    items: list[OutfitItem]
    accessory_suggestions: list[str] = []
    color_harmony: ColorHarmony = ColorHarmony()
    compatibility: CompatibilityScores = CompatibilityScores()
    confidence: int = Field(default=7, ge=1, le=10)
    explanation: str = ""
    overall_styling: str = ""
    trend_note: str = Field(default="", description="Current fashion trend context from Google Search")


class AcceptOutfitRequest(BaseModel):
    outfit_id: str
    event_description: str
    outfit_name: str
    selected_item_ids: list[str]
    reaction: str = "positive"
