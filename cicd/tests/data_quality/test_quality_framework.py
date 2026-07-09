"""
EADD Data Quality Testing Framework
Universal quality checks that work across all platforms.
Implements scoring: >=95 pass, 90-94 warn, <90 fail.
"""

import pytest
from dataclasses import dataclass
from typing import List, Dict, Any
import re


# ============================================================
# Quality Framework
# ============================================================

@dataclass
class QualityResult:
    check_name: str
    passed: int
    failed: int
    total: int
    score: float
    status: str  # PASS, WARN, FAIL
    details: List[str]


class DataQualityFramework:
    """Platform-agnostic data quality engine."""

    PASS_THRESHOLD = 95
    WARN_THRESHOLD = 90

    def __init__(self, records: List[Dict[str, Any]]):
        self.records = records
        self.results: List[QualityResult] = []

    def check_nulls(self, columns: List[str]) -> QualityResult:
        """Check for null values in specified columns."""
        total = len(self.records) * len(columns)
        failed = 0
        details = []
        for col in columns:
            nulls = sum(1 for r in self.records if r.get(col) is None)
            if nulls > 0:
                failed += nulls
                details.append(f"{col}: {nulls} nulls")
        return self._build_result("null_check", total, total - failed, details)

    def check_uniqueness(self, columns: List[str]) -> QualityResult:
        """Check for duplicate values in key columns."""
        total = len(self.records)
        seen = set()
        duplicates = 0
        for record in self.records:
            key = tuple(record.get(c) for c in columns)
            if key in seen:
                duplicates += 1
            seen.add(key)
        details = [f"{duplicates} duplicates on {columns}"] if duplicates else []
        return self._build_result("uniqueness", total, total - duplicates, details)

    def check_schema(self, expected: Dict[str, str]) -> QualityResult:
        """Validate data types match expected schema."""
        total = len(self.records) * len(expected)
        failed = 0
        details = []
        type_map = {"integer": int, "float": (int, float), "string": str}
        for record in self.records:
            for col, expected_type in expected.items():
                val = record.get(col)
                if val is not None:
                    py_type = type_map.get(expected_type)
                    if py_type and not isinstance(val, py_type):
                        failed += 1
                        details.append(f"{col}: expected {expected_type}, got {type(val).__name__}")
        return self._build_result("schema_validation", total, total - failed, details[:5])

    def check_patterns(self, column: str, pattern: str) -> QualityResult:
        """Validate values match regex pattern."""
        total = sum(1 for r in self.records if r.get(column) is not None)
        regex = re.compile(pattern)
        failed = 0
        for record in self.records:
            val = record.get(column)
            if val is not None and not regex.match(str(val)):
                failed += 1
        details = [f"{failed} values don't match pattern {pattern}"] if failed else []
        return self._build_result(f"pattern_{column}", total, total - failed, details)

    def check_ranges(self, column: str, min_val=None, max_val=None) -> QualityResult:
        """Validate numeric values within range."""
        total = sum(1 for r in self.records if r.get(column) is not None)
        failed = 0
        for record in self.records:
            val = record.get(column)
            if val is not None:
                if min_val is not None and val < min_val:
                    failed += 1
                elif max_val is not None and val > max_val:
                    failed += 1
        details = [f"{failed} values outside [{min_val}, {max_val}]"] if failed else []
        return self._build_result(f"range_{column}", total, total - failed, details)

    def get_overall_score(self) -> Dict[str, Any]:
        """Calculate overall quality score across all checks."""
        if not self.results:
            return {"score": 100.0, "status": "PASS", "checks": 0}
        total_score = sum(r.score for r in self.results) / len(self.results)
        status = "PASS" if total_score >= self.PASS_THRESHOLD else "WARN" if total_score >= self.WARN_THRESHOLD else "FAIL"
        return {
            "score": round(total_score, 2),
            "status": status,
            "checks": len(self.results),
            "passed": sum(1 for r in self.results if r.status == "PASS"),
            "warned": sum(1 for r in self.results if r.status == "WARN"),
            "failed": sum(1 for r in self.results if r.status == "FAIL"),
        }

    def _build_result(self, name, total, passed, details) -> QualityResult:
        score = (passed / total * 100) if total > 0 else 100.0
        status = "PASS" if score >= self.PASS_THRESHOLD else "WARN" if score >= self.WARN_THRESHOLD else "FAIL"
        result = QualityResult(name, passed, total - passed, total, round(score, 2), status, details)
        self.results.append(result)
        return result


# ============================================================
# Tests for the Quality Framework
# ============================================================

@pytest.fixture
def good_data():
    return [
        {"id": i, "name": f"User {i}", "email": f"user{i}@test.com", "amount": float(i * 10)}
        for i in range(1, 101)
    ]


@pytest.fixture
def bad_data():
    records = [
        {"id": i, "name": f"User {i}", "email": f"user{i}@test.com", "amount": float(i * 10)}
        for i in range(1, 91)
    ]
    # Add 10 bad records (10% failure rate)
    for i in range(91, 101):
        records.append({"id": i, "name": None, "email": "bad-email", "amount": -100.0})
    return records


class TestNullChecks:
    def test_no_nulls_passes(self, good_data):
        qf = DataQualityFramework(good_data)
        result = qf.check_nulls(["id", "name"])
        assert result.status == "PASS"
        assert result.score == 100.0

    def test_some_nulls_detected(self, bad_data):
        qf = DataQualityFramework(bad_data)
        result = qf.check_nulls(["name"])
        assert result.failed == 10
        assert result.status == "WARN"  # 90% pass rate


class TestUniqueness:
    def test_all_unique(self, good_data):
        qf = DataQualityFramework(good_data)
        result = qf.check_uniqueness(["id"])
        assert result.score == 100.0

    def test_duplicates_detected(self):
        records = [{"id": 1}, {"id": 2}, {"id": 1}]
        qf = DataQualityFramework(records)
        result = qf.check_uniqueness(["id"])
        assert result.failed == 1


class TestPatternValidation:
    def test_valid_emails(self, good_data):
        qf = DataQualityFramework(good_data)
        result = qf.check_patterns("email", r"^[^@]+@[^@]+\.[^@]+$")
        assert result.score == 100.0

    def test_invalid_emails_detected(self, bad_data):
        qf = DataQualityFramework(bad_data)
        result = qf.check_patterns("email", r"^[^@]+@[^@]+\.[^@]+$")
        assert result.failed > 0


class TestRangeValidation:
    def test_all_in_range(self, good_data):
        qf = DataQualityFramework(good_data)
        result = qf.check_ranges("amount", min_val=0)
        assert result.score == 100.0

    def test_negative_detected(self, bad_data):
        qf = DataQualityFramework(bad_data)
        result = qf.check_ranges("amount", min_val=0)
        assert result.failed == 10


class TestOverallScoring:
    def test_good_data_passes(self, good_data):
        qf = DataQualityFramework(good_data)
        qf.check_nulls(["id", "name"])
        qf.check_uniqueness(["id"])
        qf.check_ranges("amount", min_val=0)
        overall = qf.get_overall_score()
        assert overall["status"] == "PASS"
        assert overall["score"] >= 95

    def test_bad_data_fails(self, bad_data):
        qf = DataQualityFramework(bad_data)
        qf.check_nulls(["name"])
        qf.check_ranges("amount", min_val=0)
        qf.check_patterns("email", r"^[^@]+@[^@]+\.[^@]+$")
        overall = qf.get_overall_score()
        assert overall["status"] in ["WARN", "FAIL"]
