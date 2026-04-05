from fastapi import APIRouter

from config import settings

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "gemini": "configured" if settings.gemini_api_key else "missing key",
        "hydradb": "configured" if settings.hydradb_api_key else "missing key",
    }
