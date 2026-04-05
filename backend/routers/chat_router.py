from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from core.auth import get_current_user
from services.chat import chat_response, chat_response_stream

router = APIRouter(prefix="/api/chat", tags=["chat"])


class OccasionContext(BaseModel):
    event: str = Field(default="", description="Event type, e.g. 'job interview', 'date night'")
    weather: str = Field(default="", description="Weather conditions, e.g. '15°C, partly cloudy'")
    date: str = Field(default="", description="Date of the event, e.g. 'next Tuesday'")
    dress_code: str = Field(default="", description="Dress code if known, e.g. 'business casual'")


class ChatMessage(BaseModel):
    message: str
    history: list[dict] = Field(default_factory=list)
    occasion: OccasionContext | None = Field(default=None, description="Optional event context for outfit planning")


class WebSource(BaseModel):
    title: str = ""
    url: str = ""


class ChatResponseModel(BaseModel):
    reply: str
    wardrobe_items_used: int = 0
    sources: list[dict] = Field(default_factory=list)
    matches: list[dict] = Field(default_factory=list)
    web_sources: list[WebSource] = Field(default_factory=list)


@router.post("", response_model=ChatResponseModel)
async def chat(body: ChatMessage, user: dict = Depends(get_current_user)):
    """Gemini-powered conversational stylist (non-streaming)."""
    result = await chat_response(
        user_id=user["user_id"],
        message=body.message,
        history=body.history,
        occasion=body.occasion.model_dump() if body.occasion else None,
    )
    return result


@router.post("/stream")
async def chat_stream(body: ChatMessage, user: dict = Depends(get_current_user)):
    """Gemini-powered conversational stylist (SSE streaming)."""
    generator = chat_response_stream(
        user_id=user["user_id"],
        message=body.message,
        history=body.history,
        occasion=body.occasion.model_dump() if body.occasion else None,
    )
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
