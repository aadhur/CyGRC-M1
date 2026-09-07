from __future__ import annotations
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class ControlResponse(BaseModel):
    control_id: UUID
    framework_id: UUID
    code: str
    title: str
    description: str
    owner: UUID
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True
