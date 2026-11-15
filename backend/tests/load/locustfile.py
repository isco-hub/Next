"""
BE-604: Load tests with Locust.
Targets:
- 50 rps on POST /v1/recommendations (NFR-PERF-01)
- 200 concurrent USSD sessions (NFR-PERF-02, NFR-PERF-05)
- p95 < 500ms for recommendations, p95 < 1500ms for USSD

Run:
  locust -f tests/load/locustfile.py --host=http://localhost:8000 \
         --users=200 --spawn-rate=20 --run-time=120s --headless
"""
from __future__ import annotations

import random
import uuid

from locust import HttpUser, between, task

CROPS = ["maize", "sorghum", "soya", "groundnut", "bean", "cowpea", "simsim", "sunflower", "other"]
SOILS = ["sandy", "loam", "clay", "unknown"]
GOALS = ["restore_soil", "max_cash", "drought_survival"]
FLAGS = ["striga", "armyworm", "low_fertility"]
DISTRICTS = ["lira", "dokolo", "amolatar", "otuke", "alebtong"]
PHONES = [f"+25677{random.randint(1000000, 9999999)}" for _ in range(500)]


class RecommendationUser(HttpUser):
    """Simulates web PWA users requesting crop recommendations."""
    wait_time = between(0.5, 2.0)

    @task(5)
    def get_recommendation(self) -> None:
        payload = {
            "previous_crops": [random.choice(CROPS)],
            "soil_type": random.choice(SOILS),
            "goal": random.choice(GOALS),
            "flags": random.sample(FLAGS, k=random.randint(0, 2)),
            "seasons": 4,
            "language": "en",
            "channel": "web",
            "district_id": random.choice(DISTRICTS),
        }
        headers = {"Idempotency-Key": str(uuid.uuid4())}
        with self.client.post(
            "/v1/recommendations",
            json=payload,
            headers=headers,
            catch_response=True,
        ) as response:
            if response.status_code not in (200, 201):
                response.failure(f"Unexpected status: {response.status_code}")

    @task(2)
    def get_outlook(self) -> None:
        district = random.choice(DISTRICTS)
        self.client.get(f"/v1/outlook?district_id={district}")

    @task(1)
    def health_check(self) -> None:
        self.client.get("/v1/health")


class UssdUser(HttpUser):
    """Simulates USSD sessions through the callback endpoint."""
    wait_time = between(1.0, 3.0)

    def on_start(self) -> None:
        self.session_id = str(uuid.uuid4())
        self.phone = random.choice(PHONES)
        self.step = 0
        self.inputs = ["", "YES", "1", "1", "1", "2", "1", "1"]

    @task
    def ussd_step(self) -> None:
        if self.step >= len(self.inputs):
            self.step = 0
            self.session_id = str(uuid.uuid4())

        text = "*".join(self.inputs[: self.step + 1]) if self.step > 0 else ""
        payload = {
            "sessionId": self.session_id,
            "serviceCode": "*217#",
            "phoneNumber": self.phone,
            "networkCode": "63902",
            "text": text,
        }
        with self.client.post(
            "/v1/ussd/callback",
            json=payload,
            catch_response=True,
            name="/v1/ussd/callback",
        ) as response:
            if response.status_code != 200:
                response.failure(f"USSD failed: {response.status_code}")
            elif not (response.text.startswith("CON") or response.text.startswith("END")):
                response.failure("Invalid USSD response format")
            elif response.text.startswith("END"):
                self.step = 0
                self.session_id = str(uuid.uuid4())
                return

        self.step += 1
