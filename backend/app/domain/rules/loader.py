from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import jsonschema
import yaml

_SCHEMA_PATH = Path(__file__).parent.parent.parent.parent / "rulepacks" / "schema.json"
_PACKS_DIR = Path(__file__).parent.parent.parent.parent / "rulepacks"

_schema: dict[str, Any] | None = None


def _get_schema() -> dict[str, Any]:
    global _schema
    if _schema is None:
        _schema = json.loads(_SCHEMA_PATH.read_text())
    return _schema


def load_pack(yaml_text: str) -> dict[str, Any]:
    """Parse and validate a rule pack YAML. Raises ValueError on failure."""
    try:
        pack = yaml.safe_load(yaml_text)
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML parse error: {exc}") from exc

    try:
        jsonschema.validate(pack, _get_schema())
    except jsonschema.ValidationError as exc:
        raise ValueError(f"Schema validation failed: {exc.message}") from exc

    _check_referential_integrity(pack)
    return pack


def compute_hash(yaml_text: str) -> str:
    return hashlib.sha256(yaml_text.encode()).hexdigest()


def _check_referential_integrity(pack: dict[str, Any]) -> None:
    all_crops: set[str] = set()
    for crops in pack["families"].values():
        all_crops.update(crops)

    # Every crop in season_gate must exist in families
    for crop in pack.get("season_gate", {}):
        if crop not in all_crops:
            raise ValueError(f"season_gate references unknown crop: {crop}")

    # Every message key referenced in rules must exist in messages
    messages = pack.get("messages", {})
    for rule in pack.get("hard_rules", []) + pack.get("soft_rules", []):
        for key_field in ("rationale_key", "warning_key"):
            key = rule.get(key_field)
            if key and key not in messages:
                raise ValueError(f"Rule {rule['id']} references missing message key: {key}")

    # Fallback crop must exist
    fallback = pack.get("fallback_crop")
    if fallback and fallback not in all_crops:
        raise ValueError(f"fallback_crop '{fallback}' not in any family")

    # Disclaimer key must exist
    disclaimer_key = pack.get("disclaimer_key")
    if disclaimer_key and disclaimer_key not in messages:
        raise ValueError(f"disclaimer_key '{disclaimer_key}' not in messages")


def load_published_pack() -> dict[str, Any]:
    """Load the currently published pack from the rulepacks directory."""
    candidates = sorted(_PACKS_DIR.glob("*.yaml"), reverse=True)
    for path in candidates:
        if path.name == "schema.json":
            continue
        try:
            return load_pack(path.read_text())
        except ValueError:
            continue
    raise RuntimeError("No valid rule pack found in rulepacks/")

