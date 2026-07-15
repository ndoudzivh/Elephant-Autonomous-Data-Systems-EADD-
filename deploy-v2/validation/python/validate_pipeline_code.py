"""
EADD Validation Gate — Working Reference Implementation

This is the CONCRETE contract for what validate_pipeline_code() must do.
Not a spec — actual executable code that catches real bugs.

Four checks, ordered cheapest → most expensive:
1. check_syntax         — py_compile equivalent (fails fast)
2. check_api_calls_exist — AST-parse → verify methods exist on real classes
3. check_execution_with_mocks — run code against mocked infra (moto/SQLite)
4. check_claims_match_code — verify "incremental"/"idempotent" claims are real

Usage:
    result = validate_pipeline_code(generated_code, claims=["incremental", "idempotent"])
    if not result.passed:
        # Don't return to user — attempt self-correction or report failure
"""

import ast
import sys
import io
import importlib
import inspect
import traceback
from typing import List, Dict, Optional, Callable, Any
from dataclasses import dataclass, field


@dataclass
class CheckResult:
    name: str
    passed: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    passed: bool
    checks: List[CheckResult] = field(default_factory=list)
    corrected_code: Optional[str] = None
    attempts: int = 1
    failure_message: Optional[str] = None

    def summary(self) -> str:
        failed = [c for c in self.checks if not c.passed]
        if not failed:
            return "All checks passed."
        parts = []
        for c in failed:
            parts.append(f"[{c.name}] {'; '.join(c.errors[:3])}")
        return "\n".join(parts)



# ============================================================
# CHECK 1: SYNTAX (cheapest — fails fast)
# ============================================================

def check_syntax(code: str) -> CheckResult:
    """
    Equivalent to `python -m py_compile`.
    Catches SyntaxError, IndentationError before anything else runs.
    """
    errors = []
    try:
        compile(code, "<generated>", "exec")
    except SyntaxError as e:
        errors.append(f"Line {e.lineno}: {e.msg}")
    except Exception as e:
        errors.append(f"Compilation error: {str(e)}")

    return CheckResult(name="syntax", passed=len(errors) == 0, errors=errors)


# ============================================================
# CHECK 2: API CALLS EXIST (catches hallucinated methods)
# ============================================================

# Known hook/client classes and their REAL methods
# This is what catches .generate_url() when the real method is .generate_presigned_url()
KNOWN_CLASSES = {
    # boto3 S3
    "S3Hook": {
        "module": "airflow.providers.amazon.aws.hooks.s3",
        "methods": [
            "load_file", "load_string", "load_bytes", "load_file_obj",
            "get_key", "read_key", "check_for_key", "get_bucket",
            "create_bucket", "delete_bucket", "list_keys", "list_prefixes",
            "head_object", "get_conn", "generate_presigned_url",
            "copy_object", "delete_objects",
        ],
    },
    # boto3 S3 client
    "s3_client": {
        "module": "boto3",
        "methods": [
            "put_object", "get_object", "delete_object", "list_objects_v2",
            "copy_object", "head_object", "upload_file", "upload_fileobj",
            "download_file", "download_fileobj", "create_bucket",
            "delete_bucket", "list_buckets", "generate_presigned_url",
        ],
    },
    # Glue
    "glue_client": {
        "module": "boto3",
        "methods": [
            "create_job", "start_job_run", "get_job_run", "get_job_runs",
            "get_table", "get_tables", "get_database", "get_databases",
            "create_crawler", "start_crawler", "get_crawler",
            "create_table", "update_table", "delete_table",
            "batch_create_partition", "get_partitions",
        ],
    },
    # PostgresHook
    "PostgresHook": {
        "module": "airflow.providers.postgres.hooks.postgres",
        "methods": [
            "get_conn", "get_cursor", "run", "get_records",
            "get_first", "get_pandas_df", "insert_rows",
            "bulk_load", "bulk_dump", "get_uri",
        ],
    },
    # DynamicFrame (AWS Glue)
    "GlueContext": {
        "module": "awsglue.context",
        "methods": [
            "create_dynamic_frame", "write_dynamic_frame",
            "create_dynamic_frame_from_catalog",
            "create_dynamic_frame_from_options",
            "purge_table", "purge_s3_path",
        ],
    },
}



def check_api_calls_exist(code: str) -> CheckResult:
    """
    Parse AST, find method calls on known hook/client classes,
    verify the method ACTUALLY EXISTS on that class.
    
    This catches:
    - s3_hook.generate_url()  → should be generate_presigned_url()
    - glue_client.get_table_metadata() → should be get_table()
    - postgres_hook.execute() → should be run()
    """
    errors = []
    warnings = []

    try:
        tree = ast.parse(code)
    except SyntaxError:
        # Syntax check should have caught this
        return CheckResult(name="api_calls", passed=True, errors=[])

    # Find all attribute calls: obj.method()
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            method_name = node.func.attr
            # Get the variable name being called on
            if isinstance(node.func.value, ast.Name):
                var_name = node.func.value.id
            elif isinstance(node.func.value, ast.Attribute):
                var_name = node.func.value.attr
            else:
                continue

            # Check if this variable matches a known class pattern
            for class_key, class_info in KNOWN_CLASSES.items():
                # Match by variable naming convention
                if _matches_class(var_name, class_key):
                    if method_name not in class_info["methods"]:
                        # Check if it's a common Python method (not SDK-specific)
                        if method_name not in ["close", "read", "write", "decode",
                                               "encode", "format", "strip", "split",
                                               "join", "items", "keys", "values",
                                               "append", "extend", "get", "pop",
                                               "__enter__", "__exit__"]:
                            errors.append(
                                f"'{var_name}.{method_name}()' — method '{method_name}' "
                                f"does not exist on {class_key}. "
                                f"Did you mean one of: {_suggest_method(method_name, class_info['methods'])}?"
                            )

    return CheckResult(name="api_calls", passed=len(errors) == 0, errors=errors, warnings=warnings)


def _matches_class(var_name: str, class_key: str) -> bool:
    """Check if a variable name likely refers to a known class."""
    var_lower = var_name.lower()
    key_lower = class_key.lower().replace("_", "")

    # Direct match patterns
    patterns = {
        "S3Hook": ["s3_hook", "s3hook", "hook"],
        "s3_client": ["s3_client", "s3", "client"],
        "glue_client": ["glue_client", "glue"],
        "PostgresHook": ["pg_hook", "postgres_hook", "hook"],
        "GlueContext": ["glue_context", "gluecontext", "context"],
    }

    if class_key in patterns:
        return any(p in var_lower for p in patterns[class_key])

    return key_lower in var_lower


def _suggest_method(typo: str, valid_methods: List[str]) -> str:
    """Suggest the closest valid method name."""
    # Simple prefix matching
    suggestions = [m for m in valid_methods if m.startswith(typo[:4])]
    if not suggestions:
        suggestions = [m for m in valid_methods if typo[:3] in m]
    return ", ".join(suggestions[:3]) if suggestions else "check docs"



# ============================================================
# CHECK 3: EXECUTION WITH MOCKS (the real teeth)
# ============================================================

def check_execution_with_mocks(
    code: str,
    mock_setup_fn: Optional[Callable[[], Dict[str, Any]]] = None
) -> CheckResult:
    """
    Actually RUNS the generated code against mocked infrastructure.
    
    mock_setup_fn should return a dict of mock objects to inject into
    the execution namespace (e.g., moto-backed S3 client, SQLite connection).
    
    If no mock_setup_fn provided, does a dry-run import check instead.
    """
    errors = []
    warnings = []

    if mock_setup_fn is None:
        # No mocks available — do basic importability check
        try:
            tree = ast.parse(code)
            # Check that the code at least defines expected functions/classes
            defined_names = [
                node.name for node in ast.walk(tree)
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef))
            ]
            if not defined_names:
                warnings.append("Code defines no functions or classes — may be script-only (not testable in isolation)")
        except SyntaxError:
            pass

        return CheckResult(name="execution_mocks", passed=True, errors=errors, warnings=warnings)

    # With mocks — actually execute
    try:
        mock_env = mock_setup_fn()
        exec_globals = {"__builtins__": __builtins__}
        exec_globals.update(mock_env)

        # Capture stdout/stderr
        old_stdout, old_stderr = sys.stdout, sys.stderr
        sys.stdout = io.StringIO()
        sys.stderr = io.StringIO()

        try:
            exec(code, exec_globals)
        except Exception as e:
            errors.append(f"Runtime error: {type(e).__name__}: {str(e)}")
            errors.append(f"Traceback: {traceback.format_exc()[-500:]}")
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr

    except Exception as e:
        errors.append(f"Mock setup failed: {str(e)}")

    return CheckResult(name="execution_mocks", passed=len(errors) == 0, errors=errors, warnings=warnings)



# ============================================================
# CHECK 4: CLAIMS MATCH CODE (stops false advertising)
# ============================================================

def check_claims_match_code(code: str, claims: List[str] = None) -> CheckResult:
    """
    If the agent claims "incremental" or "idempotent", verify the code
    actually implements that property. Stops the agent from lying.
    
    Claims checked:
    - "incremental" → must have WHERE col > watermark (not SELECT *)
    - "idempotent" → must have MERGE/UPSERT or INSERT ... ON CONFLICT
    - "partitioned" → must have partitionBy or PARTITION BY
    - "tested" → must have assert/test/expect statements
    """
    if not claims:
        return CheckResult(name="claims_match", passed=True)

    errors = []
    code_lower = code.lower()

    for claim in claims:
        claim_lower = claim.lower()

        if claim_lower == "incremental":
            # Must have a watermark/filter — not just SELECT *
            has_watermark = any([
                "where" in code_lower and (">" in code_lower or "updated_at" in code_lower or "modified" in code_lower),
                "is_incremental()" in code_lower,
                "watermark" in code_lower,
                "last_run" in code_lower,
                "max(" in code_lower and "where" in code_lower,
            ])
            has_select_star_only = (
                "select *" in code_lower and
                "where" not in code_lower and
                "is_incremental" not in code_lower
            )

            if not has_watermark or has_select_star_only:
                errors.append(
                    "Claim 'incremental' but code appears to do a full refresh "
                    "(no WHERE clause with watermark/timestamp filter found). "
                    "Either implement actual incremental logic or describe as 'full_refresh'."
                )

        elif claim_lower == "idempotent":
            has_idempotent = any([
                "merge" in code_lower,
                "upsert" in code_lower,
                "on conflict" in code_lower,
                "insert overwrite" in code_lower,
                "replace" in code_lower,
                "if not exists" in code_lower,
                "create or replace" in code_lower,
                "mode(\"overwrite\")" in code_lower,
                "mode('overwrite')" in code_lower,
            ])

            if not has_idempotent:
                errors.append(
                    "Claim 'idempotent' but code uses INSERT/append without "
                    "MERGE, UPSERT, ON CONFLICT, or overwrite mode. "
                    "Running twice would create duplicates."
                )

        elif claim_lower == "partitioned":
            has_partition = any([
                "partitionby" in code_lower.replace(" ", ""),
                "partition by" in code_lower,
                "partition_by" in code_lower,
            ])

            if not has_partition:
                errors.append(
                    "Claim 'partitioned' but no partitionBy/PARTITION BY found in code."
                )

        elif claim_lower == "tested":
            has_tests = any([
                "assert " in code_lower,
                "test_" in code_lower,
                "unittest" in code_lower,
                "pytest" in code_lower,
                "expect(" in code_lower,
            ])

            if not has_tests:
                errors.append(
                    "Claim 'tested' but no test assertions found in code."
                )

    return CheckResult(name="claims_match", passed=len(errors) == 0, errors=errors)



# ============================================================
# MAIN: validate_pipeline_code()
# ============================================================

def validate_pipeline_code(
    code: str,
    claims: List[str] = None,
    mock_setup_fn: Optional[Callable] = None,
    max_retries: int = 1,
    fix_fn: Optional[Callable[[str, List[CheckResult]], str]] = None,
) -> ValidationResult:
    """
    Main validation entry point. Runs all 4 checks in order.
    
    If validation fails and fix_fn is provided, attempts one self-correction.
    If it fails twice, returns failure with details (never returns broken code).
    
    Args:
        code: Generated Python code to validate
        claims: List of properties the agent claims (e.g., ["incremental", "idempotent"])
        mock_setup_fn: Optional function that returns mock environment for execution
        max_retries: Number of self-correction attempts (default 1)
        fix_fn: Function that takes (code, failed_checks) and returns corrected code
    
    Returns:
        ValidationResult with pass/fail, check details, and optional corrected code
    """
    attempts = 0
    current_code = code

    for attempt in range(max_retries + 1):
        attempts += 1
        checks = []

        # Run checks in order (cheapest first)
        # 1. Syntax
        syntax_result = check_syntax(current_code)
        checks.append(syntax_result)
        if not syntax_result.passed:
            # No point running other checks if syntax is broken
            if attempt < max_retries and fix_fn:
                current_code = fix_fn(current_code, checks)
                continue
            break

        # 2. API calls exist
        api_result = check_api_calls_exist(current_code)
        checks.append(api_result)

        # 3. Execution with mocks
        exec_result = check_execution_with_mocks(current_code, mock_setup_fn)
        checks.append(exec_result)

        # 4. Claims match code
        claims_result = check_claims_match_code(current_code, claims)
        checks.append(claims_result)

        # All passed?
        all_passed = all(c.passed for c in checks)

        if all_passed:
            return ValidationResult(
                passed=True,
                checks=checks,
                corrected_code=current_code if current_code != code else None,
                attempts=attempts,
            )

        # Failed — attempt fix if we have retries left
        if attempt < max_retries and fix_fn:
            current_code = fix_fn(current_code, checks)
            continue

    # All attempts exhausted — return failure
    failed_checks = [c for c in checks if not c.passed]
    failure_parts = []
    for c in failed_checks:
        failure_parts.append(f"**{c.name}**: {'; '.join(c.errors[:2])}")

    return ValidationResult(
        passed=False,
        checks=checks,
        corrected_code=current_code if current_code != code else None,
        attempts=attempts,
        failure_message=(
            "The generated code could not be verified:\n" +
            "\n".join(failure_parts) +
            "\n\nThese issues must be resolved before deployment."
        ),
    )


# ============================================================
# CONVENIENCE: Run from command line
# ============================================================

if __name__ == "__main__":
    # Example usage
    test_code = '''
import boto3
from airflow import DAG
from datetime import datetime

s3_hook = S3Hook()
url = s3_hook.generate_url("my-bucket", "my-key")  # BUG: should be generate_presigned_url

with DAG("test", start_date=datetime(2024,1,1), catchup=False) as dag:
    pass
'''

    result = validate_pipeline_code(
        test_code,
        claims=["incremental"],
    )

    print(f"Passed: {result.passed}")
    print(f"Attempts: {result.attempts}")
    for check in result.checks:
        status = "✅" if check.passed else "❌"
        print(f"  {status} {check.name}: {check.errors if check.errors else 'OK'}")

    if result.failure_message:
        print(f"\n{result.failure_message}")
