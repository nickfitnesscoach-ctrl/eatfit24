# Generated manually for multi-photo meal support

import apps.common.storage
import apps.common.validators
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("nutrition", "0003_meal_photo"),
    ]

    operations = [
        # Add status field to Meal
        migrations.AddField(
            model_name="meal",
            name="status",
            field=models.CharField(
                choices=[
                    ("DRAFT", "Черновик"),
                    ("PROCESSING", "Обработка"),
                    ("COMPLETE", "Готово"),
                ],
                default="COMPLETE",
                max_length=20,
                verbose_name="Статус",
            ),
        ),
        # Add composite index for draft meal lookup
        migrations.AddIndex(
            model_name="meal",
            index=models.Index(
                fields=["user", "meal_type", "date", "status", "created_at"],
                name="nutrition_m_user_id_8a4f2e_idx",
            ),
        ),
        # Create MealPhoto model
        migrations.CreateModel(
            name="MealPhoto",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "image",
                    models.ImageField(
                        upload_to=apps.common.storage.upload_to_meal_photos,
                        validators=[
                            apps.common.validators.FileSizeValidator(max_mb=10),
                            apps.common.validators.ImageDimensionValidator(
                                max_height=4096, max_width=4096
                            ),
                        ],
                        verbose_name="Фотография",
                    ),
                ),
                (
                    "recognized_data",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Per-photo AI recognition result (items, totals, meta)",
                        verbose_name="Результат распознавания",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDING", "Ожидание"),
                            ("PROCESSING", "Обработка"),
                            ("SUCCESS", "Успешно"),
                            ("FAILED", "Ошибка"),
                        ],
                        default="PENDING",
                        max_length=20,
                        verbose_name="Статус обработки",
                    ),
                ),
                (
                    "error_message",
                    models.TextField(
                        blank=True, null=True, verbose_name="Сообщение об ошибке"
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, verbose_name="Создано"),
                ),
                (
                    "meal",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="nutrition.meal",
                        verbose_name="Приём пищи",
                    ),
                ),
            ],
            options={
                "verbose_name": "Фото приёма пищи",
                "verbose_name_plural": "Фото приёмов пищи",
                "db_table": "nutrition_meal_photos",
                "ordering": ["created_at"],
            },
        ),
        # Add index for MealPhoto status lookup
        migrations.AddIndex(
            model_name="mealphoto",
            index=models.Index(
                fields=["meal", "status"], name="nutrition_m_meal_id_d3b1c2_idx"
            ),
        ),
    ]
