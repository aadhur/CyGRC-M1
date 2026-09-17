from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class OnboardRequest(BaseModel):
    name: str
    plan: str
    email: EmailStr
    password: str = Field(min_length=8)


class OnboardResponse(BaseModel):
    tenant_id: UUID
    user_id: UUID
    status: str
    message: str
    access_token: str
