"""
Serializers for users app.

NOTE: Email/password authentication serializers have been removed.
EatFit24 uses Telegram WebApp authentication only.
"""

from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Profile


class ProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for Profile model.
    Uses backend format for all fields - frontend should adapt.
    """
    age = serializers.ReadOnlyField()
    bmi = serializers.ReadOnlyField()
    is_complete = serializers.ReadOnlyField()
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = Profile
        fields = [
            'full_name',
            'gender',
            'birth_date',
            'height',
            'weight',
            'activity_level',
            'goal_type',
            'target_weight',
            'timezone',
            'avatar_url',
            'age',
            'bmi',
            'is_complete',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at', 'age', 'bmi', 'is_complete', 'avatar_url']

    def get_avatar_url(self, obj):
        """
        Return full URL for avatar if exists.
        Includes version parameter for cache busting.
        """
        if obj.avatar:
            request = self.context.get('request')
            base_url = None

            if request:
                base_url = request.build_absolute_uri(obj.avatar.url)
            else:
                base_url = obj.avatar.url

            # Add version parameter for cache busting
            if obj.avatar_version > 0:
                separator = '&' if '?' in base_url else '?'
                return f"{base_url}{separator}v={obj.avatar_version}"
            return base_url
        return None

    def validate_height(self, value):
        """Validate height is in realistic range."""
        if value is not None and not (50 <= value <= 250):
            raise serializers.ValidationError("Рост должен быть от 50 до 250 см")
        return value

    def validate_weight(self, value):
        """Validate weight is in realistic range."""
        if value is not None and not (20 <= float(value) <= 500):
            raise serializers.ValidationError("Вес должен быть от 20 до 500 кг")
        return value


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for User model with profile.
    """
    profile = ProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'profile']
        read_only_fields = ['id', 'email']


# =============================================================================
# REMOVED: Email/Password Authentication Serializers
# =============================================================================
# The following serializers have been removed as EatFit24 uses Telegram auth:
# - UserRegistrationSerializer (email/password registration)
# - UserLoginSerializer (email/password login)
# - TokenSerializer (JWT tokens for email auth)
# - ChangePasswordSerializer (password change - no passwords with Telegram)
#
# Telegram authentication serializers are in apps/telegram/serializers.py
# =============================================================================
