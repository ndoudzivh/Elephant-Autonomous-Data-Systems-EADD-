"""
EADD Performance Tests - Pipeline SLA Validation
Ensures pipeline operations complete within defined SLAs.
"""

import pytest
import time
import requests
import os

API_BASE = os.getenv("API_BASE_URL", "https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com")


# ============================================================
# SLA Definitions
# ============================================================

SLA_HEALTH_CHECK_MS = 2000      # Health check < 2s
SLA_CHAT_FIRST_TOKEN_MS = 5000  # First AI token < 5s
SLA_CHAT_COMPLETE_MS = 60000    # Full response < 60s


# ============================================================
# Performance Tests
# ============================================================

class TestAPIPerformance:
    """Test API response times against SLAs."""

    def test_health_check_latency(self):
        """Health endpoint must respond within SLA."""
        start = time.time()
        resp = requests.get(f"{API_BASE}/api/health", timeout=10)
        elapsed_ms = (time.time() - start) * 1000

        assert resp.status_code == 200
        assert elapsed_ms < SLA_HEALTH_CHECK_MS, (
            f"Health check took {elapsed_ms:.0f}ms (SLA: {SLA_HEALTH_CHECK_MS}ms)"
        )

    def test_chat_first_token_latency(self):
        """First AI response token must arrive within SLA."""
        start = time.time()
        resp = requests.post(
            f"{API_BASE}/api/agent/chat",
            json={"message": "hi", "conversation_id": "perf-test"},
            headers={"Content-Type": "application/json"},
            timeout=30,
            stream=True,
        )

        first_token_time = None
        for line in resp.iter_lines():
            if line:
                decoded = line.decode("utf-8")
                if "content_delta" in decoded:
                    first_token_time = (time.time() - start) * 1000
                    break

        assert first_token_time is not None, "No content received"
        assert first_token_time < SLA_CHAT_FIRST_TOKEN_MS, (
            f"First token at {first_token_time:.0f}ms (SLA: {SLA_CHAT_FIRST_TOKEN_MS}ms)"
        )

    def test_concurrent_requests(self):
        """API must handle 5 concurrent requests."""
        import concurrent.futures

        def make_request():
            start = time.time()
            resp = requests.get(f"{API_BASE}/api/health", timeout=10)
            return resp.status_code, (time.time() - start) * 1000

        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(make_request) for _ in range(5)]
            results = [f.result() for f in futures]

        # All should succeed
        assert all(status == 200 for status, _ in results)
        # Average latency should be reasonable
        avg_latency = sum(lat for _, lat in results) / len(results)
        assert avg_latency < SLA_HEALTH_CHECK_MS * 2
