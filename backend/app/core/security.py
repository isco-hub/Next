from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.settings import get_settings

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "exp": expire,
        "jti": str(uuid.uuid4()),
        **(extra or {}),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def create_refresh_token(subject: str, session_id: str) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days)
    payload = {
        "sub": subject,
        "sid": session_id,
        "type": "refresh",
        "exp": expire,
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Invalid token") from exc


def hash_msisdn(phone: str) -> str:
    """HMAC-SHA256 of the normalised phone number using the pepper."""
    settings = get_settings()
    normalised = _normalise_phone(phone)
    return hmac.new(
        settings.msisdn_pepper.encode(),
        normalised.encode(),
        digestmod=hashlib.sha256,
    ).hexdigest()


def encrypt_msisdn(phone: str) -> str:
    """Fernet-encrypt the normalised phone number for reversible storage."""
    from cryptography.fernet import Fernet
    import base64

    settings = get_settings()
    # Derive a 32-byte Fernet key from the secret_key
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    f = Fernet(key)
    normalised = _normalise_phone(phone)
    return f.encrypt(normalised.encode()).decode()


def decrypt_msisdn(encrypted: str) -> str:
    """Decrypt a Fernet-encrypted MSISDN."""
    from cryptography.fernet import Fernet
    import base64

    settings = get_settings()
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    f = Fernet(key)
    return f.decrypt(encrypted.encode()).decode()


def _normalise_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        digits = "256" + digits[1:]
    return digits


def generate_otp() -> str:
    import secrets

    return str(secrets.randbelow(900000) + 100000)


def is_ugandan_number(phone: str) -> bool:
    digits = _normalise_phone(phone)
    return digits.startswith("256") and len(digits) == 12

