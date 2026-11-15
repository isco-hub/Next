from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import decode_token

_bearer = HTTPBearer(auto_error=False)


class CurrentUser:
    def __init__(self, user_id: str, role: str, token_payload: dict) -> None:
        self.user_id = user_id
        self.role = role
        self.payload = token_payload

    def require_role(self, *roles: str) -> None:
        if self.role not in roles:
            raise ForbiddenError(f"Role '{self.role}' is not permitted for this action.")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    if credentials is None:
        raise UnauthorizedError("Authentication required.")
    try:
        payload = decode_token(credentials.credentials)
    except ValueError as exc:
        raise UnauthorizedError(str(exc)) from exc
    return CurrentUser(
        user_id=payload["sub"],
        role=payload.get("role", "farmer"),
        token_payload=payload,
    )


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser | None:
    if credentials is None:
        return None
    try:
        payload = decode_token(credentials.credentials)
        return CurrentUser(payload["sub"], payload.get("role", "farmer"), payload)
    except ValueError:
        return None


def require_roles(*roles: str):  # noqa: ANN201
    async def _dep(user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        user.require_role(*roles)
        return user
    return _dep
