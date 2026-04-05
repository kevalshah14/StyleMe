from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends

from core.auth import get_current_user
from services.chat import chat_response

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    message: str
    history: list[dict] = Field(default_factory=list)


class ChatResponseModel(BaseModel):
    reply: str
    wardrobe_items_used: int = 0
    sources: list[dict] = Field(default_factory=list)
    matches: list[dict] = Field(default_factory=list)


@router.post("", response_model=ChatResponseModel)
async def chat(body: ChatMessage, user: dict = Depends(get_current_user)):
    """Gemini-powered conversational stylist with wardrobe tools and Google Search."""
    result = await chat_response(
        user_id=user["user_id"],
        message=body.message,
        history=body.history,
    )
    return result
