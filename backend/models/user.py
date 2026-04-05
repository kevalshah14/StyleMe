from pydantic import BaseModel, Field


class UserRegister(BaseModel):
    display_name: str = Field(min_length=1, max_length=50)


class UserLogin(BaseModel):
    user_id: str


class UserResponse(BaseModel):
    user_id: str
    display_name: str
    token: str
    wardrobe_count: int = 0
