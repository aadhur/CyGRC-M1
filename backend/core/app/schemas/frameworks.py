from uuid import UUID

from pydantic import BaseModel


class FrameworkResponse(BaseModel):
    framework_id: UUID
    code: str
    version: str
    name: str

    model_config = {"from_attributes": True}


class FrameworkListResponse(BaseModel):
    frameworks: list[FrameworkResponse]


class FrameworkCreateRequest(BaseModel):
    code: str
    version: str
    name: str
