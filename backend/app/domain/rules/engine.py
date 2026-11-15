"""
Pure rule engine: (inputs, outlook_snapshot, rule_pack) -> plan + rule_ids_fired.
No I/O, no clock, no randomness. Deterministic for NFR-REP-01.
Evaluation follows SRS 5.2 pipeline order.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

SEASON_GATE_SCORES = {"best": 4, "good": 3, "conditional": 2, "risky": 1, "excluded": 0}


@dataclass
class EngineInputs:
    previous_crops: list[str]  # most recent first
    soil_type: str
    goal: str
    flags: list[str]
    moisture_class: str
    season: str  # "A" or "B"
    seasons_requested: int = 4
    language: str = "en"


@dataclass
class Alternative:
    crop: str
    rationale: str
    rationale_key: str


@dataclass
class Warning:
    code: str
    message: str
    message_key: str


@dataclass
class SeasonResult:
    season_index: int
    season: str
    crop: str
    window_start: str
    window_end: str
    rationale: str
    rationale_key: str
    alternatives: list[Alternative]
    warnings: list[Warning]
    rule_ids: list[str]
    fallback: bool
    locked: bool


@dataclass
class EngineTrace:
    season_index: int
    candidates: list[dict[str, Any]]


@dataclass
class EngineResult:
    seasons: list[SeasonResult]
    rule_ids_fired: list[str]
    trace: list[EngineTrace]


def run_engine(
    inputs: EngineInputs,
    pack: dict[str, Any],
    outlook_snapshot: dict[str, Any] | None = None,
    year_offset: int = 0,
) -> EngineResult:
    """
    Run the rotation engine for `inputs.seasons_requested` seasons.
    Returns a deterministic plan with rationale and rule IDs.
    """
    all_crops = _all_crops(pack)
    families = pack["families"]
    crop_to_family = {c: fam for fam, crops in families.items() for c in crops}
    seasons_sequence = _build_season_sequence(inputs.season, inputs.seasons_requested)
    season_windows = pack["seasons"]
    messages = pack.get("messages", {})

    results: list[SeasonResult] = []
    all_rule_ids: list[str] = []
    trace: list[EngineTrace] = []

    # Track cassava blocks: {season_index: True} means cassava is locked
    cassava_locked_until: int = -1
    previous_crops = list(inputs.previous_crops)  # mutable copy

    for idx, season_letter in enumerate(seasons_sequence):
        window = season_windows[season_letter]
        year = 2027 + year_offset + (idx // 2)

        # Step 3: start with all crops as candidates
        candidates: dict[str, float] = {c: 0.0 for c in all_crops}
        rule_ids_this_season: list[str] = []
        warnings_map: dict[str, list[Warning]] = {c: [] for c in all_crops}
        excluded: dict[str, str | None] = {}  # crop -> rule_id that excluded it

        # Cassava block (HR-09): if cassava was chosen and blocks are active
        if idx <= cassava_locked_until:
            # All non-cassava crops are excluded; cassava is locked
            for c in list(candidates.keys()):
                if c != "cassava":
                    excluded[c] = "HR-09"
            rule_ids_this_season.append("HR-09")
            # Force cassava
            result = _make_season_result(
                idx, season_letter, "cassava", window, year,
                "HR-09", "hr09.cassava_block", [], [], rule_ids_this_season,
                fallback=False, locked=True, messages=messages, lang=inputs.language,
            )
            results.append(result)
            all_rule_ids.extend(rule_ids_this_season)
            trace.append(EngineTrace(idx, _build_trace(candidates, excluded)))
            previous_crops.insert(0, "cassava")
            continue

        # Step 4: hard rules
        prev_crop = previous_crops[0] if previous_crops else None
        prev_family = crop_to_family.get(prev_crop or "", "")

        for rule in pack.get("hard_rules", []):
            rid = rule["id"]
            when = rule.get("when", {})
            action = rule["action"]

            triggered = _eval_condition(when, inputs, prev_crop, prev_family)
            if not triggered:
                continue

            rule_ids_this_season.append(rid)

            if action == "exclude_family":
                fam = rule.get("family", "")
                for c in families.get(fam, []):
                    if c not in excluded:
                        excluded[c] = rid

            elif action == "exclude_crop":
                crop = rule.get("crop", "")
                if crop == "__gate__":
                    # Handled in step 5
                    pass
                elif crop and crop not in excluded:
                    excluded[crop] = rid

            elif action == "block_seasons":
                # Cassava block: handled above via cassava_locked_until
                pass

        # Rotation rule: never repeat the previous crop (cassava is locked separately).
        if prev_crop and prev_crop != "cassava" and prev_crop in candidates:
            excluded.setdefault(prev_crop, "SAME_CROP")

        # Step 5: season gate
        gate = pack.get("season_gate", {})
        for c in all_crops:
            if c in excluded:
                continue
            crop_gate = gate.get(c, {})
            gate_val = crop_gate.get(season_letter, "good")
            if gate_val == "excluded":
                excluded[c] = "HR-08"
                if "HR-08" not in rule_ids_this_season:
                    rule_ids_this_season.append("HR-08")

        # Step 6: soil constraints (hard rules already cover soil-specific exclusions)

        # Step 7: moisture gate
        mg = pack.get("moisture_gate", {}).get(inputs.moisture_class, {})
        for c in mg.get("exclude", []):
            if c not in excluded:
                excluded[c] = f"HR-0{6 if inputs.moisture_class == 'dry' else 7}"
                rule_ids_this_season.append(
                    "HR-06" if inputs.moisture_class == "dry" else "HR-07"
                )
        for c in mg.get("warn", []):
            if c not in excluded:
                wkey = f"moisture.{inputs.moisture_class}.warn"
                msg = _msg(messages, wkey, inputs.language,
                           f"Caution: {c} in {inputs.moisture_class} conditions.")
                warnings_map[c].append(Warning(wkey, msg, wkey))

        # Step 8: flags (soft rules)
        for rule in pack.get("soft_rules", []):
            rid = rule["id"]
            when = rule.get("when", {})
            if not _eval_condition(when, inputs, prev_crop, prev_family):
                continue
            rule_ids_this_season.append(rid)
            action = rule["action"]
            if action == "reduce_priority":
                target_crop = rule.get("crop")
                target_family = rule.get("family")
                delta = rule.get("delta", -1.0)
                for c in all_crops:
                    if c in excluded:
                        continue
                    if target_crop and c == target_crop:
                        candidates[c] += delta
                    elif target_family and crop_to_family.get(c) == target_family:
                        candidates[c] += delta
            elif action == "add_warning":
                wkey = rule.get("warning_key", rid)
                msg = _msg(messages, wkey, inputs.language, wkey)
                target_family = rule.get("family")
                for c in all_crops:
                    if c not in excluded and target_family and crop_to_family.get(c) == target_family:
                        warnings_map[c].append(Warning(wkey, msg, wkey))

        # Step 9: rank survivors by goal
        goal_weights = pack.get("goal_weights", {}).get(inputs.goal, {})
        moisture_prefer = set(mg.get("prefer", []))

        survivors = [c for c in all_crops if c not in excluded]

        def _score(c: str) -> float:
            base = goal_weights.get(c, 1.0)
            gate_val = gate.get(c, {}).get(season_letter, "good")
            gate_bonus = SEASON_GATE_SCORES.get(gate_val, 2) * 0.5
            moisture_bonus = 1.0 if c in moisture_prefer else 0.0
            # Lookup bonus: prefer crops from next_crop_lookup for prev_crop
            lookup = pack.get("next_crop_lookup", {})
            lookup_list = lookup.get(prev_crop or "other", [])
            lookup_bonus = (len(lookup_list) - lookup_list.index(c)) * 0.1 if c in lookup_list else 0.0
            soft_delta = candidates[c]
            return base + gate_bonus + moisture_bonus + lookup_bonus + soft_delta

        ranked = sorted(survivors, key=lambda c: (_score(c), c), reverse=True)

        # Step 10: choose top + up to 2 alternatives
        if not ranked:
            # Fallback (FR-ROT-08)
            fallback_crop = pack.get("fallback_crop", "sorghum")
            rationale_key = "rationale.fallback"
            rationale = _msg(messages, rationale_key, inputs.language, "Safe fallback crop.")
            result = _make_season_result(
                idx, season_letter, fallback_crop, window, year,
                "FALLBACK", rationale_key, [], [], rule_ids_this_season,
                fallback=True, locked=False, messages=messages, lang=inputs.language,
            )
            results.append(result)
            all_rule_ids.extend(rule_ids_this_season)
            trace.append(EngineTrace(idx, _build_trace(candidates, excluded)))
            previous_crops.insert(0, fallback_crop)
            continue

        chosen = ranked[0]
        alts_raw = ranked[1:3]

        # Determine rationale
        gate_val = gate.get(chosen, {}).get(season_letter, "good")
        goal_key = f"rationale.goal_{inputs.goal}"
        season_key = f"rationale.{gate_val}_season"
        rationale_key = goal_key if goal_weights.get(chosen, 0) >= 2.5 else season_key
        rationale = _msg(messages, rationale_key, inputs.language, f"Recommended for {inputs.goal}.")

        alternatives = [
            Alternative(
                crop=a,
                rationale=_msg(messages, f"rationale.{gate.get(a, {}).get(season_letter, 'good')}_season",
                                inputs.language, f"Alternative: {a}"),
                rationale_key=f"rationale.{gate.get(a, {}).get(season_letter, 'good')}_season",
            )
            for a in alts_raw
        ]

        result = _make_season_result(
            idx, season_letter, chosen, window, year,
            rationale_key, rationale_key, alternatives, warnings_map.get(chosen, []),
            rule_ids_this_season, fallback=False, locked=False,
            messages=messages, lang=inputs.language,
        )
        results.append(result)
        all_rule_ids.extend(rule_ids_this_season)
        trace.append(EngineTrace(idx, _build_trace(candidates, excluded)))

        # Cassava block: if chosen is cassava, lock next 2 seasons
        if chosen == "cassava":
            cassava_locked_until = idx + 1  # blocks the next season too

        previous_crops.insert(0, chosen)

    return EngineResult(
        seasons=results,
        rule_ids_fired=list(dict.fromkeys(all_rule_ids)),  # deduplicated, ordered
        trace=trace,
    )


def _eval_condition(
    when: dict[str, Any],
    inputs: EngineInputs,
    prev_crop: str | None,
    prev_family: str,
) -> bool:
    for key, value in when.items():
        if key == "flag" and value not in inputs.flags:
            return False
        if key == "soil_type" and inputs.soil_type != value:
            return False
        if key == "moisture_class" and inputs.moisture_class != value:
            return False
        if key == "previous_crop_family" and prev_family != value:
            return False
        if key == "previous_crop" and prev_crop != value:
            return False
    return True


def _all_crops(pack: dict[str, Any]) -> list[str]:
    crops: list[str] = []
    for family_crops in pack["families"].values():
        crops.extend(family_crops)
    return crops


def _build_season_sequence(start: str, count: int) -> list[str]:
    seq = []
    current = start
    for _ in range(count):
        seq.append(current)
        current = "B" if current == "A" else "A"
    return seq


def _msg(messages: dict[str, Any], key: str, lang: str, fallback: str) -> str:
    entry = messages.get(key, {})
    if isinstance(entry, dict):
        return entry.get(lang) or entry.get("en") or fallback
    return fallback


def _make_season_result(
    idx: int,
    season: str,
    crop: str,
    window: dict[str, str],
    year: int,
    rule_id: str,
    rationale_key: str,
    alternatives: list[Alternative],
    warnings: list[Warning],
    rule_ids: list[str],
    fallback: bool,
    locked: bool,
    messages: dict[str, Any],
    lang: str,
) -> SeasonResult:
    rationale = _msg(messages, rationale_key, lang, f"Recommended: {crop}")
    return SeasonResult(
        season_index=idx,
        season=season,
        crop=crop,
        window_start=f"{year}-{window['plant_from']}",
        window_end=f"{year}-{window['plant_to']}",
        rationale=rationale,
        rationale_key=rationale_key,
        alternatives=alternatives,
        warnings=warnings,
        rule_ids=list(dict.fromkeys(rule_ids)),
        fallback=fallback,
        locked=locked,
    )


def _build_trace(
    candidates: dict[str, float], excluded: dict[str, str | None]
) -> list[dict[str, Any]]:
    return [
        {
            "crop": c,
            "score": score,
            "excluded": c in excluded,
            "reason_rule": excluded.get(c),
        }
        for c, score in sorted(candidates.items(), key=lambda x: x[1], reverse=True)
    ]

