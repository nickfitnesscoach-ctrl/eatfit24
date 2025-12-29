#!/bin/bash
# Migrate media files from Docker volume to bind mount
# Run this ONCE before deploying the new compose.yml
#
# Usage: ./scripts/migrate-media-to-bind-mount.sh

set -euo pipefail

MEDIA_PATH="/opt/eatfit24/media"
VOLUME_NAME="eatfit24-backend-media"

echo "=== EatFit24 Media Migration ==="
echo ""

# 1. Create target directory
echo "1. Creating target directory: $MEDIA_PATH"
sudo mkdir -p "$MEDIA_PATH"
sudo chown -R 1000:1000 "$MEDIA_PATH"  # Match container user

# 2. Check if volume exists and has data
if docker volume inspect "$VOLUME_NAME" &>/dev/null; then
    echo "2. Found existing volume: $VOLUME_NAME"

    # Get volume mountpoint
    VOLUME_PATH=$(docker volume inspect "$VOLUME_NAME" --format '{{ .Mountpoint }}')
    echo "   Volume path: $VOLUME_PATH"

    # Check if volume has files
    FILE_COUNT=$(sudo find "$VOLUME_PATH" -type f 2>/dev/null | wc -l)
    echo "   Files in volume: $FILE_COUNT"

    if [ "$FILE_COUNT" -gt 0 ]; then
        echo "3. Copying files from volume to bind mount..."
        sudo cp -rp "$VOLUME_PATH"/* "$MEDIA_PATH"/ 2>/dev/null || true
        echo "   Done! Copied files to $MEDIA_PATH"
    else
        echo "3. Volume is empty, skipping copy"
    fi
else
    echo "2. No existing volume found (fresh install)"
fi

# 3. Set permissions
echo "4. Setting permissions..."
sudo chown -R 1000:1000 "$MEDIA_PATH"
sudo chmod -R 755 "$MEDIA_PATH"

# 4. Verify
echo ""
echo "=== Verification ==="
echo "Directory: $MEDIA_PATH"
ls -la "$MEDIA_PATH" 2>/dev/null || echo "(empty)"
echo ""

echo "=== Migration Complete ==="
echo ""
echo "Next steps:"
echo "1. Deploy new compose.yml: docker compose up -d --build"
echo "2. Copy nginx config to server: /etc/nginx/sites-available/eatfit24.ru"
echo "3. Test nginx config: sudo nginx -t"
echo "4. Reload nginx: sudo systemctl reload nginx"
echo "5. Test media access: curl -I https://eatfit24.ru/media/uploads/..."
