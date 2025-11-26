"""
Модели и сервисы для учета использования API (фото, запросы к AI).
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import date as dt_date


class DailyUsageManager(models.Manager):
    """Менеджер для работы с DailyUsage."""

    def get_today(self, user):
        """
        Получает или создает запись DailyUsage на сегодня для пользователя.

        Args:
            user: Объект пользователя

        Returns:
            DailyUsage: Запись на сегодня
        """
        today = timezone.now().date()
        usage, created = self.get_or_create(
            user=user,
            date=today,
            defaults={'photo_ai_requests': 0}
        )
        return usage

    def increment_photo_requests(self, user):
        """
        Инкрементирует счетчик фото-запросов для пользователя на сегодня.

        Args:
            user: Объект пользователя

        Returns:
            DailyUsage: Обновленная запись
        """
        usage = self.get_today(user)
        usage.photo_ai_requests += 1
        usage.save()
        return usage


class DailyUsage(models.Model):
    """
    Учет ежедневного использования API пользователем.

    Отслеживает количество фото-запросов к AI для каждого пользователя по дням.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_usage',
        verbose_name='Пользователь'
    )
    date = models.DateField('Дата', default=dt_date.today)
    photo_ai_requests = models.IntegerField(
        'Количество фото-запросов к AI',
        default=0,
        help_text='Количество распознанных фото за день'
    )

    # Metadata
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    objects = DailyUsageManager()

    class Meta:
        db_table = 'daily_usage'
        verbose_name = 'Ежедневное использование'
        verbose_name_plural = 'Ежедневное использование'
        unique_together = [['user', 'date']]
        ordering = ['-date']
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['-date']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.date}: {self.photo_ai_requests} фото"

    @property
    def is_today(self):
        """Проверяет, является ли эта запись сегодняшней."""
        return self.date == timezone.now().date()
