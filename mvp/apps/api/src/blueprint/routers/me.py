import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from ..auth import CurrentUser

router = APIRouter(tags=["auth"])


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    role: str


@router.get("/api/me")
async def me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user, from_attributes=True)
