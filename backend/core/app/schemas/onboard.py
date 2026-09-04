from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserRole(str, Enum):
    ADMIN = "admin"
    USER = "user"


class OnboardRequest(BaseModel):
    name: str
    plan: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.USER


class OnboardResponse(BaseModel):
    tenant_id: UUID
    user_id: UUID
    status: str
    message: str
    access_token: str
