"""Gemini embedding-001 — 768-dim vectors for garments and queries."""

from google import genai
from google.genai import types

from config import settings

_client: genai.Client | None = None

EMBEDDING_MODEL = "gemini-embedding-001"
DIMENSIONS = settings.embedding_dimensions  # 768


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def embed_garment(garment: dict) -> list[float]:
    """Generate 768-dim embedding for a garment."""
    from services.ingest import build_embedding_text
    text = build_embedding_text(garment)
    client = _get_client()
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
    """Generate 768-dim embedding for a search query."""
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
