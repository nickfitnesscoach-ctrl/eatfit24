# Data migration: Copy existing Meal.photo to MealPhoto records

from django.db import migrations


def migrate_photos_forward(apps, schema_editor):
    """
    Copy existing Meal.photo to MealPhoto records.
    Each meal with a photo gets one MealPhoto with status=SUCCESS.
    """
    Meal = apps.get_model("nutrition", "Meal")
    MealPhoto = apps.get_model("nutrition", "MealPhoto")

    # Find all meals with photos
    meals_with_photos = Meal.objects.exclude(photo="").exclude(photo__isnull=True)

    photos_to_create = []
    for meal in meals_with_photos:
        photos_to_create.append(
            MealPhoto(
                meal=meal,
                image=meal.photo,  # Copy the file reference
                recognized_data={},  # No recognition data for legacy photos
                status="SUCCESS",  # Assume processed successfully
                error_message=None,
            )
        )

    # Bulk create for efficiency
    if photos_to_create:
        MealPhoto.objects.bulk_create(photos_to_create, batch_size=500)


def migrate_photos_backward(apps, schema_editor):
    """
    Reverse: Delete MealPhoto records that were migrated from Meal.photo.
    Note: This will NOT restore photos that were deleted after migration.
    """
    MealPhoto = apps.get_model("nutrition", "MealPhoto")

    # Delete all MealPhoto records with empty recognized_data (migrated from legacy)
    # This is a safe heuristic - new photos will have recognition data
    MealPhoto.objects.filter(recognized_data={}).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("nutrition", "0004_meal_status_mealphoto"),
    ]

    operations = [
        migrations.RunPython(
            migrate_photos_forward,
            migrate_photos_backward,
        ),
    ]
