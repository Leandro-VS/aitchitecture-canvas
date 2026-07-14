from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_session
from .db.models import User
from .settings import settings


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    x_dev_email: Annotated[str | None, Header()] = None,
) -> User:
    """Auth stub por e-mail — só existe com ENV=local (guarda no Settings).

    OIDC corporativo substitui esta dependency quando o deploy AWS entrar;
    a assinatura (retorna User) é o contrato que o resto do app usa.
    """
    email = (x_dev_email or settings.dev_email).lower()
    user = await session.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(email=email, name=email.split("@")[0], role="admin")
        session.add(user)
        await session.commit()
        await session.refresh(user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
