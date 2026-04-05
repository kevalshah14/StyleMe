from pydantic import BaseModel, Field


class GarmentExtracted(BaseModel):
    garment_type: str = ""
    sub_type: str = ""
    primary_color: str = ""
    secondary_colors: list[str] = []
    pattern: str = ""
    material_estimate: str = ""
    season: list[str] = []
    formality_level: int = Field(default=5, ge=1, le=10)
    style_tags: list[str] = []
    layering_role: str = "inner"
    versatility_score: int = Field(default=5, ge=1, le=10)
    color_hex: str = "#808080"
    occasion_fit: list[str] = []
    pairs_well_with: list[str] = []
    description: str = ""
    care_notes: str = ""
    gender_expression: str = "neutral"


class GarmentUploadResponse(BaseModel):
    garment_id: str
    image_base64: str
    extracted: GarmentExtracted
    status: str = "extracted"


class GarmentConfirmItem(BaseModel):
    garment_id: str
    image_base64: str
    garment_type: str
    sub_type: str = ""
    primary_color: str
    secondary_colors: list[str] = []
    pattern: str = ""
    material_estimate: str = ""
    season: list[str] = []
    formality_level: int = Field(default=5, ge=1, le=10)
    style_tags: list[str] = []
    layering_role: str = "inner"
    versatility_score: int = Field(default=5, ge=1, le=10)
    color_hex: str = "#808080"
    occasion_fit: list[str] = []
    pairs_well_with: list[str] = []
    description: str = ""


class GarmentConfirmRequest(BaseModel):
    items: list[GarmentConfirmItem]


class GarmentResponse(BaseModel):
    garment_id: str
    garment_type: str
    sub_type: str = ""
    primary_color: str
    color_hex: str = "#808080"
    pattern: str = ""
    formality_level: int = 5
    season: list[str] = []
    style_tags: list[str] = []
    layering_role: str = ""
    versatility_score: int = 5
    occasion_fit: list[str] = []
    description: str = ""
    image_base64: str = ""
    times_worn: int = 0
