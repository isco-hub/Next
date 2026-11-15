"""
BE-502: Translation management.
- Approval flag per language per key
- English fallback marker
- Length and encoding checks (140 chars for rationale, 160 for SMS)
- Catalogue build endpoint for web, USSD and SMS
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.v1.deps import CurrentUser, require_roles
from app.channels.sms import count_segments, detect_encoding
from app.core.errors import ValidationAppError
from app.domain.rules.loader import load_published_pack

router = APIRouter()

_MAX_RATIONALE_CHARS = 140
_MAX_SMS_CHARS = 160
_MAX_USSD_CHARS = 160
_SUPPORTED_LANGUAGES = ["en", "laj"]


class TranslationCheckResult(BaseModel):
    key: str
    language: str
    text: str
    char_count: int
    encoding: str
    approved: bool
    issues: list[str]


@router.get("/admin/translations/check")
async def check_translations(
    user: CurrentUser = Depends(require_roles("agronomist", "admin")),
) -> dict:
    """
    Validate all message keys in the published pack for length and encoding.
    Returns per-key results with any issues flagged.
    """
    pack = load_published_pack()
    messages = pack.get("messages", {})
    results: list[dict] = []
    total_issues = 0

    for key, translations in messages.items():
        for lang in _SUPPORTED_LANGUAGES:
            text = translations.get(lang) or translations.get("en", "")
            issues: list[str] = []

            if not translations.get(lang):
                if lang != "en":
                    issues.append(f"Missing {lang} translation — English fallback will be used")

            encoding = detect_encoding(text)
            char_count = len(text)

            # Rationale keys: max 140 chars
            if any(k in key for k in ("rationale", "hr0", "sr0")):
                if char_count > _MAX_RATIONALE_CHARS:
                    issues.append(f"Exceeds {_MAX_RATIONALE_CHARS} char rationale limit ({char_count})")

            # SMS keys: max 160 chars GSM-7 or 70 UCS-2
            if key.startswith("sms."):
                _, _, segments = count_segments(text)
                if segments > 1:
                    issues.append(f"SMS message spans {segments} segments — aim for 1")

            # USSD keys: max 160 chars
            if "ussd" in key and char_count > _MAX_USSD_CHARS:
                issues.append(f"Exceeds {_MAX_USSD_CHARS} USSD char limit ({char_count})")

            total_issues += len(issues)
            results.append({
                "key": key,
                "language": lang,
                "text": text,
                "char_count": char_count,
                "encoding": encoding,
                "approved": len(issues) == 0,
                "issues": issues,
            })

    return {
        "total_keys": len(messages),
        "total_issues": total_issues,
        "results": results,
    }


@router.get("/admin/translations/catalogue")
async def build_catalogue(
    channel: str = "web",
    language: str = "en",
    user: CurrentUser = Depends(require_roles("agronomist", "admin")),
) -> dict:
    """
    Build a flat key→text catalogue for a given channel and language.
    Used by web, USSD and SMS renderers.
    """
    if language not in _SUPPORTED_LANGUAGES:
        raise ValidationAppError(f"Unsupported language: {language}. Use: {_SUPPORTED_LANGUAGES}")
    if channel not in ("web", "ussd", "sms"):
        raise ValidationAppError("channel must be web, ussd or sms")

    pack = load_published_pack()
    messages = pack.get("messages", {})
    catalogue: dict[str, str] = {}

    for key, translations in messages.items():
        text = translations.get(language) or translations.get("en", "")
        # Filter by channel relevance
        if channel == "sms" and not key.startswith("sms.") and not key.startswith("rationale"):
            continue
        if channel == "ussd" and key.startswith("sms."):
            continue
        catalogue[key] = text

    # Also include SMS i18n catalogue
    if channel == "sms":
        from app.channels.sms import _load_templates
        sms_templates = _load_templates()
        for key, translations in sms_templates.items():
            text = translations.get(language) or translations.get("en", "")
            catalogue[key] = text

    return {
        "channel": channel,
        "language": language,
        "pack_version": pack.get("version", "unknown"),
        "catalogue": catalogue,
    }

