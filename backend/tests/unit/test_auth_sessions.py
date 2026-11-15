"""Unit tests for the authentication token/session contract."""
from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.api.v1.auth import _session_response, _user_dict
from app.core.security import create_refresh_token, decode_token, hash_token
from app.core.settings import get_settings
from app.db.models import User


@pytest.fixture(autouse=True)
def _settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SECRET_KEY", "a" * 32)
    monkeypatch.setenv("MSISDN_PEPPER", "b" * 32)
    get_settings.cache_clear()


def _user() -> User:
    return User(
        id="user-1",
        msisdn_hash="hash",
        msisdn_encrypted="encrypted",
        role="extension_officer",
        display_name="Test Officer",
        language="en",
        district_id="lira",
        subcounty_ids=["lira.lira"],
    )


def test_refresh_token_carries_session_id() -> None:
    token = create_refresh_token("user-1", "session-1")
    payload = decode_token(token)
    assert payload["sub"] == "user-1"
    assert payload["sid"] == "session-1"
    assert payload["type"] == "refresh"
    assert hash_token(token) == hash_token(token)
    assert hash_token(token) != token


def test_user_payload_has_no_phone_or_secret() -> None:
    payload = _user_dict(_user())
    assert payload["role"] == "extension_officer"
    assert "msisdn_hash" not in payload
    assert "msisdn_encrypted" not in payload


def test_session_response_has_access_and_refresh_tokens() -> None:
    response = _session_response(
        _user(),
        "session-1",
        "refresh-token",
        datetime.now(UTC),
    )
    assert response["token"] == response["access_token"]
    assert response["refresh_token"] == "refresh-token"
    assert response["token_type"] == "bearer"
    assert decode_token(response["token"])["sid"] == "session-1"
