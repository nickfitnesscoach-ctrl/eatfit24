"""
apps/telegram/admin.py

Django Admin для Telegram моделей.

Принцип:
- Read-only просмотр.
- Чувствительные поля (ai_test_answers, ai_text) НЕ показываем целиком по умолчанию.
"""

from __future__ import annotations

from django.contrib import admin

from apps.telegram.models import PersonalPlan, PersonalPlanSurvey, TelegramUser


@admin.register(TelegramUser)
class TelegramUserAdmin(admin.ModelAdmin):
    list_display = (
        "telegram_id",
        "username",
        "first_name",
        "last_name",
        "is_client",
        "ai_test_completed",
        "created_at",
    )
    list_filter = ("is_client", "ai_test_completed", "is_premium")
    search_fields = ("telegram_id", "username", "first_name", "last_name")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    # Чувствительное поле ai_test_answers не показываем по умолчанию (лучше отдельной детальной ручкой / superuser-only)
    readonly_fields = (
        "user",
        "telegram_id",
        "username",
        "first_name",
        "last_name",
        "language_code",
        "is_premium",
        "ai_test_completed",
        "is_client",
        "recommended_calories",
        "recommended_protein",
        "recommended_fat",
        "recommended_carbs",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PersonalPlanSurvey)
class PersonalPlanSurveyAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "gender",
        "age",
        "height_cm",
        "weight_kg",
        "activity",
        "completed_at",
        "created_at",
    )
    list_filter = ("gender", "activity", "completed_at")
    search_fields = ("user__username", "user__email")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    readonly_fields = (
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
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PersonalPlan)
class PersonalPlanAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "ai_model",
        "prompt_version",
        "created_at",
    )
    list_filter = ("ai_model", "prompt_version")
    # ai_text НЕ ищем (тяжело и рискованно)
    search_fields = ("user__username", "user__email")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    # ai_text как read-only допустим, но это чувствительное — в идеале показывать только superuser
    readonly_fields = (
        "user",
        "survey",
        "ai_text",
        "ai_model",
        "prompt_version",
        "created_at",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
