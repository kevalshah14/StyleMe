"""HydraDB data inspection endpoints — view stored wardrobe data."""

import logging

from fastapi import APIRouter, Depends, Query
from hydra_db import HydraDB

from core.auth import get_current_user
from core.config import settings

router = APIRouter(prefix="/api/inspect", tags=["inspect"])
log = logging.getLogger(__name__)

_client: HydraDB | None = None


def _get_client() -> HydraDB:
    global _client
    if _client is None:
        _client = HydraDB(token=settings.hydradb_api_key)
    return _client


@router.get("/memories")
async def inspect_memories(
    query: str = Query(default="all items", description="Search query for recall"),
    max_results: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Inspect stored memories in HydraDB via full_recall."""
    client = _get_client()
    sub_tenant = f"user_{user['user_id']}"

    try:
        result = client.recall.full_recall(
            query=query,
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
            max_results=max_results,
        )
        return {
            "sub_tenant": sub_tenant,
            "query": query,
            "chunks": [c.model_dump() if hasattr(c, "model_dump") else str(c) for c in (result.chunks or [])],
            "sources": [s.model_dump() if hasattr(s, "model_dump") else str(s) for s in (result.sources or [])],
            "graph_context": result.graph_context,
            "chunk_count": len(result.chunks or []),
            "source_count": len(result.sources or []),
        }
    except Exception as e:
        log.error(f"Inspect memories failed: {e}")
        return {"error": str(e), "sub_tenant": sub_tenant}


@router.get("/embeddings")
async def inspect_embeddings(
    query: str = Query(default="clothing item", description="Search query for embedding recall"),
    limit: int = Query(default=20, ge=1, le=100),
    user: dict = Depends(get_current_user),
):
    """Inspect stored embeddings in HydraDB via search_raw_embeddings."""
    client = _get_client()
    sub_tenant = f"user_{user['user_id']}"

    try:
        from services.embedder import embed_query
        query_vec = embed_query(query)

        results = client.embeddings.search(
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
            query_embedding=query_vec,
            limit=limit,
            output_fields=["source_id", "score", "distance", "metadata"],
        )

        items = []
        for r in results:
            d = r.model_dump() if hasattr(r, "model_dump") else {"data": str(r)}
            # Remove the actual embedding vector from output (too large)
            if "embedding" in d and isinstance(d["embedding"], dict):
                d["embedding"] = {"chunk_id": d["embedding"].get("chunk_id"), "dimensions": "768 (omitted)"}
            items.append(d)

        return {
            "sub_tenant": sub_tenant,
            "query": query,
            "count": len(items),
            "results": items,
        }
    except Exception as e:
        log.error(f"Inspect embeddings failed: {e}")
        return {"error": str(e), "sub_tenant": sub_tenant}


@router.get("/sub-tenants")
async def list_sub_tenants(user: dict = Depends(get_current_user)):
    """List all sub-tenant IDs in the styleme tenant."""
    client = _get_client()
    try:
        result = client.tenant.get_sub_tenant_ids(tenant_id=settings.hydradb_tenant_id)
        return {
            "tenant_id": settings.hydradb_tenant_id,
            "sub_tenants": result.model_dump() if hasattr(result, "model_dump") else str(result),
        }
    except Exception as e:
        log.error(f"List sub-tenants failed: {e}")
        return {"error": str(e)}


@router.get("/stats")
async def wardrobe_stats(user: dict = Depends(get_current_user)):
    """Quick stats about what's stored for this user."""
    client = _get_client()
    sub_tenant = f"user_{user['user_id']}"

    stats = {"sub_tenant": sub_tenant, "memories": 0, "embeddings": 0}

    # Count memories via a broad recall
    try:
        result = client.recall.full_recall(
            query="all clothing items",
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
            max_results=100,
        )
        stats["memories"] = len(result.sources or [])
        stats["memory_sample"] = [
            {
                "source_id": s.source_id if hasattr(s, "source_id") else "",
                "text": (s.text if hasattr(s, "text") else str(s))[:100],
            }
            for s in (result.sources or [])[:5]
        ]
    except Exception as e:
        stats["memory_error"] = str(e)

    # Count embeddings via a broad search
    try:
        from services.embedder import embed_query
        vec = embed_query("clothing")
        results = client.embeddings.search(
            tenant_id=settings.hydradb_tenant_id,
            sub_tenant_id=sub_tenant,
            query_embedding=vec,
            limit=100,
            output_fields=["source_id", "score", "distance", "metadata"],
        )
        stats["embeddings"] = len(results)
        stats["embedding_sample"] = [
            {
                "source_id": r.source_id if hasattr(r, "source_id") else "",
                "score": r.score if hasattr(r, "score") else None,
                "metadata": r.metadata if hasattr(r, "metadata") else {},
            }
            for r in results[:5]
        ]
    except Exception as e:
        stats["embedding_error"] = str(e)

    return stats
