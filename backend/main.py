"""StyleMe API — app entrypoint, CORS, router registration."""

import logging
import os

from dotenv.main import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.auth_router import router as auth_router
from routers.chat_router import router as chat_router
from routers.health_router import router as health_router
from routers.inspect_router import router as inspect_router
from routers.preferences_router import router as preferences_router
from routers.recommend_router import router as recommend_router
from routers.segment_router import router as segment_router
from routers.store_router import router as store_router
from routers.tryon_router import router as tryon_router
from routers.upload_router import router as upload_router
from routers.wardrobe_router import router as wardrobe_router

load_dotenv()

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="StyleMe API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(health_router)
app.include_router(upload_router)
app.include_router(wardrobe_router)
app.include_router(recommend_router)
app.include_router(chat_router)
app.include_router(inspect_router)
app.include_router(preferences_router)
app.include_router(segment_router)
app.include_router(store_router)
app.include_router(tryon_router)


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
