"""Provision a privileged NextCrop account without public self-registration.

Usage:
    python -m scripts.provision_staff \
        --phone +256770123456 --role extension_officer --name "Aciro Grace" \
        --district lira --constituency lira.erute-north --subcounty lira.adekokwok
"""
from __future__ import annotations

import argparse
import asyncio
import uuid

from sqlalchemy import select

from app.core.security import encrypt_msisdn, hash_msisdn, is_ugandan_number
from app.db.models import User
from app.db.session import _session_factory

STAFF_ROLES = ("extension_officer", "cooperative", "agronomist", "admin")


async def provision(args: argparse.Namespace) -> None:
    if not is_ugandan_number(args.phone):
        raise SystemExit("Phone must be a valid Ugandan number.")
    if args.role not in STAFF_ROLES:
        raise SystemExit(f"Role must be one of: {', '.join(STAFF_ROLES)}")

    async with _session_factory() as db:
        result = await db.execute(
            select(User).where(User.msisdn_hash == hash_msisdn(args.phone))
        )
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                id=str(uuid.uuid4()),
                msisdn_hash=hash_msisdn(args.phone),
                msisdn_encrypted=encrypt_msisdn(args.phone),
            )
            db.add(user)
        user.role = args.role
        user.display_name = args.name
        user.district_id = args.district
        user.constituency_id = args.constituency
        user.subcounty_ids = args.subcounty
        user.language = "en"
        user.approval_status = "approved"
        await db.commit()
        print(f"Provisioned {user.id} as {user.role}.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--phone", required=True)
    parser.add_argument("--role", required=True, choices=STAFF_ROLES)
    parser.add_argument("--name", required=True)
    parser.add_argument("--district", default=None)
    parser.add_argument("--constituency", default=None)
    parser.add_argument("--subcounty", action="append", default=[])
    asyncio.run(provision(parser.parse_args()))


if __name__ == "__main__":
    main()

