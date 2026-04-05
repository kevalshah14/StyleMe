from fastapi import APIRouter

from auth import create_token, generate_user_id
from models.user import UserLogin, UserRegister, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


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
