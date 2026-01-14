"""
Management command to clean up old meal photos.

Usage:
    python manage.py cleanup_old_meal_photos --days 90 --dry-run
    python manage.py cleanup_old_meal_photos --days 180
"""

from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage
from django.utils import timezone
from datetime import timedelta

from apps.nutrition.models import MealPhoto


class Command(BaseCommand):
    help = "Delete meal photos older than retention period"

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=90,
            help="Retention period in days (default: 90)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be deleted without actually deleting",
        )
        parser.add_argument(
            "--status",
            type=str,
            choices=["SUCCESS", "FAILED", "CANCELLED", "ALL"],
            default="ALL",
            help="Only delete photos with specific status (default: ALL)",
        )

    def handle(self, *args, **options):
        retention_days = options["days"]
        dry_run = options["dry_run"]
        status_filter = options["status"]

        threshold = timezone.now() - timedelta(days=retention_days)

        # Build query
        queryset = MealPhoto.objects.filter(created_at__lt=threshold)

        if status_filter != "ALL":
            queryset = queryset.filter(status=status_filter)

        total_size = 0
        deleted_count = 0
        orphaned_files = []

        self.stdout.write(
            self.style.WARNING(
                f"\n{'DRY RUN: ' if dry_run else ''}Searching for photos older than {retention_days} days "
                f"(before {threshold.date()})...\n"
            )
        )

        # Process photos
        for photo in queryset.iterator(chunk_size=100):
            # Check if file exists in storage
            if photo.image and default_storage.exists(photo.image.name):
                try:
                    file_size = default_storage.size(photo.image.name)
                    total_size += file_size

                    if not dry_run:
                        # Delete file from storage
                        default_storage.delete(photo.image.name)
                        # Delete database record
                        photo.delete()

                    deleted_count += 1

                    if deleted_count <= 10 or dry_run:
                        self.stdout.write(
                            f"  {'Would delete' if dry_run else 'Deleted'}: "
                            f"{photo.image.name} ({file_size / 1024:.2f} KB) "
                            f"[{photo.get_status_display()}]"
                        )
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f"  Error processing {photo.image.name}: {e}")
                    )
            else:
                # File missing but DB record exists (orphaned record)
                orphaned_files.append(photo.id)
                if not dry_run:
                    photo.delete()

        # Summary
        self.stdout.write("\n" + "=" * 70)
        action = "Would delete" if dry_run else "Deleted"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} {deleted_count} meal photos "
                f"({total_size / 1024 / 1024:.2f} MB) "
                f"older than {retention_days} days"
            )
        )

        if orphaned_files:
            self.stdout.write(
                self.style.WARNING(
                    f"Found {len(orphaned_files)} orphaned DB records (file missing): "
                    f"{'would clean' if dry_run else 'cleaned'}"
                )
            )

        if status_filter != "ALL":
            self.stdout.write(self.style.WARNING(f"Status filter: {status_filter}"))

        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    "\nℹ️  This was a DRY RUN. Run without --dry-run to actually delete files."
                )
            )

        self.stdout.write("=" * 70 + "\n")
