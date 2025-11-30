"""
Test multipart/form-data migration for AI Proxy.

This test validates that:
1. Data URL parsing works correctly
2. Client can prepare multipart requests
3. Service layer integrates properly
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Set up Django (minimal settings for testing)
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

# Mock AI Proxy settings for testing
os.environ['AI_PROXY_URL'] = 'http://localhost:8001'
os.environ['AI_PROXY_SECRET'] = 'test-secret-key'

import django
django.setup()

from apps.ai_proxy.utils import parse_data_url
from apps.ai_proxy.client import AIProxyClient
from apps.ai_proxy.service import AIProxyRecognitionService
from apps.ai_proxy.exceptions import AIProxyValidationError
import httpx
from unittest.mock import Mock, patch


def test_data_url_parsing():
    """Test data URL parsing functionality."""
    print("\n" + "="*80)
    print("TEST 1: Data URL Parsing")
    print("="*80)

    # Valid JPEG
    jpeg_base64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A4+iiigD/2Q=="
    data_url = f"data:image/jpeg;base64,{jpeg_base64}"

    print("\n1.1. Parsing valid JPEG data URL...")
    try:
        image_bytes, content_type = parse_data_url(data_url)
        print(f"    [OK] Parsed: {len(image_bytes)} bytes, type={content_type}")
        assert content_type == "image/jpeg"
        assert len(image_bytes) > 0
    except Exception as e:
        print(f"    [FAIL] {e}")
        return False

    # Valid PNG
    png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    data_url = f"data:image/png;base64,{png_base64}"

    print("\n1.2. Parsing valid PNG data URL...")
    try:
        image_bytes, content_type = parse_data_url(data_url)
        print(f"    [OK] Parsed: {len(image_bytes)} bytes, type={content_type}")
        assert content_type == "image/png"
    except Exception as e:
        print(f"    [FAIL] {e}")
        return False

    # Invalid format
    print("\n1.3. Rejecting invalid format...")
    try:
        parse_data_url("not-a-data-url")
        print(f"    [FAIL] Should have rejected invalid format")
        return False
    except ValueError:
        print(f"    [OK] Correctly rejected")

    print("\n[OK] All data URL parsing tests passed!")
    return True


def test_client_multipart_preparation():
    """Test that client prepares multipart requests correctly."""
    print("\n" + "="*80)
    print("TEST 2: Client Multipart Request Preparation")
    print("="*80)

    client = AIProxyClient()

    jpeg_base64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A4+iiigD/2Q=="
    data_url = f"data:image/jpeg;base64,{jpeg_base64}"
    image_bytes, content_type = parse_data_url(data_url)

    print(f"\n2.1. Testing multipart request preparation...")
    print(f"    Image: {len(image_bytes)} bytes, {content_type}")
    print(f"    Comment: 'Test comment'")
    print(f"    Locale: 'ru'")

    # Mock the HTTP client to intercept the request
    with patch.object(client.client, 'post') as mock_post:
        # Configure mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "items": [
                {
                    "food_name_ru": "Тестовое блюдо",
                    "food_name_en": "Test food",
                    "portion_weight_g": 100.0,
                    "calories": 200,
                    "protein_g": 10.0,
                    "fat_g": 5.0,
                    "carbs_g": 20.0
                }
            ],
            "total": {
                "calories": 200,
                "protein_g": 10.0,
                "fat_g": 5.0,
                "carbs_g": 20.0
            }
        }
        mock_post.return_value = mock_response

        # Call the method
        result = client.recognize_food(
            image_bytes=image_bytes,
            content_type=content_type,
            user_comment="Test comment",
            locale="ru"
        )

        # Verify the request was made correctly
        assert mock_post.called, "HTTP POST was not called"
        call_args = mock_post.call_args

        print(f"\n2.2. Verifying request structure...")

        # Check headers
        headers = call_args.kwargs.get('headers', {})
        assert 'X-API-Key' in headers, "Missing X-API-Key header"
        print(f"    [OK] Headers include X-API-Key")

        # Check files parameter
        files = call_args.kwargs.get('files', {})
        assert 'image' in files, "Missing image in files"
        file_name, file_data, file_content_type = files['image']
        assert file_data == image_bytes, "Image bytes don't match"
        assert file_content_type == content_type, "Content type doesn't match"
        print(f"    [OK] Files include image with correct data")

        # Check data parameter
        data = call_args.kwargs.get('data', {})
        assert data.get('locale') == 'ru', "Locale not set correctly"
        assert data.get('user_comment') == 'Test comment', "Comment not set correctly"
        print(f"    [OK] Form data includes locale and user_comment")

        # Check result
        assert 'items' in result, "Result missing items"
        print(f"    [OK] Response parsed correctly")

    print("\n[OK] Client multipart preparation test passed!")
    return True


def test_service_integration():
    """Test service layer integration."""
    print("\n" + "="*80)
    print("TEST 3: Service Integration")
    print("="*80)

    service = AIProxyRecognitionService()

    jpeg_base64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/aAAwDAQACEQMRAD8A4+iiigD/2Q=="
    data_url = f"data:image/jpeg;base64,{jpeg_base64}"

    print(f"\n3.1. Testing service with valid data URL...")

    # Mock the client
    with patch.object(service.client, 'recognize_food') as mock_recognize:
        # Configure mock response (AI Proxy format)
        mock_recognize.return_value = {
            "items": [
                {
                    "food_name_ru": "Куриная грудка",
                    "food_name_en": "Chicken breast",
                    "portion_weight_g": 150.0,
                    "calories": 165,
                    "protein_g": 31.0,
                    "fat_g": 3.6,
                    "carbs_g": 0.0
                }
            ],
            "total": {
                "calories": 165,
                "protein_g": 31.0,
                "fat_g": 3.6,
                "carbs_g": 0.0
            }
        }

        # Call service
        result = service.recognize_food(
            image_data_url=data_url,
            user_comment="Test meal"
        )

        # Verify client was called with bytes
        assert mock_recognize.called, "Client recognize_food was not called"
        call_args = mock_recognize.call_args.kwargs

        assert 'image_bytes' in call_args, "Missing image_bytes parameter"
        assert isinstance(call_args['image_bytes'], bytes), "image_bytes is not bytes"
        print(f"    [OK] Client called with image_bytes ({len(call_args['image_bytes'])} bytes)")

        assert 'content_type' in call_args, "Missing content_type parameter"
        assert call_args['content_type'] == 'image/jpeg', "Wrong content type"
        print(f"    [OK] Content type set correctly: {call_args['content_type']}")

        # Verify response was adapted to legacy format
        assert 'recognized_items' in result, "Result not in legacy format"
        items = result['recognized_items']
        assert len(items) == 1, "Wrong number of items"

        item = items[0]
        assert item['name'] == "Куриная грудка", "Name not adapted"
        assert item['estimated_weight'] == 150, "Weight not adapted"
        assert item['calories'] == 165, "Calories not adapted"
        print(f"    [OK] Response adapted to legacy format")
        print(f"         Item: {item['name']}, {item['estimated_weight']}g, {item['calories']} kcal")

    print("\n[OK] Service integration test passed!")
    return True


def run_all_tests():
    """Run all migration tests."""
    print("\n" + "="*80)
    print("MULTIPART/FORM-DATA MIGRATION TESTS")
    print("="*80)

    results = {
        "Data URL Parsing": test_data_url_parsing(),
        "Client Multipart Preparation": test_client_multipart_preparation(),
        "Service Integration": test_service_integration(),
    }

    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)

    all_passed = True
    for test_name, passed in results.items():
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{status} {test_name}")
        if not passed:
            all_passed = False

    print("="*80)

    if all_passed:
        print("\n[SUCCESS] ALL TESTS PASSED! Migration is working correctly.")
        print("\nNext steps:")
        print("  1. Deploy to server")
        print("  2. Test with real AI Proxy connection")
        print("  3. Monitor logs for any issues")
    else:
        print("\n[ERROR] SOME TESTS FAILED! Please review the errors above.")

    return all_passed


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
