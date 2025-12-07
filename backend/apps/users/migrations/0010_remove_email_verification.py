"""
Migration to remove email verification functionality.

EatFit24 now uses Telegram WebApp authentication only.
This migration:
1. Removes the email_verified field from Profile
2. Drops the EmailVerificationToken table
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_remove_profile_recommended_calories_max_and_more'),
    ]

    operations = [
        # Remove email_verified field from Profile
        migrations.RemoveField(
            model_name='profile',
            name='email_verified',
        ),
        # Delete EmailVerificationToken model
        migrations.DeleteModel(
            name='EmailVerificationToken',
        ),
    ]
