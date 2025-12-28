import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import type { MealPhoto } from '../../types/meal';

interface MealPhotoGalleryProps {
    photos: MealPhoto[];
    /** Fallback single photo URL (backward compatibility) */
    fallbackPhotoUrl?: string | null;
    /** Size preset */
    size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20',
};

/**
 * Horizontal swipeable gallery for multi-photo meals.
 * Shows a single image when only one photo exists.
 */
export const MealPhotoGallery: React.FC<MealPhotoGalleryProps> = ({
    photos,
    fallbackPhotoUrl,
    size = 'md',
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Filter to only show successful photos with URLs
    const successfulPhotos = photos.filter(
        (p) => p.status === 'SUCCESS' && p.image_url
    );

    // Use fallback if no multi-photo data
    const hasPhotos = successfulPhotos.length > 0;
    const photoUrls = hasPhotos
        ? successfulPhotos.map((p) => p.image_url!)
        : fallbackPhotoUrl
        ? [fallbackPhotoUrl]
        : [];

    if (photoUrls.length === 0) {
        // No photos - show placeholder
        return (
            <div
                className={`${SIZE_CLASSES[size]} bg-gray-100 rounded-lg flex items-center justify-center`}
            >
                <ImageIcon size={20} className="text-gray-300" />
            </div>
        );
    }

    if (photoUrls.length === 1) {
        // Single photo - just show it
        return (
            <img
                src={photoUrls[0]}
                alt="Фото еды"
                className={`${SIZE_CLASSES[size]} object-cover rounded-lg`}
            />
        );
    }

    // Multiple photos - show gallery with navigation
    const goToPrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === 0 ? photoUrls.length - 1 : prev - 1));
    };

    const goToNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev === photoUrls.length - 1 ? 0 : prev + 1));
    };

    return (
        <div className="relative group">
            {/* Main image */}
            <img
                src={photoUrls[currentIndex]}
                alt={`Фото еды ${currentIndex + 1} из ${photoUrls.length}`}
                className={`${SIZE_CLASSES[size]} object-cover rounded-lg`}
            />

            {/* Photo counter badge */}
            <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] px-1 rounded">
                {currentIndex + 1}/{photoUrls.length}
            </div>

            {/* Navigation arrows (visible on hover) */}
            <button
                onClick={goToPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-black/40 text-white p-0.5 rounded-r opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Предыдущее фото"
            >
                <ChevronLeft size={14} />
            </button>
            <button
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-black/40 text-white p-0.5 rounded-l opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Следующее фото"
            >
                <ChevronRight size={14} />
            </button>
        </div>
    );
};

/**
 * Compact photo strip showing all photos in a row.
 * Good for meal cards where space is limited.
 */
export const MealPhotoStrip: React.FC<MealPhotoGalleryProps> = ({
    photos,
    fallbackPhotoUrl,
}) => {
    // Filter to only show successful photos with URLs
    const successfulPhotos = photos.filter(
        (p) => p.status === 'SUCCESS' && p.image_url
    );

    // Use fallback if no multi-photo data
    const photoUrls = successfulPhotos.length > 0
        ? successfulPhotos.map((p) => p.image_url!)
        : fallbackPhotoUrl
        ? [fallbackPhotoUrl]
        : [];

    if (photoUrls.length === 0) {
        return null;
    }

    // Show up to 3 photos in a strip
    const displayPhotos = photoUrls.slice(0, 3);
    const remainingCount = photoUrls.length - displayPhotos.length;

    return (
        <div className="flex items-center gap-1">
            {displayPhotos.map((url, i) => (
                <img
                    key={i}
                    src={url}
                    alt={`Фото ${i + 1}`}
                    className="w-10 h-10 object-cover rounded-md"
                />
            ))}
            {remainingCount > 0 && (
                <div className="w-10 h-10 bg-gray-100 rounded-md flex items-center justify-center text-xs text-gray-500 font-medium">
                    +{remainingCount}
                </div>
            )}
        </div>
    );
};
