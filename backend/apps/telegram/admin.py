"""
Настройка Django Admin для приложения Telegram.

Модели:
- TelegramUser: Telegram профили пользователей
- PersonalPlanSurvey: Опросы (анкеты) для Personal Plan
- PersonalPlan: Сгенерированные AI планы

Все модели доступны только для чтения (read-only).
"""

from django.contrib import admin

from apps.telegram.models import PersonalPlan, PersonalPlanSurvey, TelegramUser

# -----------------------------------------------------------------------------
# TelegramUser Admin
# -----------------------------------------------------------------------------


@admin.register(TelegramUser)
class TelegramUserAdmin(admin.ModelAdmin):
    """
    Telegram пользователи — read-only просмотр.
    """

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

    readonly_fields = (
        "user",
        "telegram_id",
        "username",
        "first_name",
        "last_name",
        "language_code",
        "is_premium",
        "ai_test_completed",
        "ai_test_answers",
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

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# -----------------------------------------------------------------------------
# PersonalPlanSurvey Admin
# -----------------------------------------------------------------------------


@admin.register(PersonalPlanSurvey)
class PersonalPlanSurveyAdmin(admin.ModelAdmin):
    """
    Опросы Personal Plan — read-only просмотр.
    """

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

    fieldsets = (
        ("Пользователь", {"fields": ("user",)}),
        (
            "Основные данные",
            {"fields": ("gender", "age", "height_cm", "weight_kg", "target_weight_kg")},
        ),
        ("Активность и тренировки", {"fields": ("activity", "training_level")}),
        ("Цели и ограничения", {"fields": ("body_goals", "health_limitations")}),
        (
            "Тип фигуры",
            {
                "fields": (
                    "body_now_id",
                    "body_now_label",
                    "body_now_file",
                    "body_ideal_id",
                    "body_ideal_label",
                    "body_ideal_file",
                )
            },
        ),
        ("Часовой пояс", {"fields": ("timezone", "utc_offset_minutes")}),
        ("Даты", {"fields": ("completed_at", "created_at", "updated_at")}),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


# -----------------------------------------------------------------------------
# PersonalPlan Admin
# -----------------------------------------------------------------------------


@admin.register(PersonalPlan)
class PersonalPlanAdmin(admin.ModelAdmin):
    """
    Персональные планы — read-only просмотр.
    """

    list_display = (
        "id",
        "user",
        "ai_model",
        "prompt_version",
        "created_at",
    )
    list_filter = ("ai_model", "prompt_version")
    search_fields = ("user__username", "user__email", "ai_text")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"

    readonly_fields = (
        "user",
        "survey",
        "ai_text",
        "ai_model",
        "prompt_version",
        "created_at",
    )

    fieldsets = (
        ("Пользователь", {"fields": ("user", "survey")}),
        ("AI План", {"fields": ("ai_text", "ai_model", "prompt_version")}),
        ("Дата", {"fields": ("created_at",)}),
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
