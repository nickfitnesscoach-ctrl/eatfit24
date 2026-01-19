#!/usr/bin/env python3
"""
Test script to verify RATE_LIMIT error is returned after throttle limit.

Usage:
    python test_throttle.py

Expected behavior:
    - First 10 requests: 400 (INVALID_IMAGE, because no real image uploaded)
    - Next requests: 429 (RATE_LIMIT) with retry_after_sec and trace_id
"""

import requests
import time
import json

# Configuration
BASE_URL = "http://localhost:8000"
ENDPOINT = "/api/v1/ai/recognize/"
TOTAL_REQUESTS = 15  # ai_per_minute limit is 10/minute

# Test user credentials (use debug mode or real token)
HEADERS = {
    "X-Debug-Mode": "true",
    "X-Debug-User-ID": "100",
}


def test_throttling():
    """Send multiple requests to trigger throttling."""
    print(f"Testing throttling on {BASE_URL}{ENDPOINT}")
    print(f"Sending {TOTAL_REQUESTS} requests (limit: 10/minute)\n")

    rate_limit_hit = False

    for i in range(1, TOTAL_REQUESTS + 1):
        print(f"[{i}/{TOTAL_REQUESTS}] Sending request...", end=" ")

        try:
            # Send empty POST (will fail validation, but that's OK)
            response = requests.post(
                f"{BASE_URL}{ENDPOINT}",
                headers=HEADERS,
                data={},  # Empty data to trigger validation error
                timeout=5,
            )

            status = response.status_code
            data = response.json()

            if status == 429:
                # RATE_LIMIT hit!
                rate_limit_hit = True
                print(f"[OK] 429 TOO_MANY_REQUESTS")
                print(f"   error_code: {data.get('error_code')}")
                print(f"   trace_id: {data.get('trace_id')}")
                print(f"   retry_after_sec: {data.get('retry_after_sec')}")
                print(f"   allow_retry: {data.get('allow_retry')}")
                print(f"   user_actions: {data.get('user_actions')}")

                # Verify Retry-After header
                retry_after = response.headers.get("Retry-After")
                print(f"   Retry-After header: {retry_after}")

                # Verify Error Contract compliance
                required_fields = ["error_code", "user_title", "user_message", "user_actions", "allow_retry", "trace_id"]
                missing = [f for f in required_fields if f not in data]
                if missing:
                    print(f"   [FAIL] MISSING FIELDS: {missing}")
                else:
                    print(f"   [OK] All Error Contract fields present")

            elif status == 400:
                # Validation error (expected before throttle)
                error_code = data.get("error_code", data.get("error", {}).get("code"))
                print(f"[EXPECTED] 400 BAD_REQUEST (error_code: {error_code})")

            else:
                print(f"[WARN] Unexpected status: {status}")
                print(f"   Response: {json.dumps(data, indent=2)}")

        except Exception as e:
            print(f"[ERROR] Exception: {e}")

        # Small delay to avoid instant spam (but not enough to reset throttle)
        time.sleep(0.1)

    print("\n" + "=" * 60)
    if rate_limit_hit:
        print("[SUCCESS] RATE_LIMIT error triggered and validated")
    else:
        print("[FAILURE] RATE_LIMIT never triggered")
        print("   Possible causes:")
        print("   - Throttle limit higher than TOTAL_REQUESTS")
        print("   - Throttle not configured on this endpoint")
        print("   - DEBUG mode bypassing throttle")
    print("=" * 60)


if __name__ == "__main__":
    test_throttling()
