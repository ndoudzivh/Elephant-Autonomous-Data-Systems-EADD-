"""
EADD Unit Tests - ETL Transformation Logic
Tests core data transformation functions in isolation.
Platform-agnostic: tests pure Python logic, not cloud services.
"""

import pytest
from datetime import datetime, date


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def sample_records():
    """Sample raw records for testing transformations."""
    return [
        {"id": 1, "name": "John Doe", "email": "john@example.com", "amount": 100.50, "created_at": "2026-01-15"},
        {"id": 2, "name": "Jane Smith", "email": "jane@test.com", "amount": 250.00, "created_at": "2026-01-16"},
        {"id": 3, "name": "Bob Wilson", "email": None, "amount": -10.00, "created_at": "2026-01-17"},
        {"id": 1, "name": "John Doe", "email": "john@example.com", "amount": 100.50, "created_at": "2026-01-15"},  # duplicate
    ]


@pytest.fixture
def schema_definition():
    """Expected schema for validation."""
    return {
        "id": {"type": "integer", "nullable": False},
        "name": {"type": "string", "nullable": False},
        "email": {"type": "string", "nullable": True},
        "amount": {"type": "float", "nullable": False},
        "created_at": {"type": "date", "nullable": False},
    }


# ============================================================
# Transformation Functions (to be tested)
# ============================================================

def deduplicate_records(records, key_columns):
    """Remove duplicate records based on key columns."""
    seen = set()
    unique = []
    for record in records:
        key = tuple(record.get(col) for col in key_columns)
        if key not in seen:
            seen.add(key)
            unique.append(record)
    return unique


def filter_nulls(records, required_columns):
    """Separate records with nulls in required columns."""
    valid, quarantined = [], []
    for record in records:
        has_null = any(record.get(col) is None for col in required_columns)
        if has_null:
            quarantined.append({**record, "_quarantine_reason": "null_in_required_field"})
        else:
            valid.append(record)
    return valid, quarantined


def validate_ranges(records, range_rules):
    """Validate numeric fields are within expected ranges."""
    valid, failed = [], []
    for record in records:
        is_valid = True
        for col, (min_val, max_val) in range_rules.items():
            val = record.get(col)
            if val is not None and (val < min_val or val > max_val):
                is_valid = False
                failed.append({**record, "_quarantine_reason": f"{col} out of range [{min_val},{max_val}]"})
                break
        if is_valid:
            valid.append(record)
    return valid, failed


def calculate_quality_score(total, passed):
    """Calculate data quality score (0-100%)."""
    if total == 0:
        return 100.0
    return round((passed / total) * 100, 2)


def apply_scd2(existing, incoming, business_key, tracked_columns):
    """Apply SCD Type 2 logic (simplified)."""
    changes = []
    for record in incoming:
        key = record[business_key]
        existing_record = next((r for r in existing if r[business_key] == key), None)
        if existing_record is None:
            changes.append({**record, "_scd_action": "insert", "is_current": True})
        else:
            has_change = any(record.get(col) != existing_record.get(col) for col in tracked_columns)
            if has_change:
                changes.append({**existing_record, "_scd_action": "expire", "is_current": False})
                changes.append({**record, "_scd_action": "insert", "is_current": True})
    return changes


# ============================================================
# Unit Tests
# ============================================================

class TestDeduplication:
    def test_removes_exact_duplicates(self, sample_records):
        result = deduplicate_records(sample_records, ["id"])
        assert len(result) == 3  # 4 records → 3 unique by id

    def test_composite_key_dedup(self):
        records = [
            {"a": 1, "b": "x", "c": 100},
            {"a": 1, "b": "y", "c": 200},
            {"a": 1, "b": "x", "c": 300},  # duplicate on (a, b)
        ]
        result = deduplicate_records(records, ["a", "b"])
        assert len(result) == 2

    def test_no_duplicates_unchanged(self):
        records = [{"id": 1}, {"id": 2}, {"id": 3}]
        result = deduplicate_records(records, ["id"])
        assert len(result) == 3

    def test_empty_input(self):
        result = deduplicate_records([], ["id"])
        assert result == []


class TestNullFiltering:
    def test_filters_null_required_fields(self, sample_records):
        valid, quarantined = filter_nulls(sample_records, ["email"])
        assert len(quarantined) == 1
        assert quarantined[0]["id"] == 3

    def test_all_valid(self):
        records = [{"id": 1, "name": "test"}]
        valid, quarantined = filter_nulls(records, ["id", "name"])
        assert len(valid) == 1
        assert len(quarantined) == 0

    def test_quarantine_includes_reason(self, sample_records):
        _, quarantined = filter_nulls(sample_records, ["email"])
        assert "_quarantine_reason" in quarantined[0]


class TestRangeValidation:
    def test_rejects_out_of_range(self, sample_records):
        rules = {"amount": (0, 1000)}
        valid, failed = validate_ranges(sample_records, rules)
        assert len(failed) == 1  # -10.00 is out of range
        assert failed[0]["id"] == 3

    def test_all_in_range(self):
        records = [{"amount": 50}, {"amount": 100}]
        valid, failed = validate_ranges(records, {"amount": (0, 200)})
        assert len(valid) == 2
        assert len(failed) == 0


class TestQualityScoring:
    def test_perfect_score(self):
        assert calculate_quality_score(100, 100) == 100.0

    def test_zero_records(self):
        assert calculate_quality_score(0, 0) == 100.0

    def test_95_percent(self):
        assert calculate_quality_score(100, 95) == 95.0

    def test_below_threshold(self):
        score = calculate_quality_score(100, 89)
        assert score < 90  # Would trigger FAIL


class TestSCD2:
    def test_new_record_inserts(self):
        existing = []
        incoming = [{"id": 1, "name": "John", "email": "j@t.com"}]
        changes = apply_scd2(existing, incoming, "id", ["name", "email"])
        assert len(changes) == 1
        assert changes[0]["_scd_action"] == "insert"
        assert changes[0]["is_current"] is True

    def test_changed_record_creates_new_version(self):
        existing = [{"id": 1, "name": "John", "email": "old@t.com"}]
        incoming = [{"id": 1, "name": "John", "email": "new@t.com"}]
        changes = apply_scd2(existing, incoming, "id", ["name", "email"])
        assert len(changes) == 2
        assert changes[0]["_scd_action"] == "expire"
        assert changes[1]["_scd_action"] == "insert"

    def test_unchanged_record_no_action(self):
        existing = [{"id": 1, "name": "John", "email": "j@t.com"}]
        incoming = [{"id": 1, "name": "John", "email": "j@t.com"}]
        changes = apply_scd2(existing, incoming, "id", ["name", "email"])
        assert len(changes) == 0
