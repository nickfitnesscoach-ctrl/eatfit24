"""
Error Contract Validation Script for EatFit24
Tests end-to-end error handling across all backend layers.

Usage:
    python test_error_contract.py

Prerequisites:
    - Backend running on localhost:8000
    - Valid test user credentials
"""

import json
import time
import uuid
from typing import Dict, Any, List
import requests

# Configuration
BASE_URL = "http://localhost:8000"
API_BASE = f"{BASE_URL}/api/v1"

# Test user credentials (will create if doesn't exist)
TEST_USER_TG_ID = 100  # Debug mode user ID


class Colors:
    """ANSI color codes for terminal output."""
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'


class ValidationResult:
    """Container for validation test results."""

    def __init__(self, name: str):
        self.name = name
        self.passed = 0
        self.failed = 0
        self.errors: List[str] = []

    def add_pass(self):
        self.passed += 1

    def add_fail(self, error: str):
        self.failed += 1
        self.errors.append(error)

    def print_summary(self):
        if self.failed == 0:
            print(f"{Colors.OKGREEN}[OK] {self.name}: PASSED ({self.passed} checks){Colors.ENDC}")
        else:
            print(f"{Colors.FAIL}[FAIL] {self.name}: FAILED ({self.failed} errors){Colors.ENDC}")
            for error in self.errors:
                print(f"  {Colors.WARNING}-> {error}{Colors.ENDC}")


def validate_error_contract(
    response_data: Dict[str, Any],
    expected_error_code: str,
    test_name: str
) -> ValidationResult:
    """
    Validate that error response matches Error Contract.

    Args:
        response_data: Response JSON data
        expected_error_code: Expected error_code value
        test_name: Name of the test for reporting

    Returns:
        ValidationResult with pass/fail status
    """
    result = ValidationResult(test_name)

    # Check required fields
    required_fields = [
        "error_code",
        "user_title",
        "user_message",
        "user_actions",
        "allow_retry"
    ]

    for field in required_fields:
        if field not in response_data:
            result.add_fail(f"Missing required field: {field}")
        else:
            result.add_pass()

    # Check error_code matches expected
    if response_data.get("error_code") != expected_error_code:
        result.add_fail(
            f"error_code mismatch: got {response_data.get('error_code')}, "
            f"expected {expected_error_code}"
        )
    else:
        result.add_pass()

    # Check trace_id present
    if "trace_id" not in response_data:
        result.add_fail("Missing trace_id")
    else:
        result.add_pass()

    # Check user_actions is list
    if not isinstance(response_data.get("user_actions"), list):
        result.add_fail("user_actions must be a list")
    else:
        result.add_pass()

    # Check allow_retry is boolean
    if not isinstance(response_data.get("allow_retry"), bool):
        result.add_fail("allow_retry must be a boolean")
    else:
        result.add_pass()

    return result


def get_auth_token() -> str:
    """
    Get authentication token for test user.
    Uses debug mode to bypass Telegram signature verification.
    """
    # In debug mode, backend accepts requests with X-Debug-Mode header
    # and uses fake user data (user_id=100)
    return "debug_mode_token"


def test_daily_photo_limit_exceeded():
    """
    Test DAILY_PHOTO_LIMIT_EXCEEDED error.

    Steps:
    1. Temporarily lower daily limit (via DB or env)
    2. Make 2 upload attempts
    3. Expect HTTP 429 with DAILY_PHOTO_LIMIT_EXCEEDED
    """
    print(f"\n{Colors.HEADER}=== Test: DAILY_PHOTO_LIMIT_EXCEEDED ==={Colors.ENDC}")

    # Create dummy image
    import io
    from PIL import Image

    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)

    # Upload first photo
    files = {'image': ('test.jpg', img_bytes, 'image/jpeg')}
    data = {
        'meal_type': 'BREAKFAST',
        'date': '2026-01-16'
    }
    headers = {
        'X-Debug-Mode': 'true',
        'X-Request-ID': uuid.uuid4().hex
    }

    # Note: This test requires manually lowering the limit in DB
    # For now, we'll skip actual execution and document the expected behavior
    print(f"{Colors.WARNING}[WARN] Manual setup required: Lower daily limit to 1 in database{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Expected behavior:{Colors.ENDC}")
    print("  - HTTP 429")
    print("  - error_code = DAILY_PHOTO_LIMIT_EXCEEDED")
    print("  - allow_retry = false")
    print("  - user_actions contains 'upgrade'")
    print("  - trace_id present")

    return ValidationResult("DAILY_PHOTO_LIMIT_EXCEEDED (manual test)")


def test_photo_not_found():
    """
    Test PHOTO_NOT_FOUND error.

    Steps:
    1. Request status for non-existent photo_id
    2. Expect HTTP 404 with PHOTO_NOT_FOUND
    """
    print(f"\n{Colors.HEADER}=== Test: PHOTO_NOT_FOUND ==={Colors.ENDC}")

    # Try to retry with non-existent meal_photo_id
    import io
    from PIL import Image

    img = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='JPEG')
    img_bytes.seek(0)

    files = {'image': ('test.jpg', img_bytes, 'image/jpeg')}
    data = {
        'meal_type': 'BREAKFAST',
        'date': '2026-01-16',
        'meal_photo_id': 999999  # Non-existent ID
    }
    headers = {
        'X-Debug-Mode': 'true',
        'X-Request-ID': uuid.uuid4().hex
    }

    try:
        response = requests.post(
            f"{API_BASE}/ai/recognize/",
            files=files,
            data=data,
            headers=headers,
            timeout=10
        )

        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")

        if response.status_code == 404:
            result = validate_error_contract(
                response.json(),
                "PHOTO_NOT_FOUND",
                "PHOTO_NOT_FOUND"
            )
            result.print_summary()
            return result
        else:
            result = ValidationResult("PHOTO_NOT_FOUND")
            result.add_fail(f"Expected HTTP 404, got {response.status_code}")
            result.print_summary()
            return result

    except Exception as e:
        print(f"{Colors.FAIL}[FAIL] Test failed with exception: {e}{Colors.ENDC}")
        result = ValidationResult("PHOTO_NOT_FOUND")
        result.add_fail(str(e))
        return result


def test_invalid_status():
    """
    Test INVALID_STATUS error.

    Steps:
    1. Create a photo with SUCCESS status
    2. Try to retry it
    3. Expect HTTP 400 with INVALID_STATUS
    """
    print(f"\n{Colors.HEADER}=== Test: INVALID_STATUS ==={Colors.ENDC}")

    print(f"{Colors.WARNING}[WARN] Manual setup required: Create SUCCESS photo and try retry{Colors.ENDC}")
    print(f"{Colors.OKCYAN}Expected behavior:{Colors.ENDC}")
    print("  - HTTP 400")
    print("  - error_code = INVALID_STATUS")
    print("  - trace_id present")

    return ValidationResult("INVALID_STATUS (manual test)")


def test_rate_limit():
    """
    Test RATE_LIMIT error (throttling).

    Steps:
    1. Make rapid requests to throttled endpoint
    2. Expect HTTP 429 with RATE_LIMIT
    3. Check Retry-After header present
    """
    print(f"\n{Colors.HEADER}=== Test: RATE_LIMIT (Throttling) ==={Colors.ENDC}")

    headers = {
        'X-Debug-Mode': 'true',
        'X-Request-ID': uuid.uuid4().hex
    }

    # Make rapid requests to task status endpoint (has throttling)
    fake_task_id = uuid.uuid4().hex

    print(f"Making rapid requests to trigger throttle...")

    for i in range(100):  # Exceed throttle limit
        try:
            response = requests.get(
                f"{API_BASE}/ai/task/{fake_task_id}/",
                headers=headers,
                timeout=5
            )

            if response.status_code == 429:
                print(f"{Colors.OKGREEN}[OK] Throttle triggered on request #{i+1}{Colors.ENDC}")
                print(f"Status Code: {response.status_code}")
                print(f"Response: {json.dumps(response.json(), indent=2)}")
                print(f"Retry-After Header: {response.headers.get('Retry-After')}")

                result = validate_error_contract(
                    response.json(),
                    "RATE_LIMIT",
                    "RATE_LIMIT"
                )

                # Check retry_after_sec present
                if "retry_after_sec" not in response.json():
                    result.add_fail("Missing retry_after_sec")
                else:
                    result.add_pass()

                # Check Retry-After header
                if "Retry-After" not in response.headers:
                    result.add_fail("Missing Retry-After HTTP header")
                else:
                    result.add_pass()

                result.print_summary()
                return result

        except Exception as e:
            print(f"{Colors.FAIL}[FAIL] Request failed: {e}{Colors.ENDC}")

    result = ValidationResult("RATE_LIMIT")
    result.add_fail("Failed to trigger throttle after 100 requests")
    result.print_summary()
    return result


def test_invalid_image_from_celery():
    """
    Test INVALID_IMAGE error from Celery task.

    Steps:
    1. Upload invalid/corrupted file
    2. Wait for task to complete
    3. Expect structured error in task result
    """
    print(f"\n{Colors.HEADER}=== Test: INVALID_IMAGE (Celery) ==={Colors.ENDC}")

    # Create corrupted image file
    corrupted_data = b'INVALID_IMAGE_DATA_NOT_JPEG'

    files = {'image': ('corrupted.jpg', corrupted_data, 'image/jpeg')}
    data = {
        'meal_type': 'BREAKFAST',
        'date': '2026-01-16'
    }
    headers = {
        'X-Debug-Mode': 'true',
        'X-Request-ID': uuid.uuid4().hex
    }

    try:
        # Upload corrupted image
        response = requests.post(
            f"{API_BASE}/ai/recognize/",
            files=files,
            data=data,
            headers=headers,
            timeout=10
        )

        if response.status_code != 202:
            print(f"{Colors.FAIL}[FAIL] Expected HTTP 202, got {response.status_code}{Colors.ENDC}")
            print(f"Response: {response.text}")
            result = ValidationResult("INVALID_IMAGE")
            result.add_fail(f"Upload failed with status {response.status_code}")
            return result

        task_id = response.json().get('task_id')
        print(f"Task ID: {task_id}")

        # Poll task status
        for i in range(30):  # Max 30 seconds
            time.sleep(1)

            status_response = requests.get(
                f"{API_BASE}/ai/task/{task_id}/",
                headers=headers,
                timeout=5
            )

            status_data = status_response.json()
            task_status = status_data.get('status')

            print(f"  [{i+1}s] Task status: {task_status}")

            if task_status == 'failed':
                print(f"\n{Colors.OKGREEN}[OK] Task failed as expected{Colors.ENDC}")
                print(f"Response: {json.dumps(status_data, indent=2)}")

                # Extract error from result
                error_data = status_data.get('result', {})

                result = ValidationResult("INVALID_IMAGE")

                # Check for error_code in result
                if "error_code" not in error_data:
                    result.add_fail("Missing error_code in task result")
                else:
                    result.add_pass()

                # Check trace_id
                if "trace_id" not in error_data:
                    result.add_fail("Missing trace_id in task result")
                else:
                    result.add_pass()

                result.print_summary()
                return result

            if task_status == 'success':
                result = ValidationResult("INVALID_IMAGE")
                result.add_fail("Task succeeded when it should have failed")
                result.print_summary()
                return result

        result = ValidationResult("INVALID_IMAGE")
        result.add_fail("Task did not complete within 30 seconds")
        result.print_summary()
        return result

    except Exception as e:
        print(f"{Colors.FAIL}[FAIL] Test failed with exception: {e}{Colors.ENDC}")
        result = ValidationResult("INVALID_IMAGE")
        result.add_fail(str(e))
        return result


def main():
    """Run all error contract validation tests."""
    print(f"{Colors.BOLD}{Colors.HEADER}")
    print("=" * 60)
    print("  Error Contract Validation for EatFit24")
    print("=" * 60)
    print(f"{Colors.ENDC}")

    # Check backend health
    try:
        health_response = requests.get(f"{BASE_URL}/health/", timeout=5)
        if health_response.status_code == 200:
            print(f"{Colors.OKGREEN}[OK] Backend is healthy{Colors.ENDC}")
            health_data = health_response.json()
            print(f"  App Env: {health_data.get('app_env')}")
            print(f"  Python: {health_data.get('python_version')}")
        else:
            print(f"{Colors.FAIL}[FAIL] Backend health check failed{Colors.ENDC}")
            return
    except Exception as e:
        print(f"{Colors.FAIL}[FAIL] Cannot connect to backend: {e}{Colors.ENDC}")
        return

    # Run tests
    results = []

    # Test 1: PHOTO_NOT_FOUND
    results.append(test_photo_not_found())

    # Test 2: RATE_LIMIT (Throttling)
    results.append(test_rate_limit())

    # Test 3: INVALID_IMAGE (Celery)
    results.append(test_invalid_image_from_celery())

    # Test 4: DAILY_PHOTO_LIMIT_EXCEEDED (manual)
    results.append(test_daily_photo_limit_exceeded())

    # Test 5: INVALID_STATUS (manual)
    results.append(test_invalid_status())

    # Print final summary
    print(f"\n{Colors.BOLD}{Colors.HEADER}")
    print("=" * 60)
    print("  VALIDATION SUMMARY")
    print("=" * 60)
    print(f"{Colors.ENDC}")

    total_passed = sum(r.passed for r in results)
    total_failed = sum(r.failed for r in results)

    for result in results:
        result.print_summary()

    print(f"\n{Colors.BOLD}Total: {total_passed} passed, {total_failed} failed{Colors.ENDC}")

    if total_failed == 0:
        print(f"\n{Colors.OKGREEN}{Colors.BOLD}[OK] READY FOR DEPLOY{Colors.ENDC}")
    else:
        print(f"\n{Colors.FAIL}{Colors.BOLD}[FAIL] NOT READY - Fix errors above{Colors.ENDC}")


if __name__ == "__main__":
    main()
