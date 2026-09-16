from uuid import UUID

from app.db.models import UserRole
from fastapi import HTTPException, status
from pydantic import BaseModel, EmailStr, Field


class InviteRequest(BaseModel):
    email: EmailStr = Field(examples=["users@example.com"])
    password: str = Field(min_length=8, description="Temporary initial password")
    role: UserRole = Field(
        examples=["COMPLIANCE_MANAGER"], description="Role assigned to the invited user"
    )

    def validated_user_role(self) -> str:
        # Convert enum values to raw strings for validation
        allowed = {role.value for role in UserRole}

        if self.role.value not in allowed:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid user_role '{self.role.value}'.",
            )

        return self.role.value


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
    role: str = Field(..., examples=["USER"])
    status: str

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: list[UserResponse]
    total: int = Field(..., examples=[1])
    message: str | None = None
