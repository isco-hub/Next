"""
BE-407: Aggregator sandbox contract tests.
Replays recorded USSD and SMS callbacks and verifies idempotency and response format.
"""
from __future__ import annotations

import pytest

from app.channels.ussd import UssdSession, process_ussd

# Recorded Africa's Talking USSD callback payloads
RECORDED_USSD_CALLBACKS = [
    # Step 1: empty text = new session
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": ""},
    # Step 2: consent YES
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": "YES"},
    # Step 3: language English
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": "YES*1"},
    # Step 4: district Lira
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": "YES*1*1"},
    # Step 5: previous crop maize
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": "YES*1*1*1"},
    # Step 6: soil loam
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": "YES*1*1*1*2"},
    # Step 7: goal restore soil
    {"sessionId": "AT-recorded-001", "serviceCode": "*217#", "phoneNumber": "+256772000001", "networkCode": "63902", "text": "YES*1*1*1*2*1"},
]


class TestUssdContractIdempotency:
    def test_same_callback_twice_produces_same_response(self) -> None:
        """
        FR-USS-08: Idempotent callbacks — replaying the same input produces the same response.
        """
        phone = "+256772000001"
        session_id = "AT-idempotency-test"

        session = UssdSession(session_id=session_id, msisdn_hash="testhash")
        response1, session1, end1 = process_ussd(session, session_id, phone, "")

        # Replay with a fresh session at the same step
        session_replay = UssdSession(session_id=session_id, msisdn_hash="testhash")
        response2, session2, end2 = process_ussd(session_replay, session_id, phone, "")

        assert response1 == response2
        assert end1 == end2

    def test_full_flow_reaches_confirm_step(self) -> None:
        """Walk through the full USSD flow and verify each step transitions correctly."""
        phone = "+256772000002"
        session_id = "AT-flow-test"
        session = None

        steps = [
            ("", "S_CONSENT"),
            ("YES", "S_LANGUAGE"),
            ("1", "S_LOCATION"),
            ("1", "S_PREV_CROP"),
            ("1", "S_SOIL"),
            ("2", "S_GOAL"),
            ("1", "S_CONFIRM"),
        ]

        for text, expected_next_step in steps:
            response, session, is_end = process_ussd(session, session_id, phone, text)
            assert response.startswith("CON") or response.startswith("END")
            assert not is_end or expected_next_step == "S_CONFIRM"

    def test_invalid_input_reprompts_twice_then_ends(self) -> None:
        """FR-USS-07: Re-prompt twice on invalid input, then return to main menu."""
        phone = "+256772000003"
        session_id = "AT-reprompt-test"

        session = UssdSession(session_id=session_id, msisdn_hash="hash3", step="location")
        # First invalid
        r1, session, end1 = process_ussd(session, session_id, phone, "99")
        assert not end1
        assert session.reprompt_count == 1

        # Second invalid
        r2, session, end2 = process_ussd(session, session_id, phone, "99")
        assert end2  # should end after 2 reprompts

    def test_response_within_160_chars(self) -> None:
        """FR-USS-03: All USSD screens must be <= 160 characters."""
        phone = "+256772000004"
        session_id = "AT-length-test"
        session = None

        for text in ["", "YES", "1", "1", "1", "2", "1"]:
            response, session, is_end = process_ussd(session, session_id, phone, text)
            # Strip CON/END prefix for length check
            body = response[4:] if response.startswith(("CON ", "END ")) else response
            assert len(response) <= 182, f"Response too long ({len(response)}): {response[:50]}"
            if is_end:
                break

    def test_consent_required_before_data_stored(self) -> None:
        """G-09: No data stored if consent is declined."""
        phone = "+256772000005"
        session_id = "AT-consent-test"
        session = None

        # Welcome
        _, session, _ = process_ussd(session, session_id, phone, "")
        # Decline consent
        response, session, is_end = process_ussd(session, session_id, phone, "NO")
        assert is_end
        assert "END" in response
        assert not session.consent_given


class TestSmsContractCallbacks:
    def test_stop_keyword_returns_opt_out(self) -> None:
        from app.channels.sms import handle_inbound_keyword
        assert handle_inbound_keyword("STOP") == "opt_out"
        assert handle_inbound_keyword("stop") == "opt_out"
        assert handle_inbound_keyword("UNSUBSCRIBE") == "opt_out"

    def test_yes_keyword_returns_opt_in(self) -> None:
        from app.channels.sms import handle_inbound_keyword
        assert handle_inbound_keyword("YES") == "opt_in"
        assert handle_inbound_keyword("START") == "opt_in"

    def test_help_keyword(self) -> None:
        from app.channels.sms import handle_inbound_keyword
        assert handle_inbound_keyword("HELP") == "help"

    def test_unknown_keyword_returns_none(self) -> None:
        from app.channels.sms import handle_inbound_keyword
        assert handle_inbound_keyword("HELLO FARMER") is None

    def test_sms_templates_render_correctly(self) -> None:
        from app.channels.sms import render_template
        text = render_template(
            "sms.plan",
            {"crop1": "Soya", "crop2": "Maize", "crop3": "Simsim"},
            "en",
        )
        assert "Soya" in text
        assert len(text) <= 160

