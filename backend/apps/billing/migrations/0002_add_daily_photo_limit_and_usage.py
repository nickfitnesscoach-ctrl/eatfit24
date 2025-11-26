# Generated manually

import datetime
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add daily_photo_limit field to SubscriptionPlan
        migrations.AddField(
            model_name='subscriptionplan',
            name='daily_photo_limit',
            field=models.IntegerField(
                blank=True,
                help_text='Максимум фото в день. Null = безлимит',
                null=True,
                verbose_name='Лимит фото в день'
            ),
        ),

        # Create DailyUsage model
        migrations.CreateModel(
            name='DailyUsage',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID'
                    )
                ),
                (
                    'date',
                    models.DateField(
                        default=datetime.date.today,
                        verbose_name='Дата'
                    )
                ),
                (
                    'photo_ai_requests',
                    models.IntegerField(
                        default=0,
                        help_text='Количество распознанных фото за день',
                        verbose_name='Количество фото-запросов к AI'
                    )
                ),
                (
                    'created_at',
                    models.DateTimeField(
                        auto_now_add=True,
                        verbose_name='Создано'
                    )
                ),
                (
                    'updated_at',
                    models.DateTimeField(
                        auto_now=True,
                        verbose_name='Обновлено'
                    )
                ),
                (
                    'user',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='daily_usage',
                        to=settings.AUTH_USER_MODEL,
                        verbose_name='Пользователь'
                    )
                ),
            ],
            options={
                'verbose_name': 'Ежедневное использование',
                'verbose_name_plural': 'Ежедневное использование',
                'db_table': 'daily_usage',
                'ordering': ['-date'],
            },
        ),

        # Add unique constraint for user+date
        migrations.AddConstraint(
            model_name='dailyusage',
            constraint=models.UniqueConstraint(
                fields=['user', 'date'],
                name='unique_user_date'
            ),
        ),

        # Add indexes
        migrations.AddIndex(
            model_name='dailyusage',
            index=models.Index(
                fields=['user', 'date'],
                name='daily_usage_user_date_idx'
            ),
        ),
        migrations.AddIndex(
            model_name='dailyusage',
            index=models.Index(
                fields=['-date'],
                name='daily_usage_date_idx'
            ),
        ),
    ]
