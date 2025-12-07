"""
Admin configuration for users app.

NOTE: EmailVerificationToken admin has been removed.
EatFit24 uses Telegram WebApp authentication only.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User

from .models import Profile


class ProfileInline(admin.StackedInline):
    """
    Inline admin for Profile model.
    """
    model = Profile
    can_delete = False
    verbose_name_plural = 'Профиль'


class UserAdmin(BaseUserAdmin):
    """
    Extended User admin with Profile inline.
    """
    inlines = (ProfileInline,)


# Unregister default User admin and register custom one
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    """
    Admin interface for Profile model.
    """
    list_display = [
        'user',
        'full_name',
        'gender',
        'age',
        'height',
        'weight',
        'bmi',
        'activity_level',
        'created_at',
    ]
    list_filter = ['gender', 'activity_level', 'created_at']
    search_fields = ['user__username', 'user__email', 'full_name']
    readonly_fields = ['created_at', 'updated_at', 'age', 'bmi']

    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'full_name', 'gender', 'birth_date')
        }),
        ('Физические параметры', {
            'fields': ('height', 'weight', 'activity_level')
        }),
        ('Вычисляемые поля', {
            'fields': ('age', 'bmi'),
            'classes': ('collapse',)
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


# =============================================================================
# REMOVED: EmailVerificationTokenAdmin
# =============================================================================
# Email verification has been removed - EatFit24 uses Telegram auth only.
# =============================================================================
