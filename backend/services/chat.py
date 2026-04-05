"""Conversational stylist powered by Gemini 3 with wardrobe tools and Google Search."""

import json
import logging
import re
from datetime import date
from typing import Generator

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


def _build_system_instruction() -> str:
    today = date.today().strftime("%B %d, %Y")
    return f"""You are StyleMe, a friendly and opinionated personal stylist chatbot.
Today's date is {today}.
You have access to the user's actual wardrobe via the search_wardrobe tool and the web via Google Search.

RESPONSE FORMAT:
- Your reply is always conversational markdown text.
- When recommending a specific outfit to WEAR from the wardrobe, you MUST end your message with an outfit block in this exact format:

[OUTFIT]
garment_id_1
garment_id_2
garment_id_3
[/OUTFIT]

- The [OUTFIT] block is the ONLY place garment_ids should ever appear. NEVER put garment_ids anywhere else in your text — not inline, not in parentheses, not as references. Refer to owned items by name like "your black trousers" or "the red button-up".

TOOL SELECTION — THIS IS CRITICAL:
- ONLY call search_wardrobe when the user explicitly asks you to make an outfit, style them, or pick items FROM THEIR WARDROBE/CLOSET. Keywords: "outfit", "wear", "style me", "from my wardrobe", "what can I wear", "pair with".
- For ALL other requests — shopping, buying, trends, recommendations, "tell me a good X", "suggest X under $Y", "show me X", "search X", "find me X", product questions — DO NOT call search_wardrobe. Instead, rely on Google Search to find real products, prices, and links from the web.
- When in doubt, use Google Search, NOT search_wardrobe.

RESPONSE RULES:
- OUTFIT REQUESTS (search_wardrobe): Call search_wardrobe, pick pieces, describe the outfit, then add the [OUTFIT] block at the end. Always make it complete (top + bottom + shoes, or full-body + shoes).
- SHOPPING / TREND REQUESTS (Google Search): Use Google Search. Include markdown links to real web pages (e.g. [Product Name](https://url)). Do NOT call search_wardrobe. Do NOT include an [OUTFIT] block.
- GENERAL CHAT: Respond naturally without calling any tools.
- Be conversational, warm, and concise. Use fashion vocabulary.
- When occasion context is provided (event, weather, date, dress code), factor it into your recommendations.
- ALWAYS use the current year ({date.today().year}) when discussing trends, not past years."""


SEARCH_WARDROBE_DECL = {
    "name": "search_wardrobe",
    "description": "Search the user's OWNED wardrobe to assemble an outfit they can WEAR right now. ONLY use this when the user asks to be styled, wants an outfit, or asks what they own. Do NOT use for shopping, buying, trends, or product recommendations — use Google Search for those instead.",
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Search within the user's owned clothes, e.g. 'blue shirts', 'warm jacket', 'all tops'",
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


WARDROBE_TOOLS = [types.Tool(function_declarations=[SEARCH_WARDROBE_DECL])]
SEARCH_TOOLS = [types.Tool(google_search=types.GoogleSearch())]


_OUTFIT_BLOCK_RE = re.compile(
    r"\[OUTFIT\]\s*(.*?)\s*\[/OUTFIT\]",
    re.DOTALL | re.IGNORECASE,
)


def _extract_outfit_block(text: str, all_items: list[dict]) -> tuple[str, list[dict]]:
    """Parse [OUTFIT]...[/OUTFIT] block from reply.

    Returns (cleaned_reply_text, matched_items).
    The block is stripped from the display text.
    """
    match = _OUTFIT_BLOCK_RE.search(text)
    if not match:
        return text, []

    block_ids = set()
    for line in match.group(1).strip().splitlines():
        gid = line.strip()
        if gid:
            block_ids.add(gid)

    clean_text = text[:match.start()].rstrip() + text[match.end():]
    clean_text = clean_text.strip()

    items_by_id = {it.get("garment_id", ""): it for it in all_items}
    mentioned = [items_by_id[gid] for gid in block_ids if gid in items_by_id]
    return clean_text, mentioned


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


def _extract_reply_text(response) -> str:
    """Robustly extract text from a Gemini response, handling grounded responses."""
    if response is None:
        return "I couldn't come up with a response. Try again?"

    try:
        text = response.text
        if text:
            return text
    except (ValueError, AttributeError):
        pass

    # Fallback: walk response parts manually
    try:
        candidate = response.candidates[0] if response.candidates else None
        if candidate and candidate.content and candidate.content.parts:
            text_parts = []
            for part in candidate.content.parts:
                if hasattr(part, "text") and part.text:
                    text_parts.append(part.text)
            if text_parts:
                return "\n\n".join(text_parts)
    except (IndexError, AttributeError):
        pass

    return "I couldn't come up with a response. Try again?"


def _extract_grounding_sources(response) -> list[dict]:
    """Extract web sources from Gemini grounding metadata."""
    sources: list[dict] = []
    if response is None:
        return sources

    try:
        candidate = response.candidates[0] if response.candidates else None
        if not candidate:
            return sources

        grounding = getattr(candidate, "grounding_metadata", None)
        if not grounding:
            return sources

        chunks = getattr(grounding, "grounding_chunks", None) or []
        seen_urls: set[str] = set()
        for chunk in chunks:
            web = getattr(chunk, "web", None)
            if not web:
                continue
            uri = getattr(web, "uri", "") or ""
            title = getattr(web, "title", "") or ""
            if uri and uri not in seen_urls:
                seen_urls.add(uri)
                sources.append({"title": title, "url": uri})

        # Also check grounding_supports for search queries used
        supports = getattr(grounding, "grounding_supports", None) or []
        for support in supports:
            seg_sources = getattr(support, "grounding_chunk_indices", None) or []
            # Just confirms the text is grounded, no extra action needed

        search_entry = getattr(grounding, "search_entry_point", None)
        if search_entry:
            rendered = getattr(search_entry, "rendered_content", None)
            if rendered:
                logger.debug(f"Search entry point rendered: {rendered[:100]}...")

    except (IndexError, AttributeError) as e:
        logger.debug(f"Grounding extraction: {e}")

    return sources


async def chat_response(
    user_id: str,
    message: str,
    history: list[dict] | None = None,
    occasion: dict | None = None,
) -> dict:
    """
    Gemini-powered conversational stylist.

    Combines Google Search (built-in, server-side) with search_wardrobe (custom function)
    using include_server_side_tool_invocations per the Gemini docs.
    """
    query = (message or "").strip()
    if not query:
        return {"reply": "Hey! Ask me anything about your style.", "wardrobe_items_used": 0, "sources": [], "matches": [], "web_sources": []}

    if occasion:
        context_parts = []
        if occasion.get("event"):
            context_parts.append(f"Event: {occasion['event']}")
        if occasion.get("weather"):
            context_parts.append(f"Weather: {occasion['weather']}")
        if occasion.get("date"):
            context_parts.append(f"Date: {occasion['date']}")
        if occasion.get("dress_code"):
            context_parts.append(f"Dress code: {occasion['dress_code']}")
        if context_parts:
            query = f"{query}\n\n[Occasion context: {'; '.join(context_parts)}]"

    client = _get_gemini()
    sys_instruction = _build_system_instruction()

    wardrobe_config = types.GenerateContentConfig(
        system_instruction=sys_instruction, tools=WARDROBE_TOOLS, temperature=1.0,
    )
    search_config = types.GenerateContentConfig(
        system_instruction=sys_instruction, tools=SEARCH_TOOLS, temperature=1.0,
    )

    contents = _build_gemini_history(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=query)]))

    all_wardrobe_items: list[dict] = []
    response = None

    # Pass 1: wardrobe-only tools — let model decide if it needs the wardrobe
    logger.info("Pass 1: wardrobe tool check")
    try:
        response = client.models.generate_content(
            model=MODEL, contents=contents, config=wardrobe_config,
        )
    except Exception as e:
        logger.error(f"Gemini pass 1 failed: {e}")

    fc_part = None
    if response and response.candidates:
        candidate = response.candidates[0]
        if candidate and candidate.content and candidate.content.parts:
            for part in candidate.content.parts:
                if part.function_call and part.function_call.name == "search_wardrobe":
                    fc_part = part
                    break

    if fc_part is not None:
        # Model wants wardrobe → execute search, follow up without tools
        args = fc_part.function_call.args or {}
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
        fn_resp_part = types.Part.from_function_response(
            name="search_wardrobe",
            response={"result": {"items": items_summary, "count": len(items)}},
            id=fc_part.function_call.id,
        )
        contents.append(types.Content(role="user", parts=[fn_resp_part]))

        logger.info("Pass 2: wardrobe follow-up")
        try:
            response = client.models.generate_content(
                model=MODEL, contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=sys_instruction, temperature=1.0,
                ),
            )
        except Exception as e:
            logger.error(f"Gemini wardrobe follow-up failed: {e}")
    else:
        # Model didn't need wardrobe → redo with Google Search for web grounding
        logger.info("Pass 2: Google Search grounding")
        try:
            response = client.models.generate_content(
                model=MODEL, contents=contents, config=search_config,
            )
        except Exception as e:
            logger.error(f"Gemini search pass failed: {e}")

    raw_reply = _extract_reply_text(response)
    web_sources = _extract_grounding_sources(response)

    if web_sources:
        logger.info(f"Google Search grounding: {len(web_sources)} web sources")

    reply_text, mentioned = _extract_outfit_block(raw_reply, all_wardrobe_items)

    if mentioned:
        mentioned = _ensure_complete_outfit(user_id, mentioned)
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
        "web_sources": web_sources,
    }


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

def _sse_event(data: dict) -> str:
    return f"data: {json.dumps(data, default=str)}\n\n"


def _build_items_summary(items: list[dict]) -> str:
    return json.dumps(
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


def _postprocess_mentioned(user_id: str, mentioned: list[dict]) -> list[dict]:
    if mentioned:
        mentioned = _ensure_complete_outfit(user_id, mentioned)
        seen: set[str] = set()
        deduped: list[dict] = []
        for m in mentioned:
            if m["garment_id"] not in seen:
                deduped.append(m)
                seen.add(m["garment_id"])
        return deduped
    return mentioned


def _build_done_event(mentioned: list[dict], web_sources: list[dict]) -> dict:
    return {
        "type": "done",
        "web_sources": web_sources,
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


def chat_response_stream(
    user_id: str,
    message: str,
    history: list[dict] | None = None,
    occasion: dict | None = None,
) -> Generator[str, None, None]:
    """Streaming chat: yields SSE-formatted events (text chunks then metadata)."""
    query = (message or "").strip()
    if not query:
        yield _sse_event({"type": "chunk", "text": "Hey! Ask me anything about your style."})
        yield _sse_event(_build_done_event([], []))
        return

    if occasion:
        ctx = []
        if occasion.get("event"):
            ctx.append(f"Event: {occasion['event']}")
        if occasion.get("weather"):
            ctx.append(f"Weather: {occasion['weather']}")
        if occasion.get("date"):
            ctx.append(f"Date: {occasion['date']}")
        if occasion.get("dress_code"):
            ctx.append(f"Dress code: {occasion['dress_code']}")
        if ctx:
            query = f"{query}\n\n[Occasion context: {'; '.join(ctx)}]"

    client = _get_gemini()
    sys_instruction = _build_system_instruction()

    wardrobe_config = types.GenerateContentConfig(
        system_instruction=sys_instruction, tools=WARDROBE_TOOLS, temperature=1.0,
    )
    search_config = types.GenerateContentConfig(
        system_instruction=sys_instruction, tools=SEARCH_TOOLS, temperature=1.0,
    )
    plain_config = types.GenerateContentConfig(
        system_instruction=sys_instruction, temperature=1.0,
    )

    contents = _build_gemini_history(history)
    contents.append(types.Content(role="user", parts=[types.Part(text=query)]))

    all_wardrobe_items: list[dict] = []

    # Pass 1: wardrobe-only tools — let model decide if it needs the wardrobe
    logger.info("Stream pass 1: wardrobe tool check")
    try:
        response = client.models.generate_content(
            model=MODEL, contents=contents, config=wardrobe_config,
        )
    except Exception as e:
        logger.error(f"Gemini pass 1 failed: {e}")
        yield _sse_event({"type": "chunk", "text": "Sorry, something went wrong. Try again?"})
        yield _sse_event(_build_done_event([], []))
        return

    candidate = response.candidates[0] if response.candidates else None
    fc_part = None
    if candidate and candidate.content and candidate.content.parts:
        for part in candidate.content.parts:
            if part.function_call and part.function_call.name == "search_wardrobe":
                fc_part = part
                break

    if fc_part is not None:
        # Model wants wardrobe → execute search, stream follow-up
        args = fc_part.function_call.args or {}
        search_q = args.get("query", query)
        limit = args.get("limit", 12)

        items = _execute_wardrobe_search(user_id, search_q, limit=limit)
        all_wardrobe_items.extend(items)
        logger.info(f"Wardrobe search '{search_q}': {len(items)} results")

        contents.append(candidate.content)
        fn_resp_part = types.Part.from_function_response(
            name="search_wardrobe",
            response={"result": {"items": _build_items_summary(items), "count": len(items)}},
            id=fc_part.function_call.id,
        )
        contents.append(types.Content(role="user", parts=[fn_resp_part]))

        logger.info("Stream pass 2: wardrobe follow-up (streaming)")
        full_text = ""
        last_chunk = None
        try:
            stream = client.models.generate_content_stream(
                model=MODEL, contents=contents, config=plain_config,
            )
            for chunk in stream:
                last_chunk = chunk
                cand = chunk.candidates[0] if chunk.candidates else None
                if not cand or not cand.content or not cand.content.parts:
                    continue
                for p in cand.content.parts:
                    if hasattr(p, "text") and p.text:
                        full_text += p.text
                        yield _sse_event({"type": "chunk", "text": p.text})
        except Exception as e:
            logger.error(f"Gemini wardrobe stream failed: {e}")
            if not full_text:
                yield _sse_event({"type": "chunk", "text": "Sorry, something went wrong. Try again?"})
                yield _sse_event(_build_done_event([], []))
                return

        web_sources = _extract_grounding_sources(last_chunk) if last_chunk else []
        reply_text, mentioned = _extract_outfit_block(full_text, all_wardrobe_items)
    else:
        # Model didn't need wardrobe → use Google Search for web-grounded response
        logger.info("Stream pass 2: Google Search (streaming)")
        full_text = ""
        last_chunk = None
        try:
            stream = client.models.generate_content_stream(
                model=MODEL, contents=contents, config=search_config,
            )
            for chunk in stream:
                last_chunk = chunk
                cand = chunk.candidates[0] if chunk.candidates else None
                if not cand or not cand.content or not cand.content.parts:
                    continue
                for p in cand.content.parts:
                    if hasattr(p, "text") and p.text:
                        full_text += p.text
                        yield _sse_event({"type": "chunk", "text": p.text})
        except Exception as e:
            logger.error(f"Gemini search stream failed: {e}")
            if not full_text:
                yield _sse_event({"type": "chunk", "text": "Sorry, something went wrong. Try again?"})
                yield _sse_event(_build_done_event([], []))
                return

        web_sources = _extract_grounding_sources(last_chunk) if last_chunk else []
        reply_text, mentioned = _extract_outfit_block(full_text, [])

    mentioned = _postprocess_mentioned(user_id, mentioned)

    if web_sources:
        logger.info(f"Google Search grounding: {len(web_sources)} web sources")

    yield _sse_event(_build_done_event(mentioned, web_sources))
