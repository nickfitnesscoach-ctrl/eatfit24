"""
apps/telegram/serializers.py

Сериализаторы Telegram интеграции.

Принципы:
- Публичные ответы не должны содержать лишние чувствительные поля.
- Чувствительные поля (answers, ai_text и т.п.) — только в специальных ручках/админке.
"""

from __future__ import annotations

from rest_framework import serializers

from apps.nutrition.serializers import DailyGoalSerializer
from apps.users.serializers import ProfileSerializer

from .models import PersonalPlan, PersonalPlanSurvey, TelegramUser


def _validate_positive_int(value: int, field_name: str) -> int:
    if value is None or int(value) <= 0:
        raise serializers.ValidationError(f"{field_name} должен быть положительным числом")
    return int(value)


class TelegramUserPublicSerializer(serializers.ModelSerializer):
    """
    Публичный TelegramUser (для Mini App и обычных ручек).

    Важно:
    - НЕ отдаём ai_test_answers.
    """

    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = TelegramUser
        fields = [
            "telegram_id",
            "username",
            "first_name",
            "last_name",
            "display_name",
            "language_code",
            "is_premium",
            "ai_test_completed",
            "recommended_calories",
            "recommended_protein",
            "recommended_fat",
            "recommended_carbs",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class TelegramUserAdminSerializer(serializers.ModelSerializer):
    """
    Админский TelegramUser (для панели тренера/админки).
    Здесь можно отдавать ai_test_answers, но лучше только по детальной ручке.
    """

    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = TelegramUser
        fields = [
            "telegram_id",
            "username",
            "first_name",
            "last_name",
            "display_name",
            "language_code",
            "is_premium",
            "ai_test_completed",
            "ai_test_answers",
            "recommended_calories",
            "recommended_protein",
            "recommended_fat",
            "recommended_carbs",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class TelegramAuthSerializer(serializers.Serializer):
    """
    Ответ после аутентификации.
    JWT может быть опциональным — поэтому required=False.
    """

    access = serializers.CharField(required=False, allow_blank=True)
    refresh = serializers.CharField(required=False, allow_blank=True)
    user = TelegramUserPublicSerializer()
    is_admin = serializers.BooleanField(default=False)


class SaveTestResultsSerializer(serializers.Serializer):
    telegram_id = serializers.IntegerField(required=True)
    first_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=255, required=False, allow_blank=True)
    username = serializers.CharField(max_length=255, required=False, allow_blank=True)

    answers = serializers.JSONField(required=False, default=dict)

    def validate_telegram_id(self, value: int) -> int:
        return _validate_positive_int(value, "telegram_id")

    def validate_answers(self, value):
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("answers должны быть объектом (словарём)")
        return value


class WebAppAuthUserSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    telegram_id = serializers.IntegerField()
    username = serializers.CharField(allow_null=True, allow_blank=True)
    first_name = serializers.CharField(allow_null=True, allow_blank=True)
    last_name = serializers.CharField(allow_null=True, allow_blank=True)


class WebAppAuthResponseSerializer(serializers.Serializer):
    user = WebAppAuthUserSerializer()
    profile = ProfileSerializer()
    goals = DailyGoalSerializer(allow_null=True)
    is_admin = serializers.BooleanField()


class PersonalPlanSurveySerializer(serializers.ModelSerializer):
    """
    INTERNAL serializer (панель/админка). В публичный Mini App лучше отдавать урезанную версию.
    """

    class Meta:
        model = PersonalPlanSurvey
        fields = [
            "id",
            "user",
            "gender",
            "age",
            "height_cm",
            "weight_kg",
            "target_weight_kg",
            "activity",
            "training_level",
            "body_goals",
            "health_limitations",
            "body_now_id",
            "body_now_label",
            "body_now_file",
            "body_ideal_id",
            "body_ideal_label",
            "body_ideal_file",
            "timezone",
            "utc_offset_minutes",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class CreatePersonalPlanSurveySerializer(serializers.Serializer):
    telegram_id = serializers.IntegerField(required=True)

    gender = serializers.ChoiceField(choices=["male", "female"], required=True)
    age = serializers.IntegerField(min_value=14, max_value=80, required=True)
    height_cm = serializers.IntegerField(min_value=120, max_value=250, required=True)

    weight_kg = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=30, max_value=300, required=True
    )
    target_weight_kg = serializers.DecimalField(
        max_digits=5, decimal_places=2, min_value=30, max_value=300, required=False, allow_null=True
    )

    activity = serializers.ChoiceField(
        choices=["sedentary", "light", "moderate", "active", "very_active"], required=True
    )

    training_level = serializers.CharField(
        max_length=32, required=False, allow_blank=True, allow_null=True
    )

    body_goals = serializers.ListField(
        child=serializers.CharField(max_length=128, allow_blank=False),
        required=False,
        allow_empty=True,
        max_length=20,
    )
    health_limitations = serializers.ListField(
        child=serializers.CharField(max_length=128, allow_blank=False),
        required=False,
        allow_empty=True,
        max_length=20,
    )

    body_now_id = serializers.IntegerField(required=True)
    body_now_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    body_now_file = serializers.CharField(required=True)

    body_ideal_id = serializers.IntegerField(required=True)
    body_ideal_label = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    body_ideal_file = serializers.CharField(required=True)

    timezone = serializers.CharField(max_length=64, default="Europe/Moscow")
    utc_offset_minutes = serializers.IntegerField(required=True)

    def validate_telegram_id(self, value: int) -> int:
        return _validate_positive_int(value, "telegram_id")

    def validate_body_now_id(self, value: int) -> int:
        return _validate_positive_int(value, "body_now_id")

    def validate_body_ideal_id(self, value: int) -> int:
        return _validate_positive_int(value, "body_ideal_id")


class PersonalPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalPlan
        fields = [
            "id",
            "user",
            "survey",
            "ai_text",
            "ai_model",
            "prompt_version",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class CreatePersonalPlanSerializer(serializers.Serializer):
    telegram_id = serializers.IntegerField(required=True)
    survey_id = serializers.IntegerField(required=False, allow_null=True)

    ai_text = serializers.CharField(required=True)
    ai_model = serializers.CharField(
        max_length=100, required=False, allow_blank=True, allow_null=True
    )
    prompt_version = serializers.CharField(
        max_length=20, required=False, allow_blank=True, allow_null=True
    )

    def validate_telegram_id(self, value: int) -> int:
        return _validate_positive_int(value, "telegram_id")

    def validate_survey_id(self, value):
        if value is None:
            return value
        return _validate_positive_int(value, "survey_id")
