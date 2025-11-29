"""
Django Admin конфигурация для billing app.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import SubscriptionPlan, Subscription, Payment, Refund
from .usage import DailyUsage


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    """
    Админка для тарифных планов.

    ВАЖНО: Не создавайте новые планы через админку!
    Редактируйте только существующие три плана: FREE, PRO_MONTHLY, PRO_YEARLY.
    Поле 'code' доступно только для чтения.
    """

    list_display = [
        'code',
        'display_name',
        'price',
        'duration_days',
        'daily_photo_limit',
        'history_days',
        'is_active',
        'is_test',
        'created_at',
    ]
    list_filter = ['is_active', 'is_test', 'created_at']
    search_fields = ['code', 'display_name', 'description']
    ordering = ['price']

    fieldsets = (
        ('Основная информация', {
            'fields': ('code', 'display_name', 'description', 'is_active', 'is_test'),
            'description': 'Поле "code" доступно только для чтения. Не изменяйте его!'
        }),
        ('Цены и длительность', {
            'fields': ('price', 'duration_days'),
            'description': 'Цены можно изменять через админку. Изменения сразу влияют на API.'
        }),
        ('Возможности плана', {
            'fields': (
                'daily_photo_limit',
                'history_days',
                'ai_recognition',
                'advanced_stats',
                'priority_support',
            )
        }),
        ('Legacy поля (не используйте)', {
            'fields': ('name', 'max_photos_per_day'),
            'classes': ('collapse',),
            'description': 'Устаревшие поля. Используйте code и daily_photo_limit.'
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['code', 'created_at', 'updated_at']

    def has_add_permission(self, request):
        """Запрещаем создание новых планов через админку."""
        return False

    def has_delete_permission(self, request, obj=None):
        """Запрещаем удаление планов через админку."""
        return False


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    """Админка для подписок."""

    list_display = [
        'user',
        'plan',
        'start_date',
        'end_date',
        'is_active',
        'auto_renew',
        'get_days_remaining',
    ]
    list_filter = ['is_active', 'auto_renew', 'plan', 'created_at']
    search_fields = ['user__email', 'user__name']
    ordering = ['-created_at']
    raw_id_fields = ['user']

    fieldsets = (
        ('Пользователь и план', {
            'fields': ('user', 'plan')
        }),
        ('Даты', {
            'fields': ('start_date', 'end_date')
        }),
        ('Статус', {
            'fields': ('is_active', 'auto_renew')
        }),
        ('Способ оплаты', {
            'fields': ('yookassa_payment_method_id',)
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['created_at', 'updated_at']

    def get_days_remaining(self, obj):
        """Отображение оставшихся дней."""
        days = obj.days_remaining
        if days is None:
            return 'Бессрочно'
        if days == 0:
            return format_html('<span style="color: red;">Истекла</span>')
        if days < 7:
            return format_html(f'<span style="color: orange;">{days} дней</span>')
        return f'{days} дней'

    get_days_remaining.short_description = 'Осталось дней'


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    """Админка для платежей."""

    list_display = [
        'id',
        'user',
        'plan',
        'amount',
        'currency',
        'get_status_display_colored',
        'provider',
        'is_recurring',
        'created_at',
        'paid_at',
    ]
    list_filter = ['status', 'provider', 'is_recurring', 'created_at']
    search_fields = [
        'user__email',
        'user__name',
        'yookassa_payment_id',
        'id',
    ]
    ordering = ['-created_at']
    raw_id_fields = ['user', 'subscription', 'plan']

    fieldsets = (
        ('ID и связи', {
            'fields': ('id', 'user', 'subscription', 'plan')
        }),
        ('Платёжные данные', {
            'fields': ('amount', 'currency', 'status', 'provider')
        }),
        ('YooKassa', {
            'fields': ('yookassa_payment_id', 'yookassa_payment_method_id')
        }),
        ('Настройки', {
            'fields': ('is_recurring', 'save_payment_method')
        }),
        ('Дополнительно', {
            'fields': ('description', 'error_message', 'metadata')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at', 'paid_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['id', 'created_at', 'updated_at']

    def get_status_display_colored(self, obj):
        """Цветное отображение статуса."""
        colors = {
            'PENDING': 'gray',
            'WAITING_FOR_CAPTURE': 'orange',
            'SUCCEEDED': 'green',
            'CANCELED': 'red',
            'FAILED': 'red',
            'REFUNDED': 'blue',
        }
        color = colors.get(obj.status, 'black')
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.get_status_display()}</span>'
        )

    get_status_display_colored.short_description = 'Статус'


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    """Админка для возвратов."""

    list_display = [
        'id',
        'payment',
        'amount',
        'get_status_display_colored',
        'created_at',
        'completed_at',
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['id', 'payment__id', 'yookassa_refund_id']
    ordering = ['-created_at']
    raw_id_fields = ['payment']

    fieldsets = (
        ('ID и связи', {
            'fields': ('id', 'payment')
        }),
        ('Данные возврата', {
            'fields': ('amount', 'status', 'yookassa_refund_id')
        }),
        ('Причина и ошибки', {
            'fields': ('reason', 'error_message')
        }),
        ('Даты', {
            'fields': ('created_at', 'updated_at', 'completed_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['id', 'created_at', 'updated_at']

    def get_status_display_colored(self, obj):
        """Цветное отображение статуса."""
        colors = {
            'PENDING': 'orange',
            'SUCCEEDED': 'green',
            'CANCELED': 'red',
        }
        color = colors.get(obj.status, 'black')
        return format_html(
            f'<span style="color: {color}; font-weight: bold;">{obj.get_status_display()}</span>'
        )

    get_status_display_colored.short_description = 'Статус'


@admin.register(DailyUsage)
class DailyUsageAdmin(admin.ModelAdmin):
    """Админка для ежедневного использования."""

    list_display = [
        'user',
        'date',
        'photo_ai_requests',
        'is_today_display',
        'created_at',
    ]
    list_filter = ['date', 'created_at']
    search_fields = ['user__email', 'user__username']
    ordering = ['-date', '-created_at']
    raw_id_fields = ['user']
    date_hierarchy = 'date'

    fieldsets = (
        ('Пользователь и дата', {
            'fields': ('user', 'date')
        }),
        ('Использование', {
            'fields': ('photo_ai_requests',)
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['created_at', 'updated_at']

    def is_today_display(self, obj):
        """Отображение, является ли запись сегодняшней."""
        if obj.is_today:
            return format_html('<span style="color: green; font-weight: bold;">✓ Сегодня</span>')
        return '-'

    is_today_display.short_description = 'Сегодня?'
