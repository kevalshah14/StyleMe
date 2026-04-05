import os

from dotenv.main import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="StyleMe API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/segment")
async def segment(
    file: UploadFile = File(...),
    prompts: str = Form(""),
    conf: float = Form(0.60),
    annotate: bool = Form(False),
) -> dict:
    """Upload an image; SAM 3 uses the fixed text concept \"clothes\" (empty `prompts` form field). Results below min confidence are dropped (see segmentor.MIN_CONFIDENCE). Set annotate=true to label each segment with Gemini (GEMINI_API_KEY)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Expected an image file (e.g. image/jpeg, image/png).")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")

    import segmentor

    try:
        parsed = segmentor.parse_prompts_param(prompts)
        return segmentor.segment_image(
            data,
            mime_type=file.content_type,
            prompts=parsed,
            conf=conf,
            annotate=annotate,
        )
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

    import segmentor
    import outfit_tryon

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
