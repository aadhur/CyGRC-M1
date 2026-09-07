from uuid import UUID

from app.db.models import UserRole
from pydantic import BaseModel, EmailStr, Field


class InviteRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Temporary initial password")
    role: UserRole = Field(
        examples=["compliance_manager"], description="Role assigned to the invited user"
    )


class InviteResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    role: UserRole
    message: str


class DeleteUserResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    message: str


class UserResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    role: str = Field(..., examples=["compliance_manager"])
    status: str

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int = Field(..., examples=[1])
    message: str | None = None
