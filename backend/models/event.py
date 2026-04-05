from pydantic import BaseModel, Field


class EventInput(BaseModel):
    event_description: str
    dress_code: str | None = None
    time_of_day: str | None = None
    weather: str | None = None
    vibe: list[str] = []
    constraints: str | None = None
    num_outfits: int = Field(default=3, ge=1, le=5)
