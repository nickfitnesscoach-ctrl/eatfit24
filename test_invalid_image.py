#!/usr/bin/env python3
"""
Test script to verify INVALID_IMAGE error is returned for corrupted images.

Usage:
    python test_invalid_image.py

Expected behavior:
    - HTTP 400
    - error_code: INVALID_IMAGE (NOT VALIDATION_ERROR)
    - trace_id present
    - allow_retry: false
    - user_actions: ["retake"]
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:8000"
ENDPOINT = "/api/v1/ai/recognize/"

# Test user credentials (use debug mode)
HEADERS = {
    "X-Debug-Mode": "true",
    "X-Debug-User-ID": "100",
}

# Corrupted image file (binary garbage)
CORRUPTED_IMAGE_PATH = "corrupted.jpg"


def create_corrupted_image():
    """Create a corrupted image file."""
    with open(CORRUPTED_IMAGE_PATH, "wb") as f:
        f.write(b"\xFF\xD8\xFF\xE0\x00\x10JFIF")  # JPEG header
        f.write(b"\x00" * 100)  # Garbage data
        f.write(b"\xFF\xD9")  # JPEG end marker (truncated/corrupted)
    print(f"[INFO] Created corrupted image: {CORRUPTED_IMAGE_PATH}")


def test_invalid_image():
    """Send corrupted image and verify error response."""
    print(f"Testing INVALID_IMAGE error on {BASE_URL}{ENDPOINT}\n")

    create_corrupted_image()

    try:
        with open(CORRUPTED_IMAGE_PATH, "rb") as img:
            files = {"image": img}
            data = {
                "meal_type": "breakfast",
                "date": "2026-01-16",
            }

            print("[1/1] Sending corrupted image...", end=" ")

            response = requests.post(
                f"{BASE_URL}{ENDPOINT}",
                headers=HEADERS,
                files=files,
                data=data,
                timeout=10,
            )

            status = response.status_code
            resp_data = response.json()

            print(f"\nHTTP {status}")
            print(f"Response: {json.dumps(resp_data, indent=2, ensure_ascii=False)}\n")

            # Verify Error Contract compliance
            expected_fields = {
                "error_code": "INVALID_IMAGE",
                "user_title": str,
                "user_message": str,
                "user_actions": ["retake"],
                "allow_retry": False,
                "trace_id": str,
            }

            print("=" * 60)
            print("Validation:")
            print("=" * 60)

            all_ok = True

            for field, expected_value in expected_fields.items():
                actual_value = resp_data.get(field)

                if actual_value is None:
                    print(f"[FAIL] Missing field: {field}")
                    all_ok = False
                elif expected_value == str:
                    if isinstance(actual_value, str) and actual_value:
                        print(f"[OK] {field}: {actual_value[:50]}...")
                    else:
                        print(f"[FAIL] {field} should be non-empty string, got: {actual_value}")
                        all_ok = False
                elif isinstance(expected_value, list):
                    if actual_value == expected_value:
                        print(f"[OK] {field}: {actual_value}")
                    else:
                        print(f"[FAIL] {field}: expected {expected_value}, got {actual_value}")
                        all_ok = False
                else:
                    if actual_value == expected_value:
                        print(f"[OK] {field}: {actual_value}")
                    else:
                        print(f"[FAIL] {field}: expected {expected_value}, got {actual_value}")
                        all_ok = False

            # Check HTTP status
            if status == 400:
                print(f"[OK] HTTP status: {status} (expected 400)")
            else:
                print(f"[FAIL] HTTP status: {status} (expected 400)")
                all_ok = False

            # Check X-Request-ID header
            request_id_header = response.headers.get("X-Request-ID")
            if request_id_header:
                print(f"[OK] X-Request-ID header: {request_id_header}")
            else:
                print("[WARN] X-Request-ID header missing (optional)")

            print("=" * 60)
            if all_ok:
                print("[SUCCESS] INVALID_IMAGE error contract validated")
            else:
                print("[FAILURE] Validation failed")
            print("=" * 60)

    except Exception as e:
        print(f"[ERROR] Exception: {e}")


if __name__ == "__main__":
    test_invalid_image()
