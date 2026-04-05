from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from core.auth import create_token, generate_user_id
from models.user import UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/onboard", response_model=UserResponse, status_code=201)
async def onboard(
    display_name: str = Form(...),
    full_body: UploadFile = File(...),
    selfie: UploadFile = File(...),
):
    """
    Create a user with JWT, store face embedding from ``selfie``, and save ``full_body`` as reference photo.
    """
    dn = (display_name or "").strip()
    if not dn or len(dn) > 50:
        raise HTTPException(status_code=400, detail="Name must be 1–50 characters.")

    if not full_body.content_type or not full_body.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Full-body photo must be an image (e.g. JPEG or PNG).")
    if not selfie.content_type or not selfie.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Selfie must be an image (e.g. JPEG or PNG).")

    fb_data = await full_body.read()
    sf_data = await selfie.read()
    if not fb_data:
        raise HTTPException(status_code=400, detail="Full-body photo is empty.")
    if not sf_data:
        raise HTTPException(status_code=400, detail="Selfie is empty.")

    user_id = generate_user_id()
    token = create_token(user_id, dn)

    from services import identity as idf
    from services import profile as up

    try:
        emb = idf.enroll_from_image_bytes(sf_data)
        idf.save_user_embedding(user_id, emb)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError:
        # insightface not available — skip face enrollment, onboarding still succeeds
        pass

    try:
        up.save_full_body_photo(user_id, fb_data, full_body.content_type)
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Could not save full-body photo: {e}") from e

    return UserResponse(user_id=user_id, display_name=dn, token=token)


@router.post("/register", response_model=UserResponse, status_code=201)
async def register(body: UserRegister):
    user_id = generate_user_id()
    token = create_token(user_id, body.display_name)
    return UserResponse(
        user_id=user_id,
        display_name=body.display_name,
        token=token,
    )


@router.post("/login", response_model=UserResponse)
async def login(body: UserLogin):
    token = create_token(body.user_id, "User")
    return UserResponse(
        user_id=body.user_id,
        display_name="User",
        token=token,
    )
