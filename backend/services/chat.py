"""Conversational stylist powered by Gemini 3 with wardrobe tools and Google Search."""

import json
import logging

from google import genai
from google.genai import types

from hydra_db import HydraDB
from core.config import settings

logger = logging.getLogger(__name__)

_gemini: genai.Client | None = None
_hydra: HydraDB | None = None

MODEL = "gemini-3.1-flash-lite-preview"

REQUIRED_SLOTS = ("upper_body", "lower_body", "footwear")
FULL_BODY_SLOT = "full_body"

SYSTEM_INSTRUCTION = """You are StyleMe, a friendly and opinionated personal stylist chatbot.
You have access to the user's actual wardrobe via the search_wardrobe tool.

RULES:
- When the user asks for an outfit or styling advice, ALWAYS call search_wardrobe first to see what they own.
- After getting wardrobe results, assemble a COMPLETE outfit (top + bottom + shoes at minimum, or a full-body garment + shoes). Never leave the user bare — always cover all body regions.
- Be conversational, warm, and concise. Use fashion vocabulary naturally.
- If the user asks about trends, shopping advice, or items they don't own, use your knowledge and Google Search to help.
- When suggesting items to buy, be specific about what would complement their existing wardrobe.
- If the user just wants to chat or ask a general question, respond naturally WITHOUT calling the wardrobe tool.
- Return garment_ids in your response ONLY when you are recommending specific wardrobe items to wear.
- Keep responses to 2-4 sentences for outfit picks, longer for style advice discussions."""


SEARCH_WARDROBE_DECL = {
    "name": "search_wardrobe",
    "description": "Search the user's wardrobe for clothing items matching a query. Returns garment metadata including type, color, cluster (upper_body, lower_body, footwear, outerwear, full_body, accessory), and images.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Natural language search query, e.g. 'blue shirts', 'warm jacket', 'all tops'",
            },
            "limit": {
                "type": "integer",
                "description": "Max results to return (default 12)",
            },
        },
        "required": ["query"],
    },
}


def _get_gemini() -> genai.Client:
    global _gemini
    if _gemini is None:
        _gemini = genai.Client(api_key=settings.gemini_api_key)
    return _gemini


def _get_hydra() -> HydraDB:
    global _hydra
    if _hydra is None:
        _hydra = HydraDB(token=settings.hydradb_api_key)
    return _hydra


def _parse_tenant_metadata(raw) -> dict:
    if not raw:
        return {}
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def _normalize_recall_item(item) -> dict:
    d = item.model_dump() if hasattr(item, "model_dump") else (item if isinstance(item, dict) else {})
    meta = _parse_tenant_metadata(d.get("tenant_metadata"))
    return {
        "garment_id": meta.get("garment_id") or d.get("source_id", ""),
        "garment_type": meta.get("garment_type", ""),
        "primary_color": meta.get("primary_color", ""),
        "cluster": meta.get("cluster", ""),
        "body_region": meta.get("body_region", ""),
        "pattern": meta.get("pattern", ""),
        "material_estimate": meta.get("material_estimate", ""),
        "layering_role": meta.get("layering_role", ""),
        "description": d.get("text", "")[:200] if d.get("text") else "",
        "image_base64": meta.get("image_base64", ""),
        "score": d.get("score") or d.get("relevance_score"),
    }


def _execute_wardrobe_search(user_id: str, query: str, limit: int = 12) -> list[dict]:
    """Run HydraDB recall + local cache fallback."""
    client = _get_hydra()
    sub_tenant = f"user_{user_id}"
    matches: list[dict] = []

    try:
        result = client.recall.full_recall(
            query=query,
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
            mode="fast",
            max_results=limit,
            request_options={"timeout_in_seconds": 15},
        )
        if result and result.chunks:
            for chunk in result.chunks:
                norm = _normalize_recall_item(chunk)
                if norm.get("garment_id"):
                    matches.append(norm)
        if result and result.sources:
            seen = {m["garment_id"] for m in matches}
            for src in result.sources:
                norm = _normalize_recall_item(src)
                if norm.get("garment_id") and norm["garment_id"] not in seen:
                    matches.append(norm)
                    seen.add(norm["garment_id"])
    except Exception as e:
        logger.warning(f"HydraDB recall failed: {e}")

    if not matches:
        try:
            from services.local_cache import search_cache
            matches = search_cache(user_id, query, limit=limit)
        except Exception as e:
            logger.warning(f"Local cache fallback failed: {e}")

    return matches[:limit]


def _ensure_complete_outfit(user_id: str, items: list[dict]) -> list[dict]:
    """Fill missing body-region slots so the outfit covers the full body."""
    by_cluster: dict[str, dict] = {}
    for item in items:
        c = item.get("cluster", "other")
        if c not in by_cluster:
            by_cluster[c] = item

    has_full_body = FULL_BODY_SLOT in by_cluster
    needed = []
    for slot in REQUIRED_SLOTS:
        if slot in by_cluster:
            continue
        if has_full_body and slot in ("upper_body", "lower_body"):
            continue
        needed.append(slot)

    used_ids = {item["garment_id"] for item in items if item.get("garment_id")}
    fill_queries = {
        "upper_body": "shirt top blouse",
        "lower_body": "pants jeans trousers skirt",
        "footwear": "shoes sneakers boots",
    }

    for slot in needed:
        candidates = _execute_wardrobe_search(user_id, fill_queries.get(slot, slot), limit=4)
        for c in candidates:
            if c.get("garment_id") not in used_ids and c.get("cluster") == slot:
                items.append(c)
                used_ids.add(c["garment_id"])
                break

    return items


def _extract_garment_ids_from_text(text: str, all_items: list[dict]) -> list[dict]:
    """Find which garment IDs the model mentioned in its reply."""
    mentioned = []
    for item in all_items:
        gid = item.get("garment_id", "")
        if gid and gid in text:
            mentioned.append(item)
    return mentioned


def _build_gemini_history(history: list[dict] | None) -> list[types.Content]:
    """Convert frontend chat history into Gemini Content objects."""
    if not history:
        return []
    contents = []
    for msg in history:
        role = "user" if msg.get("role") == "user" else "model"
        text = msg.get("content", "")
        if text:
            contents.append(types.Content(role=role, parts=[types.Part(text=text)]))
    return contents


async def chat_response(
    user_id: str,
    message: str,
    history: list[dict] | None = None,
) -> dict:
    """
    Gemini-powered conversational stylist.
    Uses function calling for wardrobe search and Google Search for trends/shopping.
    Only returns outfit matches when the model decides it's relevant.
    """
    query = (message or "").strip()
    if not query:
        return {"reply": "Hey! Ask me anything about your style.", "wardrobe_items_used": 0, "sources": [], "matches": []}

    client = _get_gemini()
    tools = [
        types.Tool(
            google_search=types.GoogleSearch(),
            function_declarations=[SEARCH_WARDROBE_DECL],
        ),
    ]
    config = types.GenerateContentConfig(
        system_instruction=SYSTEM_INSTRUCTION,
        tools=tools,
        temperature=1.0,
        thinking_config=types.ThinkingConfig(thinking_level="low"),
    )

    contents = _build_gemini_history(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=query)]))

    all_wardrobe_items: list[dict] = []
    max_tool_rounds = 3

    for _ in range(max_tool_rounds):
        response = client.models.generate_content(
            model=MODEL,
            contents=contents,
            config=config,
        )

        candidate = response.candidates[0] if response.candidates else None
        if not candidate:
            break

        has_function_call = False
        for part in candidate.content.parts:
            if part.function_call and part.function_call.name == "search_wardrobe":
                has_function_call = True
                args = part.function_call.args or {}
                search_q = args.get("query", query)
                limit = args.get("limit", 12)

                items = _execute_wardrobe_search(user_id, search_q, limit=limit)
                all_wardrobe_items.extend(items)
                logger.info(f"Wardrobe search '{search_q}': {len(items)} results")

                items_summary = json.dumps(
                    [
                        {
                            "garment_id": it["garment_id"],
                            "garment_type": it["garment_type"],
                            "primary_color": it["primary_color"],
                            "cluster": it["cluster"],
                            "pattern": it.get("pattern", ""),
                            "material": it.get("material_estimate", ""),
                            "description": it.get("description", ""),
                        }
                        for it in items
                    ],
                    indent=2,
                )

                contents.append(candidate.content)

                fn_response_part = types.Part.from_function_response(
                    name="search_wardrobe",
                    response={"items": items_summary, "count": len(items)},
                )
                if part.function_call.id:
                    fn_response_part.function_response.id = part.function_call.id

                contents.append(
                    types.Content(role="user", parts=[fn_response_part])
                )
                break

        if not has_function_call:
            break

    reply_text = response.text or "I couldn't come up with a response. Try again?"

    mentioned = _extract_garment_ids_from_text(reply_text, all_wardrobe_items)

    if mentioned:
        mentioned = _ensure_complete_outfit(user_id, mentioned)
        seen = set()
        deduped = []
        for m in mentioned:
            if m["garment_id"] not in seen:
                deduped.append(m)
                seen.add(m["garment_id"])
        mentioned = deduped
    elif all_wardrobe_items:
        mentioned = _ensure_complete_outfit(user_id, all_wardrobe_items[:6])
        seen = set()
        deduped = []
        for m in mentioned:
            if m["garment_id"] not in seen:
                deduped.append(m)
                seen.add(m["garment_id"])
        mentioned = deduped

    return {
        "reply": reply_text,
        "wardrobe_items_used": len(mentioned),
        "sources": [
            {
                "type": m.get("garment_type", "item"),
                "color": m.get("primary_color", ""),
                "garment_id": m.get("garment_id", ""),
                "score": m.get("score"),
            }
            for m in mentioned
        ],
        "matches": mentioned,
    }
