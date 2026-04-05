import base64
import io
import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from PIL import Image

from auth import get_current_user
from config import settings
from models.garment import GarmentUploadResponse
from services.scraper import scrape_clothing

router = APIRouter(prefix="/api", tags=["upload"])


def compress_image(image_bytes: bytes, max_size: int = 1024) -> str:
    """Compress and resize image, return base64."""
    img = Image.open(io.BytesIO(image_bytes))
    img.thumbnail((max_size, max_size), Image.LANCZOS)

    if img.mode == "RGBA":
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


@router.post("/upload", response_model=list[GarmentUploadResponse])
async def upload_photos(
    files: list[UploadFile] = File(...),
    user: dict = Depends(get_current_user),
):
    """Upload clothing photos and extract metadata with Gemini Vision."""
    results = []

    for f in files[: settings.max_upload_images]:
        raw_bytes = await f.read()
        image_b64 = compress_image(raw_bytes, settings.image_max_size_px)

        extracted = await scrape_clothing(image_b64)
        garment_id = str(uuid.uuid4())

        results.append(
            GarmentUploadResponse(
                garment_id=garment_id,
                image_base64=f"data:image/jpeg;base64,{image_b64}",
                extracted=extracted,
            )
        )

    return results
