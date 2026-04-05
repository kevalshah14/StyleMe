from pydantic import BaseModel
from fastapi import APIRouter, Depends

from auth import get_current_user
from services.chat import chat_response

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    message: str
    history: list[dict] = []


class ChatResponse(BaseModel):
    reply: str
    wardrobe_items_used: int
    sources: list[dict]
    matches: list[dict]


@router.post("", response_model=ChatResponse)
async def chat(body: ChatMessage, user: dict = Depends(get_current_user)):
    """Embedding-first chat: returns closest wardrobe matches with image metadata."""
    result = await chat_response(
        user_id=user["user_id"],
        message=body.message,
        history=body.history,
    )
    return result
