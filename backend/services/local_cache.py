"""
Local JSON cache with cluster index and semantic search.

Primary storage for wardrobe items — always available, no network dependency.
Supports:
  - Save/load/delete garments per user
  - Cluster-based grouping (upper_body, lower_body, outerwear, etc.)
  - Keyword search across all fields
  - Embedding-based semantic search (cosine similarity on stored vectors)
"""

import json
import logging
import math
from pathlib import Path

logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR.mkdir(exist_ok=True)

EMBEDDINGS_DIR = CACHE_DIR / "embeddings"
EMBEDDINGS_DIR.mkdir(exist_ok=True)


def _cache_path(user_id: str) -> Path:
    return CACHE_DIR / f"wardrobe_{user_id}.json"


def _embedding_path(user_id: str) -> Path:
    return EMBEDDINGS_DIR / f"embeddings_{user_id}.json"


# ── Basic CRUD ───────────────────────────────────────────────────────

def save_to_cache(user_id: str, garment: dict):
    """Save garment to user's local cache. Updates in-place if garment_id exists, otherwise appends."""
    items = load_cache(user_id)
    gid = garment.get("garment_id")
    if not gid:
        return

    updated = False
    for i, existing in enumerate(items):
        if existing.get("garment_id") == gid:
            items[i] = garment
            updated = True
            break

    if not updated:
        items.append(garment)

    _cache_path(user_id).write_text(json.dumps(items))

    embedding = garment.get("_embedding")
    if embedding and gid:
        save_embedding(user_id, gid, embedding)


def load_cache(user_id: str) -> list[dict]:
    """Load all cached garments for a user."""
    path = _cache_path(user_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return []


def delete_from_cache(user_id: str, garment_id: str):
    """Remove a garment from cache + its embedding."""
    items = load_cache(user_id)
    items = [i for i in items if i.get("garment_id") != garment_id]
    _cache_path(user_id).write_text(json.dumps(items))
    delete_embedding(user_id, garment_id)


# ── Embedding storage ────────────────────────────────────────────────

def save_embedding(user_id: str, garment_id: str, embedding: list[float]):
    """Store an embedding vector for a garment."""
    path = _embedding_path(user_id)
    data = _load_embeddings(user_id)
    data[garment_id] = embedding
    path.write_text(json.dumps(data))


def delete_embedding(user_id: str, garment_id: str):
    """Remove an embedding."""
    path = _embedding_path(user_id)
    data = _load_embeddings(user_id)
    data.pop(garment_id, None)
    path.write_text(json.dumps(data))


def _load_embeddings(user_id: str) -> dict[str, list[float]]:
    """Load all embeddings for a user. {garment_id: [float, ...]}."""
    path = _embedding_path(user_id)
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


# ── Cluster grouping ─────────────────────────────────────────────────

def get_clusters(user_id: str) -> dict[str, list[dict]]:
    """Group wardrobe items by cluster. Returns {cluster_id: [items]}."""
    items = load_cache(user_id)
    clusters: dict[str, list[dict]] = {}
    for item in items:
        cluster = item.get("cluster", "other")
        clusters.setdefault(cluster, []).append(item)
    return clusters


def get_cluster_summary(user_id: str) -> list[dict]:
    """Return cluster summary with counts."""
    clusters = get_clusters(user_id)
    from services.ingest import CLUSTERS
    summary = []
    for cid, items in sorted(clusters.items()):
        label = CLUSTERS.get(cid, {}).get("label", cid)
        summary.append({
            "cluster_id": cid,
            "label": label,
            "count": len(items),
            "items": [
                {"garment_id": i["garment_id"], "garment_type": i["garment_type"], "primary_color": i.get("primary_color", "")}
                for i in items
            ],
        })
    return summary


# ── Search ───────────────────────────────────────────────────────────

def search_cache(user_id: str, query: str, limit: int = 12) -> list[dict]:
    """
    Search wardrobe by keyword matching across all text fields.
    Returns items sorted by relevance (hit count).
    """
    items = load_cache(user_id)
    if not query.strip():
        return items[:limit]

    words = query.lower().split()
    scored: list[tuple[int, dict]] = []
    for item in items:
        text = " ".join([
            item.get("garment_type", ""),
            item.get("sub_type", ""),
            item.get("primary_color", ""),
            item.get("pattern", ""),
            item.get("material_estimate", ""),
            item.get("body_region", ""),
            item.get("description", ""),
            item.get("cluster", ""),
            item.get("cluster_label", ""),
            item.get("notable_details", ""),
            item.get("layering_role", ""),
            " ".join(item.get("style_tags", [])),
            " ".join(item.get("season", [])),
        ]).lower()

        hits = sum(1 for w in words if w in text)
        if hits > 0:
            scored.append((hits, item))

    scored.sort(key=lambda x: -x[0])
    return [s[1] for s in scored[:limit]]


def semantic_search(user_id: str, query_embedding: list[float], limit: int = 12) -> list[dict]:
    """
    Cosine similarity search over locally stored embeddings.
    Returns items sorted by similarity (highest first), with score attached.
    """
    items = load_cache(user_id)
    embeddings = _load_embeddings(user_id)

    if not embeddings or not query_embedding:
        return []

    scored: list[tuple[float, dict]] = []
    for item in items:
        gid = item.get("garment_id", "")
        vec = embeddings.get(gid)
        if not vec:
            continue
        sim = _cosine_similarity(query_embedding, vec)
        scored.append((sim, item))

    scored.sort(key=lambda x: -x[0])
    results = []
    for sim, item in scored[:limit]:
        enriched = {**item, "score": round(sim, 4)}
        results.append(enriched)
    return results


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
