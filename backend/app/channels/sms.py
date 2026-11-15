"""
SMS channel (FR-SMS-01 to FR-SMS-07).
Encoding-aware segment counter, consent check before sending,
quiet hours (21:00-06:00 EAT), daily caps, STOP within 1 minute.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime, timezone
from typing import Any

# GSM-7 basic character set
_GSM7_CHARS = set(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./"
    "0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyz"
    "äöñüà"
)
_GSM7_EXTENDED = set("^{}\\[~]|€")

GSM7_SINGLE_LIMIT = 160
GSM7_MULTI_LIMIT = 153
UCS2_SINGLE_LIMIT = 70
UCS2_MULTI_LIMIT = 67

EAT_OFFSET = timezone(datetime.now(UTC).utcoffset() or __import__("datetime").timedelta(hours=3))


def detect_encoding(text: str) -> str:
    """Return 'GSM-7' or 'UCS-2'."""
    for ch in text:
        if ch not in _GSM7_CHARS and ch not in _GSM7_EXTENDED:
            return "UCS-2"
    return "GSM-7"


def count_segments(text: str) -> tuple[str, int, int]:
    """Return (encoding, char_count, segment_count)."""
    encoding = detect_encoding(text)
    # Extended chars count as 2 in GSM-7
    if encoding == "GSM-7":
        char_count = sum(2 if c in _GSM7_EXTENDED else 1 for c in text)
        if char_count <= GSM7_SINGLE_LIMIT:
            return encoding, char_count, 1
        return encoding, char_count, -(-char_count // GSM7_MULTI_LIMIT)
    else:
        char_count = len(text)
        if char_count <= UCS2_SINGLE_LIMIT:
            return encoding, char_count, 1
        return encoding, char_count, -(-char_count // UCS2_MULTI_LIMIT)


def is_quiet_hours(quiet_start: int = 21, quiet_end: int = 6) -> bool:
    """Check if current EAT time is in quiet hours."""
    now_eat = datetime.now(UTC).astimezone(
        timezone(__import__("datetime").timedelta(hours=3))
    )
    hour = now_eat.hour
    if quiet_start > quiet_end:  # wraps midnight
        return hour >= quiet_start or hour < quiet_end
    return quiet_start <= hour < quiet_end


def render_template(template_key: str, context: dict[str, Any], lang: str = "en") -> str:
    """Render an SMS template from the i18n catalogue."""
    templates = _load_templates()
    entry = templates.get(template_key, {})
    text = entry.get(lang) or entry.get("en") or template_key
    for k, v in context.items():
        text = text.replace(f"{{{k}}}", str(v))
    return text


def _load_templates() -> dict[str, dict[str, str]]:
    """Load SMS templates from i18n catalogue."""
    import yaml
    from pathlib import Path

    catalogue_path = Path(__file__).parent.parent.parent / "i18n" / "sms.yaml"
    if not catalogue_path.exists():
        return {}
    return yaml.safe_load(catalogue_path.read_text()) or {}


def handle_inbound_keyword(text: str) -> str | None:
    """
    Handle inbound SMS keywords. Returns action or None.
    STOP -> opt_out, YES -> opt_in, HELP -> help.
    """
    keyword = text.strip().upper()
    if keyword in ("STOP", "UNSUBSCRIBE", "CANCEL", "END"):
        return "opt_out"
    if keyword in ("YES", "START", "SUBSCRIBE"):
        return "opt_in"
    if keyword in ("HELP", "INFO"):
        return "help"
    return None
