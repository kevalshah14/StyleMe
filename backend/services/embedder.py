"""Gemini text-embedding-004 embedding generation for garments and queries."""

from google import genai
from google.genai import types

from config import settings

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


EMBEDDING_MODEL = "gemini-embedding-001"
DIMENSIONS = settings.embedding_dimensions  # 768


def build_embedding_text(garment: dict) -> str:
    """Combine description + structured attributes for rich embedding."""
    parts = [
        garment.get("description", ""),
        f"Type: {garment.get('garment_type', '')} ({garment.get('sub_type', '')}).",
        f"Color: {garment.get('primary_color', '')}.",
        f"Pattern: {garment.get('pattern', '')}.",
        f"Material: {garment.get('material_estimate', '')}.",
        f"Formality: {garment.get('formality_level', 5)}/10.",
        f"Seasons: {', '.join(garment.get('season', []))}.",
        f"Style: {', '.join(garment.get('style_tags', []))}.",
        f"Good for: {', '.join(garment.get('occasion_fit', []))}.",
        f"Pairs well with: {', '.join(garment.get('pairs_well_with', []))}.",
    ]
    return " ".join(parts)


def embed_garment(garment: dict) -> list[float]:
    """Generate 768-dim embedding for a garment using SEMANTIC_SIMILARITY task type."""
    client = _get_client()
    text = build_embedding_text(garment)
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=types.EmbedContentConfig(
            task_type="SEMANTIC_SIMILARITY",
            output_dimensionality=DIMENSIONS,
        ),
    )
    return list(result.embeddings[0].values)


def embed_query(query: str) -> list[float]:
    """Generate 768-dim embedding for a search/event query using RETRIEVAL_QUERY task type."""
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=query,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=DIMENSIONS,
        ),
    )
    return list(result.embeddings[0].values)


def batch_embed_garments(garments: list[dict]) -> list[list[float]]:
    """Batch embed multiple garments."""
    client = _get_client()
    texts = [build_embedding_text(g) for g in garments]
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=texts,
        config=types.EmbedContentConfig(
            task_type="SEMANTIC_SIMILARITY",
            output_dimensionality=DIMENSIONS,
        ),
    )
    return [list(e.values) for e in result.embeddings]
