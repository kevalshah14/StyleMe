"""Segmentation endpoints — SAM 3 clothing detection + face-grounded filtering."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core.auth import get_current_user

router = APIRouter(tags=["segment"])


@router.post("/api/segment")
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

    from services.segmentor import parse_prompts_param, segment_image

    try:
        parsed = parse_prompts_param(prompts)
        return segment_image(
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


@router.post("/api/identity/enroll")
async def identity_enroll(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> dict:
    """Store a face embedding for the JWT user (local InsightFace ONNX)."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Expected an image file (e.g. image/jpeg, image/png).")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")

    from services.identity import enroll_from_image_bytes, save_user_embedding

    try:
        emb = enroll_from_image_bytes(data)
        save_user_embedding(user["user_id"], emb)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"ok": True}


@router.post("/api/segment/me")
async def segment_me(
    file: UploadFile = File(...),
    prompts: str = Form(""),
    conf: float = Form(0.60),
    annotate: bool = Form(False),
    user: dict = Depends(get_current_user),
) -> dict:
    """
    Like /api/segment but keeps only clothing masks tied to the enrolled user's face (group-photo safe).
    Requires prior POST /api/identity/enroll.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Expected an image file (e.g. image/jpeg, image/png).")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")

    from services.segmentor import parse_prompts_param, segment_image_for_enrolled_user

    try:
        parsed = parse_prompts_param(prompts)
        return segment_image_for_enrolled_user(
            user["user_id"],
            data,
            mime_type=file.content_type,
            prompts=parsed,
            conf=conf,
            annotate=annotate,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
