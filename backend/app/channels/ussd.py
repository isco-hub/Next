"""
USSD state machine (FR-USS-01 to FR-USS-08).
Session state lives in Redis only (key: hashed MSISDN + session_id, TTL = operator timeout).
All screens are <= 160 characters. Max 4 levels deep.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any

from app.core.security import hash_msisdn

# Screen IDs
S_WELCOME = "welcome"
S_CONSENT = "consent"
S_LANGUAGE = "language"
S_LOCATION = "location"
S_PREV_CROP = "prev_crop"
S_SOIL = "soil"
S_GOAL = "goal"
S_FLAGS = "flags"
S_CONFIRM = "confirm"
S_RESULT = "result"
S_RESULT_MORE = "result_more"
S_END = "end"

CROP_OPTIONS = [
    ("1", "maize"),
    ("2", "sorghum"),
    ("3", "finger_millet"),
    ("4", "soya"),
    ("5", "groundnut"),
    ("6", "bean"),
    ("7", "cowpea"),
    ("8", "simsim"),
    ("9", "sunflower"),
    ("0", "other"),
]

SOIL_OPTIONS = [
    ("1", "sandy"),
    ("2", "loam"),
    ("3", "clay"),
    ("4", "unknown"),
]

GOAL_OPTIONS = [
    ("1", "restore_soil"),
    ("2", "max_cash"),
    ("3", "drought_survival"),
]

DISTRICT_OPTIONS = [
    ("1", "lira"),
    ("2", "dokolo"),
    ("3", "amolatar"),
    ("4", "otuke"),
    ("5", "alebtong"),
]


@dataclass
class UssdSession:
    session_id: str
    msisdn_hash: str
    step: str = S_WELCOME
    language: str = "en"
    district_id: str = ""
    prev_crop: str = ""
    soil_type: str = ""
    goal: str = ""
    flags: list[str] = field(default_factory=list)
    reprompt_count: int = 0
    consent_given: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "msisdn_hash": self.msisdn_hash,
            "step": self.step,
            "language": self.language,
            "district_id": self.district_id,
            "prev_crop": self.prev_crop,
            "soil_type": self.soil_type,
            "goal": self.goal,
            "flags": self.flags,
            "reprompt_count": self.reprompt_count,
            "consent_given": self.consent_given,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "UssdSession":
        return cls(**data)


def session_key(msisdn_hash: str, session_id: str) -> str:
    return f"ussd:session:{msisdn_hash}:{session_id}"


def process_ussd(
    session: UssdSession | None,
    session_id: str,
    phone_number: str,
    text: str,
    recommendation_result: dict[str, Any] | None = None,
) -> tuple[str, UssdSession, bool]:
    """
    Process a USSD callback. Returns (response_text, updated_session, is_end).
    response_text starts with CON (continue) or END (terminate).
    """
    msisdn_hash = hash_msisdn(phone_number)

    if session is None:
        session = UssdSession(session_id=session_id, msisdn_hash=msisdn_hash)

    # Parse the last input (Africa's Talking sends full chain separated by *)
    parts = text.split("*") if text else [""]
    last_input = parts[-1].strip() if parts else ""

    step = session.step
    lang = session.language

    # --- WELCOME ---
    if step == S_WELCOME:
        session.step = S_CONSENT
        return _con(_t(lang, "CON Welcome to NextCrop.\nReply YES to get crop advice.\nSTOP to end.", "CON Wubone i NextCrop.\nCik YES pi nongo tam me pur.\nSTOP pi giko.")), session, False

    # --- CONSENT (G-09) ---
    if step == S_CONSENT:
        if last_input.upper() in ("YES", "1"):
            session.consent_given = True
            session.step = S_LANGUAGE
            return _con(_t(lang, "CON Choose language:\n1. English\n2. Leb Lango", "CON Yer leb:\n1. English\n2. Leb Lango")), session, False
        return _end(_t(lang, "END No data stored. Dial again anytime.", "END Pe giketo data. Cak doki kare mo.")), session, True

    # --- LANGUAGE ---
    if step == S_LANGUAGE:
        if last_input == "2":
            session.language = "laj"
            lang = "laj"
        else:
            session.language = "en"
            lang = "en"
        session.step = S_LOCATION
        opts = "\n".join(f"{k}. {v.title()}" for k, v in DISTRICT_OPTIONS)
        return _con(_t(lang, f"CON Choose district:\n{opts}", f"CON Yer aŋom:\n{opts}")), session, False

    # --- LOCATION ---
    if step == S_LOCATION:
        match = dict(DISTRICT_OPTIONS).get(last_input)
        if match:
            session.district_id = match
            session.step = S_PREV_CROP
            opts = "\n".join(f"{k}. {v.replace('_', ' ').title()}" for k, v in CROP_OPTIONS)
            return _con(_t(lang, f"CON Last crop planted:\n{opts}", f"CON Cot ma icubo nyime:\n{opts}")), session, False
        return _reprompt(session, _t(lang, "CON Invalid choice. Choose district:\n" + "\n".join(f"{k}. {v.title()}" for k, v in DISTRICT_OPTIONS), "CON Yero pe ber. Yer aŋom:"))

    # --- PREVIOUS CROP ---
    if step == S_PREV_CROP:
        match = dict(CROP_OPTIONS).get(last_input)
        if match:
            session.prev_crop = match
            session.step = S_SOIL
            opts = "\n".join(f"{k}. {v.title()}" for k, v in SOIL_OPTIONS)
            return _con(_t(lang, f"CON Soil type:\n{opts}", f"CON Kit lowo:\n{opts}")), session, False
        return _reprompt(session, _t(lang, "CON Invalid. Choose last crop:", "CON Yero pe ber. Yer cot:"))

    # --- SOIL ---
    if step == S_SOIL:
        match = dict(SOIL_OPTIONS).get(last_input)
        if match:
            session.soil_type = match
            session.step = S_GOAL
            opts = "\n".join(f"{k}. {v.replace('_', ' ').title()}" for k, v in GOAL_OPTIONS)
            return _con(_t(lang, f"CON Your main goal:\n{opts}", f"CON Dwogi madit:\n{opts}")), session, False
        return _reprompt(session, _t(lang, "CON Invalid. Choose soil type:", "CON Yero pe ber. Yer kit lowo:"))

    # --- GOAL ---
    if step == S_GOAL:
        match = dict(GOAL_OPTIONS).get(last_input)
        if match:
            session.goal = match
            session.step = S_CONFIRM
            summary = _t(
                lang,
                f"CON Confirm:\nDistrict: {session.district_id}\nLast crop: {session.prev_crop}\nSoil: {session.soil_type}\nGoal: {session.goal}\n1. Get plan\n2. Start over",
                f"CON Mok:\nAŋom: {session.district_id}\nCot: {session.prev_crop}\nLowo: {session.soil_type}\nDwog: {session.goal}\n1. Nong cik\n2. Cak odoco",
            )
            return _con(summary), session, False
        return _reprompt(session, _t(lang, "CON Invalid. Choose goal:", "CON Yero pe ber. Yer dwogi:"))

    # --- CONFIRM ---
    if step == S_CONFIRM:
        if last_input == "2":
            # Start over
            session.step = S_LOCATION
            opts = "\n".join(f"{k}. {v.title()}" for k, v in DISTRICT_OPTIONS)
            return _con(_t(lang, f"CON Choose district:\n{opts}", f"CON Yer aŋom:\n{opts}")), session, False
        if last_input == "1" and recommendation_result:
            session.step = S_RESULT
            seasons = recommendation_result.get("seasons", [])
            plan_text = _format_plan_ussd(seasons, lang)
            return _con(plan_text), session, False
        # Waiting for recommendation
        return _con(_t(lang, "CON Processing... reply 1 to continue.", "CON Tye ka tic... cik 1 pi mede.")), session, False

    # --- RESULT ---
    if step == S_RESULT:
        if last_input == "1" and recommendation_result:
            seasons = recommendation_result.get("seasons", [])
            more_text = _format_plan_ussd_more(seasons, lang)
            session.step = S_END
            return _end(more_text), session, True
        session.step = S_END
        return _end(_t(lang, "END Thank you. Dial again for a new plan.", "END Apwoyo. Cak doki pi cik manyen.")), session, True

    # Default end
    return _end(_t(lang, "END Session ended.", "END Kare giko.")), session, True


def _format_plan_ussd(seasons: list[dict[str, Any]], lang: str) -> str:
    if not seasons:
        return _t(lang, "CON No plan available. Reply 0 to end.", "CON Cik pe tye. Cik 0 pi giko.")
    s = seasons[0]
    crop = s.get("crop", "").replace("_", " ").title()
    season = s.get("season", "")
    text = _t(lang, f"CON Season {season}: Plant {crop}.\n{s.get('rationale','')[:60]}\n1. More\n0. End", f"CON Kare {season}: Cub {crop}.\n{s.get('rationale','')[:60]}\n1. Mukene\n0. Giko")
    return text[:160]


def _format_plan_ussd_more(seasons: list[dict[str, Any]], lang: str) -> str:
    lines = []
    for s in seasons[1:3]:
        crop = s.get("crop", "").replace("_", " ").title()
        lines.append(f"S{s.get('season')}: {crop}")
    body = "\n".join(lines) or "No more seasons."
    return _t(lang, f"END {body}\nAsk your extension officer for details.", f"END {body}\nBi ladit me pur pi lok mukene.")[:160]


def _t(lang: str, en: str, laj: str) -> str:
    return laj if lang == "laj" else en


def _con(text: str) -> str:
    return text if text.startswith("CON") else f"CON {text}"


def _end(text: str) -> str:
    return text if text.startswith("END") else f"END {text}"


def _reprompt(
    session: UssdSession, prompt: str
) -> tuple[str, UssdSession, bool]:
    session.reprompt_count += 1
    if session.reprompt_count >= 2:
        session.step = S_WELCOME
        session.reprompt_count = 0
        lang = session.language
        return _end(_t(lang, "END Too many invalid entries. Dial again.", "END Yero pe ber mapol. Cak doki.")), session, True
    return _con(prompt), session, False

