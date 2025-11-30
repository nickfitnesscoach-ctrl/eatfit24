#!/usr/bin/env python3
"""
Test AI Proxy response time from Django server.

This script measures the actual response time from AI Proxy
to help diagnose timeout issues.

Usage:
    python test_ai_proxy_timeout.py [--image-path /path/to/test.jpg]

Or from SSH:
    ssh root@85.198.81.133 "cd /opt/foodmind/backend && python test_ai_proxy_timeout.py"
"""

import argparse
import base64
import os
import sys
import time
from pathlib import Path

# Add Django project to path
sys.path.insert(0, str(Path(__file__).parent))

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
import django
django.setup()

from django.conf import settings
import httpx


def create_test_image_data_url():
    """Create a minimal test image in data URL format."""
    # 1x1 red pixel PNG (base64)
    minimal_png = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg=="
    )
    return f"data:image/png;base64,{minimal_png}"


def read_image_file(image_path):
    """Read image file and convert to data URL format."""
    with open(image_path, 'rb') as f:
        image_data = f.read()

    # Determine content type
    ext = Path(image_path).suffix.lower()
    if ext in ['.jpg', '.jpeg']:
        content_type = 'image/jpeg'
    elif ext == '.png':
        content_type = 'image/png'
    else:
        content_type = 'application/octet-stream'

    # Encode to base64
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    return f"data:{content_type};base64,{image_base64}"


def test_ai_proxy_direct(image_path=None, num_tests=3):
    """
    Test AI Proxy endpoint directly with timing measurements.

    Args:
        image_path: Optional path to test image file
        num_tests: Number of test iterations
    """
    print("=" * 80)
    print("AI Proxy Response Time Test")
    print("=" * 80)
    print()

    # Get settings
    api_url = settings.AI_PROXY_URL
    api_key = settings.AI_PROXY_SECRET

    if not api_url or not api_key:
        print("ERROR: AI_PROXY_URL or AI_PROXY_SECRET not configured in settings")
        print(f"  AI_PROXY_URL: {api_url or 'NOT SET'}")
        print(f"  AI_PROXY_SECRET: {'SET' if api_key else 'NOT SET'}")
        return False

    print(f"Configuration:")
    print(f"  AI_PROXY_URL: {api_url}")
    print(f"  AI_PROXY_SECRET: {api_key[:8]}...")
    print(f"  Test iterations: {num_tests}")
    print()

    # Prepare image data
    if image_path:
        print(f"Using image file: {image_path}")
        try:
            data_url = read_image_file(image_path)
            print(f"Image size: {len(data_url)/1024:.1f}KB")
        except Exception as e:
            print(f"ERROR reading image file: {e}")
            return False
    else:
        print("Using minimal test image (1x1 pixel)")
        data_url = create_test_image_data_url()

    print()

    # Prepare request
    endpoint = f"{api_url.rstrip('/')}/api/v1/ai/recognize-food"

    # Parse data URL to get image bytes
    if ',' not in data_url:
        print("ERROR: Invalid data URL format")
        return False

    header, encoded = data_url.split(',', 1)
    image_bytes = base64.b64decode(encoded)

    # Determine content type
    if 'image/jpeg' in header:
        content_type = 'image/jpeg'
    elif 'image/png' in header:
        content_type = 'image/png'
    else:
        content_type = 'application/octet-stream'

    headers = {
        "X-API-Key": api_key,
    }

    files = {
        "image": ("test.jpg", image_bytes, content_type)
    }

    data = {
        "locale": "ru",
        "user_comment": "Test image for timeout diagnostics"
    }

    # Run tests
    results = []
    timeout_seconds = 130.0  # Match client timeout (temporarily increased)

    for i in range(num_tests):
        print(f"Test {i+1}/{num_tests}:")
        print(f"  Endpoint: {endpoint}")
        print(f"  Timeout: {timeout_seconds}s")

        start_time = time.time()

        try:
            with httpx.Client(timeout=timeout_seconds) as client:
                response = client.post(
                    endpoint,
                    headers=headers,
                    files=files,
                    data=data,
                )

            elapsed = time.time() - start_time
            results.append(elapsed)

            print(f"  Status: {response.status_code}")
            print(f"  Time: {elapsed:.2f}s")

            if response.status_code == 200:
                result = response.json()
                items = result.get('items', [])
                total = result.get('total', {})
                print(f"  Items found: {len(items)}")
                print(f"  Total calories: {total.get('kcal', 0)}")
            else:
                print(f"  Error: {response.text[:200]}")

        except httpx.TimeoutException as e:
            elapsed = time.time() - start_time
            results.append(elapsed)
            print(f"  TIMEOUT after {elapsed:.2f}s: {e}")

        except Exception as e:
            elapsed = time.time() - start_time
            results.append(elapsed)
            print(f"  ERROR after {elapsed:.2f}s: {type(e).__name__}: {e}")

        print()

        # Wait between tests
        if i < num_tests - 1:
            time.sleep(2)

    # Summary
    print("=" * 80)
    print("Summary:")
    print(f"  Tests run: {len(results)}")
    if results:
        print(f"  Min time: {min(results):.2f}s")
        print(f"  Max time: {max(results):.2f}s")
        print(f"  Avg time: {sum(results)/len(results):.2f}s")

    # Diagnosis
    print()
    print("Diagnosis:")
    if not results:
        print("  ❌ No successful requests")
    elif max(results) > timeout_seconds:
        print(f"  ⚠️  Some requests exceeded timeout ({timeout_seconds}s)")
        print(f"     Consider: Check AI Proxy logs, network latency, OpenRouter performance")
    elif max(results) > 15:
        print(f"  ⚠️  Requests are slow (max {max(results):.2f}s)")
        print(f"     This is close to timeout threshold")
    else:
        print(f"  ✓ All requests completed within acceptable time")

    print("=" * 80)
    return True


def main():
    parser = argparse.ArgumentParser(
        description='Test AI Proxy response time from Django server'
    )
    parser.add_argument(
        '--image-path',
        type=str,
        help='Path to test image file (JPEG or PNG)'
    )
    parser.add_argument(
        '--num-tests',
        type=int,
        default=3,
        help='Number of test iterations (default: 3)'
    )

    args = parser.parse_args()

    try:
        success = test_ai_proxy_direct(
            image_path=args.image_path,
            num_tests=args.num_tests
        )
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
