"""
StyleMe API - SAM 3 segmentation -> Gemini labeling -> embedding -> HydraDB + local cache.

No auth. Single-user mode. user_id passed explicitly per request.
"""

import io
import logging
import os

from dotenv.main import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("styleme")

app = FastAPI(title="StyleMe API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health


@app.get("/health")
def health():
    return {"status": "ok"}


# Segment only (no storage)


@app.post("/api/segment")
async def segment(
    file: UploadFile = File(...),
    prompts: str = Form(""),
    conf: float = Form(0.60),
    annotate: bool = Form(False),
) -> dict:
    """Upload an image and run SAM 3 segmentation. Set annotate=true to label segments with Gemini."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Expected an image file (e.g. image/jpeg, image/png).")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")

    import segmentor

    try:
        parsed = segmentor.parse_prompts_param(prompts)
        return segmentor.segment_image(data, prompts=parsed, conf=conf, annotate=annotate)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Model response error: {e}") from e


@app.post("/api/try-on")
async def try_on(
    user: UploadFile = File(..., description="Photo of the person to dress"),
    outfit: UploadFile = File(..., description="Photo containing the outfit to transfer"),
    prompts: str = Form(""),
    conf: float = Form(0.60),
    annotate: bool = Form(True),
) -> dict:
    """
    Segment clothing on ``outfit`` (fixed SAM text concept ``clothes``), label pieces with Gemini Flash-Lite when
    ``annotate`` is true, then composite them onto ``user`` with Gemini 3.1 Flash Image (Nano Banana 2).
    """
    for label, uf in (("user", user), ("outfit", outfit)):
        if not uf.content_type or not uf.content_type.startswith("image/"):
            raise HTTPException(
                status_code=400,
                detail=f"Expected an image file for {label} (e.g. image/jpeg, image/png).",
            )

    user_bytes = await user.read()
    outfit_bytes = await outfit.read()
    if not user_bytes or not outfit_bytes:
        raise HTTPException(status_code=400, detail="Empty upload.")

    import outfit_tryon
    import segmentor

    try:
        parsed = segmentor.parse_prompts_param(prompts)
        return outfit_tryon.apply_outfit_to_user(
            user_bytes,
            outfit_bytes,
            prompts=parsed,
            conf=conf,
            annotate=annotate,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


# Segment + Label + Embed + Store


@app.post("/api/segment-and-store")
async def segment_and_store(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    prompts: str = Form("clothes"),
    conf: float = Form(0.70),
):
    """
    Full pipeline: image -> SAM 3 -> Gemini labels -> cluster -> embed -> HydraDB + cache.
    Returns saved items (without large image blobs).
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Expected an image file.")
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file.")

    import segmentor
    from PIL import Image

    # Step 1: Segment + annotate
    parsed = segmentor.parse_prompts_param(prompts)
    seg_result = segmentor.segment_image(data, prompts=parsed, conf=conf, annotate=True)
    segments = seg_result.get("items", [])

    if not segments:
        return {"message": "No clothing detected", "items_saved": 0, "items": [], "clusters": {}}

    # Step 2: Ingest (cutout -> label -> embed -> cluster -> store)
    rgb = Image.open(io.BytesIO(data)).convert("RGB")
    from services.ingest import ingest_segments

    saved = await ingest_segments(user_id=user_id, rgb=rgb, segments=segments)

    # Step 3: Build cluster summary
    from services.local_cache import get_cluster_summary

    clusters = get_cluster_summary(user_id)

    return {
        "message": f"Stored {len(saved)} clothing items in {len(clusters)} clusters",
        "items_saved": len(saved),
        "items": [
            {
                "garment_id": g["garment_id"],
                "garment_type": g["garment_type"],
                "primary_color": g.get("primary_color", ""),
                "cluster": g.get("cluster", ""),
                "cluster_label": g.get("cluster_label", ""),
                "description": g.get("description", ""),
                "confidence": g.get("confidence", 0),
            }
            for g in saved
        ],
        "clusters": clusters,
    }


# Wardrobe: list all items with images


@app.get("/api/wardrobe/{user_id}")
async def get_wardrobe(user_id: str, search: str | None = None):
    """Get all wardrobe items with cutout images. Optional keyword search."""
    from services.local_cache import load_cache, search_cache

    if search and search.strip():
        items = search_cache(user_id, search)
    else:
        items = load_cache(user_id)

    return {"items": items, "total": len(items), "user_id": user_id}


# Wardrobe: clusters


@app.get("/api/wardrobe/{user_id}/clusters")
async def get_wardrobe_clusters(user_id: str):
    """Get wardrobe items grouped by cluster."""
    from services.local_cache import get_cluster_summary

    return {"clusters": get_cluster_summary(user_id), "user_id": user_id}


# Delete item


@app.delete("/api/wardrobe/{user_id}/{garment_id}")
async def delete_wardrobe_item(user_id: str, garment_id: str):
    from services.local_cache import delete_from_cache

    delete_from_cache(user_id, garment_id)
    return {"deleted": True, "garment_id": garment_id}


# Chat / Search: semantic + keyword


class ChatRequest(BaseModel):
    user_id: str
    message: str


@app.post("/api/chat")
async def chat(body: ChatRequest):
    """
    Search wardrobe by natural language. Uses:
    1. Gemini embedding -> cosine similarity (semantic, best quality)
    2. Keyword fallback (always works, no API needed)
    Returns matching items WITH images.
    """
    from services.local_cache import load_cache, search_cache, semantic_search

    user_id = body.user_id
    message = body.message.strip()

    if not user_id or not message:
        return {"reply": "Send a user_id and message.", "matches": [], "total_wardrobe": 0}

    all_items = load_cache(user_id)
    if not all_items:
        return {
            "reply": "Your wardrobe is empty. Upload a photo first!",
            "matches": [],
            "total_wardrobe": 0,
        }

    matches: list[dict] = []

    # Path 1: Semantic search (embedding cosine similarity - local, fast)
    try:
        from services.embedder import embed_query

        query_vec = embed_query(message)
        matches = semantic_search(user_id, query_vec, limit=8)
        logger.info(f"Semantic search: {len(matches)} matches for '{message}'")
    except Exception as e:
        logger.warning(f"Semantic search failed: {e}")

    # Path 2: HydraDB embedding search (if semantic search returned nothing)
    if not matches:
        try:
            from config import settings
            from hydra_db import HydraDB
            from services.embedder import embed_query as eq

            client = HydraDB(token=settings.hydradb_api_key)
            vec = eq(message)
            results = client.embeddings.search(
                tenant_id=settings.hydradb_tenant_id,
                sub_tenant_id=f"user_{user_id}",
                query_embedding=vec,
                limit=8,
                request_options={"timeout_in_seconds": 10},
            )
            if results:
                # Map HydraDB results back to cache items for images
                hydra_ids = {r.source_id for r in results if hasattr(r, "source_id")}
                matches = [i for i in all_items if i.get("garment_id") in hydra_ids]
                logger.info(f"HydraDB search: {len(matches)} matches")
        except Exception as e:
            logger.warning(f"HydraDB search failed: {e}")

    # Path 3: Keyword fallback (always works)
    if not matches:
        matches = search_cache(user_id, message, limit=8)
        logger.info(f"Keyword search: {len(matches)} matches for '{message}'")

    # Path 4: Return everything if nothing matched
    if not matches:
        matches = all_items[:8]

    # Build natural language reply
    top_names = ", ".join(
        f"{m.get('primary_color', '')} {m.get('garment_type', 'item')}".strip()
        for m in matches[:3]
    )
    reply = f"Found {len(matches)} matches: {top_names}"
    if len(matches) > 3:
        reply += f" and {len(matches) - 3} more"
    reply += "."

    return {
        "reply": reply,
        "matches": matches,
        "total_wardrobe": len(all_items),
        "search_method": "semantic" if any(m.get("score") for m in matches) else "keyword",
    }


def main() -> None:
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        reload=os.environ.get("RELOAD", "").lower() in ("1", "true", "yes"),
    )


if __name__ == "__main__":
    main()
