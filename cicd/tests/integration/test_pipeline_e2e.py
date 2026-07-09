"""
EADD Integration Tests - End-to-End Pipeline Validation
Tests complete pipeline execution across environments.
"""

import pytest
import os
import json
import requests


# ============================================================
# Configuration
# ============================================================

ENVIRONMENT = os.getenv("TEST_ENVIRONMENT", "dev")
API_BASE = os.getenv("API_BASE_URL", "https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com")


# ============================================================
# Integration Tests
# ============================================================

class TestAPIHealth:
    """Verify backend API is responding."""

    def test_health_endpoint(self):
        resp = requests.get(f"{API_BASE}/api/health", timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert "services" in data

    def test_capabilities_endpoint(self):
        resp = requests.get(f"{API_BASE}/api/agent/capabilities", timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert "capabilities" in data
        assert len(data["capabilities"]) > 0

    def test_billing_plans(self):
        resp = requests.get(f"{API_BASE}/api/billing/plans", timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert "plans" in data
        plans = data["plans"]
        assert any(p["id"] == "free" for p in plans)
        assert any(p["id"] == "pro_monthly" for p in plans)


class TestAgentChat:
    """Test the AI agent chat endpoint."""

    def test_chat_responds(self):
        resp = requests.post(
            f"{API_BASE}/api/agent/chat",
            json={"message": "hello", "conversation_id": "test-integration"},
            headers={"Content-Type": "application/json"},
            timeout=60,
            stream=True,
        )
        assert resp.status_code == 200
        # Read SSE stream
        content = ""
        for line in resp.iter_lines():
            if line:
                decoded = line.decode("utf-8")
                if decoded.startswith("data: ") and decoded != "data: [DONE]":
                    try:
                        event = json.loads(decoded[6:])
                        if event.get("type") == "content_delta":
                            content += event.get("content", "")
                    except json.JSONDecodeError:
                        pass
        assert len(content) > 10  # AI responded with substance

    def test_chat_generates_pipeline(self):
        resp = requests.post(
            f"{API_BASE}/api/agent/chat",
            json={
                "message": "Generate a simple pipeline YAML for PostgreSQL to S3",
                "conversation_id": "test-pipeline-gen",
            },
            headers={"Content-Type": "application/json"},
            timeout=90,
            stream=True,
        )
        assert resp.status_code == 200
        content = ""
        for line in resp.iter_lines():
            if line:
                decoded = line.decode("utf-8")
                if decoded.startswith("data: ") and decoded != "data: [DONE]":
                    try:
                        event = json.loads(decoded[6:])
                        if event.get("type") == "content_delta":
                            content += event.get("content", "")
                    except json.JSONDecodeError:
                        pass
        # Should contain YAML-like content
        assert "source" in content.lower() or "pipeline" in content.lower()


class TestConversations:
    """Test conversation management."""

    def test_create_conversation(self):
        resp = requests.post(
            f"{API_BASE}/api/conversations",
            json={"title": "Integration Test Conversation"},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "id" in data

    def test_list_conversations(self):
        resp = requests.get(f"{API_BASE}/api/conversations", timeout=30)
        assert resp.status_code == 200
        data = resp.json()
        assert "items" in data
