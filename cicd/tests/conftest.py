"""
EADD Test Configuration
Shared fixtures and configuration for all test suites.
"""

import pytest
import os


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line("markers", "unit: Unit tests (fast, no external deps)")
    config.addinivalue_line("markers", "integration: Integration tests (requires running services)")
    config.addinivalue_line("markers", "performance: Performance/SLA tests")
    config.addinivalue_line("markers", "data_quality: Data quality framework tests")


@pytest.fixture(scope="session")
def environment():
    """Get the test environment."""
    return os.getenv("TEST_ENVIRONMENT", "dev")


@pytest.fixture(scope="session")
def api_base_url():
    """Get the API base URL for the test environment."""
    urls = {
        "dev": "https://uaj2bmeq1c.execute-api.us-east-1.amazonaws.com",
        "staging": os.getenv("STAGING_API_URL", ""),
        "production": os.getenv("PRODUCTION_API_URL", ""),
    }
    env = os.getenv("TEST_ENVIRONMENT", "dev")
    return urls.get(env, urls["dev"])
