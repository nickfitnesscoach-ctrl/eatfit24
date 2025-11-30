"""
Integration test for AI Proxy multipart/form-data migration.

This script tests the complete flow:
1. Parse data URL → bytes
2. Send to AI Proxy client
3. Receive and adapt response
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

import django
django.setup()

from apps.ai_proxy.utils import parse_data_url
from apps.ai_proxy.service import AIProxyRecognitionService
from apps.ai_proxy.exceptions import AIProxyError, AIProxyValidationError


def test_integration():
    """Test complete AI Proxy integration."""

    print("=" * 80)
    print("AI Proxy Integration Test - Multipart/Form-Data")
    print("=" * 80)

    # Create a small valid JPEG (1x1 red pixel)
    jpeg_base64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A4+iiigD/2Q=="
    data_url = f"data:image/jpeg;base64,{jpeg_base64}"

    print("\n1. Testing parse_data_url()...")
    try:
        image_bytes, content_type = parse_data_url(data_url)
        print(f"[OK] Parsed successfully")
        print(f"    Size: {len(image_bytes)} bytes ({len(image_bytes)/1024:.1f} KB)")
        print(f"    Content-Type: {content_type}")
    except ValueError as e:
        print(f"[FAIL] Parse error: {e}")
        return

    print("\n2. Testing AIProxyRecognitionService...")
    service = AIProxyRecognitionService()
    print(f"[OK] Service initialized")

    print("\n3. Testing recognize_food() with mock data...")
    print("    NOTE: This will fail if AI Proxy is not accessible")
    print("    or if AI_PROXY_URL/AI_PROXY_SECRET are not configured.")

    try:
        result = service.recognize_food(
            image_data_url=data_url,
            user_comment="Test image - 1x1 red pixel",
        )

        print(f"[OK] Recognition succeeded!")
        print(f"    Result structure:")
        print(f"      - recognized_items: {len(result.get('recognized_items', []))} items")

        for idx, item in enumerate(result.get('recognized_items', []), 1):
            print(f"      - Item {idx}:")
            print(f"          name: {item.get('name')}")
            print(f"          weight: {item.get('estimated_weight')}g")
            print(f"          calories: {item.get('calories')} kcal")
            print(f"          protein: {item.get('protein')}g")
            print(f"          fat: {item.get('fat')}g")
            print(f"          carbs: {item.get('carbohydrates')}g")

    except AIProxyValidationError as e:
        print(f"[FAIL] Validation error: {e}")
        print("    This means the data URL parsing or validation failed.")

    except AIProxyError as e:
        print(f"[EXPECTED] AI Proxy error: {e}")
        print("    This is expected if:")
        print("      - AI Proxy service is not running")
        print("      - AI_PROXY_URL or AI_PROXY_SECRET not configured")
        print("      - Not connected to Tailscale VPN")
        print("      - Test image is too small for AI model")

    except Exception as e:
        print(f"[FAIL] Unexpected error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 80)
    print("Integration Test Summary:")
    print("  - Data URL parsing: [OK]")
    print("  - Service initialization: [OK]")
    print("  - Full integration: See results above")
    print("\nTo test with real AI Proxy:")
    print("  1. Ensure AI Proxy is running")
    print("  2. Configure AI_PROXY_URL and AI_PROXY_SECRET in .env")
    print("  3. Connect to Tailscale VPN")
    print("  4. Use a real food image (not 1x1 pixel)")
    print("=" * 80)


if __name__ == "__main__":
    test_integration()
