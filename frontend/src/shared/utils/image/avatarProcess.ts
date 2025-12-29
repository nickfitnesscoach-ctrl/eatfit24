/**
 * Utility for client-side avatar processing.
 * 
 * Features:
 * - Center-crop to 1:1 ratio.
 * - Resize to 320x320 pixels.
 * - Compress to JPEG with quality 0.8 (fallback to quality 0.6 if > 300KB).
 * - High performance using createImageBitmap where available.
 */

const TARGET_SIZE = 320;
const MAX_WEIGHT_BYTES = 300 * 1024; // 300 KB

/**
 * Processes an image file for avatar upload.
 */
export async function processAvatar(file: File): Promise<File> {
    let source: ImageBitmap | HTMLImageElement;

    // 1. Decode image
    try {
        if (typeof createImageBitmap === 'function') {
            source = await createImageBitmap(file);
        } else {
            source = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = URL.createObjectURL(file);
            });
        }
    } catch (err) {
        console.error('[AvatarProcess] Decode failed:', err);
        throw new Error('Не удалось обработать фото. Попробуйте другое изображение.');
    }

    try {
        // 2. Setup Canvas
        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Canvas context not available');
        }

        // 3. Calculate Center-Crop
        const { width, height } = source;
        const size = Math.min(width, height);
        const sx = (width - size) / 2;
        const sy = (height - size) / 2;

        // 4. Draw & Resize
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, sx, sy, size, size, 0, 0, TARGET_SIZE, TARGET_SIZE);

        // 5. Compress to Blob
        let blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', 0.8)
        );

        // 6. Optional: Second pass if too large
        if (blob && blob.size > MAX_WEIGHT_BYTES) {
            blob = await new Promise<Blob | null>(resolve =>
                canvas.toBlob(resolve, 'image/jpeg', 0.6)
            );
        }

        if (!blob) {
            throw new Error('Failed to generate image blob');
        }

        // 7. Return as File
        return new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
            type: 'image/jpeg',
            lastModified: Date.now()
        });

    } finally {
        // Cleanup
        if (source instanceof ImageBitmap) {
            source.close();
        } else if (source instanceof HTMLImageElement) {
            URL.revokeObjectURL(source.src);
        }
    }
}
