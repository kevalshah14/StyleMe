"""Chat service: embedding-first wardrobe assistant with image-grounded matches."""

from services.wardrobe import match_wardrobe_embeddings


async def chat_response(
    user_id: str,
    message: str,
    history: list[dict] | None = None,
) -> dict:
    """Return closest embedding matches and a concise grounded response."""
    _ = history  # kept for API compatibility
    query = (message or "").strip()
    if not query:
        return {
            "reply": "Ask about a piece or outfit and I will fetch closest matches from your wardrobe embeddings.",
            "wardrobe_items_used": 0,
            "sources": [],
            "matches": [],
        }

    matches = await match_wardrobe_embeddings(user_id=user_id, query=query, limit=8)
    top = matches[:3]

    if not top:
        return {
            "reply": "I could not find close matches in your wardrobe. Try a more specific query like 'cream shirt for summer dinner'.",
            "wardrobe_items_used": 0,
            "sources": [],
            "matches": [],
        }

    summary = ", ".join(
        f"{(m.get('primary_color') or '').strip()} {(m.get('garment_type') or 'item').strip()}".strip()
        for m in top
    )
    reply = f"Closest matches I found: {summary}. I also attached the exact item images from your wardrobe."

    return {
        "reply": reply,
        "wardrobe_items_used": len(matches),
        "sources": [
            {
                "type": m.get("garment_type", "item"),
                "color": m.get("primary_color", ""),
                "garment_id": m.get("garment_id", ""),
                "score": m.get("score"),
            }
            for m in matches
        ],
        "matches": matches,
    }
