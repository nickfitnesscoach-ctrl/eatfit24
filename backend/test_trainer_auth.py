#!/usr/bin/env python
"""
Manual test script for trainer panel authentication.
Usage:
    python manage.py shell < test_trainer_auth.py
    
Or interactively:
    python manage.py shell
    >>> exec(open('test_trainer_auth.py').read())
"""

import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

from django.conf import settings
from rest_framework.test import APIClient


def generate_valid_init_data(user_id, bot_token):
    """Generate valid Telegram WebApp initData for testing."""
    auth_date = int(time.time())
    user_data = {
        "id": user_id,
        "first_name": "Test",
        "last_name": "User",
        "username": "testuser",
        "language_code": "ru",
    }
    
    data_params = {
        "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
        "user": json.dumps(user_data),
        "auth_date": str(auth_date),
    }
    
    # Create data_check_string
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(data_params.items())
    )
    
    # Calculate hash
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    hash_value = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()
    
    # Add hash to params
    data_params["hash"] = hash_value
    
    # Return as query string
    return urlencode(data_params)


def test_trainer_auth():
    """Test trainer panel authentication endpoint."""
    print("\n" + "="*60)
    print("TESTING TRAINER PANEL AUTHENTICATION")
    print("="*60 + "\n")
    
    client = APIClient()
    bot_token = settings.TELEGRAM_BOT_TOKEN
    
    if not bot_token:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN not set in settings")
        return
    
    print(f"✓ Bot token present: {bot_token[:10]}...")
    print(f"✓ Admin IDs from settings: {settings.TELEGRAM_ADMINS}")
    
    # Test 1: Valid admin user
    print("\n" + "-"*60)
    print("TEST 1: Valid admin user (310151740)")
    print("-"*60)
    
    init_data = generate_valid_init_data(310151740, bot_token)
    print(f"Generated initData length: {len(init_data)}")
    
    response = client.post(
        "/api/v1/trainer-panel/auth/",
        {"init_data": init_data},
        format="json"
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.json()}")
    
    if response.status_code == 200:
        print("✅ TEST 1 PASSED")
    else:
        print("❌ TEST 1 FAILED")
    
    # Test 2: Non-admin user
    print("\n" + "-"*60)
    print("TEST 2: Non-admin user (999999999)")
    print("-"*60)
    
    init_data = generate_valid_init_data(999999999, bot_token)
    
    response = client.post(
        "/api/v1/trainer-panel/auth/",
        {"init_data": init_data},
        format="json"
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.json()}")
    
    if response.status_code == 403:
        print("✅ TEST 2 PASSED")
    else:
        print("❌ TEST 2 FAILED")
    
    # Test 3: Invalid initData
    print("\n" + "-"*60)
    print("TEST 3: Invalid initData")
    print("-"*60)
    
    response = client.post(
        "/api/v1/trainer-panel/auth/",
        {"init_data": "invalid_data"},
        format="json"
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.json()}")
    
    if response.status_code == 403:
        print("✅ TEST 3 PASSED")
    else:
        print("❌ TEST 3 FAILED")
    
    # Test 4: Missing initData
    print("\n" + "-"*60)
    print("TEST 4: Missing initData")
    print("-"*60)
    
    response = client.post(
        "/api/v1/trainer-panel/auth/",
        {},
        format="json"
    )
    
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.json()}")
    
    if response.status_code == 403:
        print("✅ TEST 4 PASSED")
    else:
        print("❌ TEST 4 FAILED")
    
    print("\n" + "="*60)
    print("TESTING COMPLETE")
    print("="*60 + "\n")


if __name__ == "__main__":
    test_trainer_auth()

# Auto-run when loaded in shell
test_trainer_auth()
