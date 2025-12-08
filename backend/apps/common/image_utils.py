"""
B-013: Image compression utilities for FoodMind AI.

Compresses uploaded images to reduce storage and bandwidth usage
while maintaining acceptable quality for AI recognition.
"""

import io
import logging
from PIL import Image
from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Configuration
MAX_DIMENSION = 1920  # Max width or height
JPEG_QUALITY = 85     # JPEG quality (1-100)
PNG_COMPRESSION = 6   # PNG compression level (0-9)


def compress_image(image_file, max_dimension=MAX_DIMENSION, quality=JPEG_QUALITY):
    """
    Compress an uploaded image file.
    
    - Resizes if larger than max_dimension (preserving aspect ratio)
    - Converts to RGB if necessary (removes alpha channel for JPEG)
    - Compresses with specified quality
    
    Args:
        image_file: Django UploadedFile or file-like object
        max_dimension: Maximum width or height in pixels
        quality: JPEG quality (1-100)
    
    Returns:
        ContentFile with compressed image, or original if compression fails
    """
    try:
        # Open image
        image_file.seek(0)
        img = Image.open(image_file)
        original_format = img.format or 'JPEG'
        original_size = image_file.size if hasattr(image_file, 'size') else 0
        
        # Get original dimensions
        width, height = img.size
        
        # Check if resize is needed
        if width > max_dimension or height > max_dimension:
            # Calculate new dimensions preserving aspect ratio
            if width > height:
                new_width = max_dimension
                new_height = int(height * (max_dimension / width))
            else:
                new_height = max_dimension
                new_width = int(width * (max_dimension / height))
            
            # Resize with high-quality resampling
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.debug(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # Convert RGBA to RGB for JPEG (removes transparency)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Create white background
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Save to buffer
        buffer = io.BytesIO()
        
        # Always save as JPEG for best compression (unless PNG is necessary)
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        
        compressed_size = buffer.tell()
        buffer.seek(0)
        
        # Only use compressed version if it's actually smaller
        if compressed_size < original_size:
            logger.info(
                f"Compressed image: {original_size/1024:.1f}KB -> {compressed_size/1024:.1f}KB "
                f"({100 - compressed_size/original_size*100:.1f}% reduction)"
            )
            
            # Generate filename with .jpg extension
            original_name = getattr(image_file, 'name', 'image.jpg')
            new_name = original_name.rsplit('.', 1)[0] + '.jpg'

            # Create ContentFile with explicit content_type for JPEG
            compressed_file = ContentFile(buffer.read(), name=new_name)
            compressed_file.content_type = 'image/jpeg'
            return compressed_file
        else:
            logger.debug(f"Skipping compression - original is smaller ({original_size} <= {compressed_size})")
            image_file.seek(0)
            return image_file
            
    except Exception as e:
        logger.warning(f"Image compression failed: {e}, using original")
        if hasattr(image_file, 'seek'):
            image_file.seek(0)
        return image_file


def get_image_info(image_file):
    """
    Get information about an image file.
    
    Args:
        image_file: Django UploadedFile or file-like object
        
    Returns:
        dict with format, width, height, mode, size_bytes
    """
    try:
        image_file.seek(0)
        img = Image.open(image_file)
        info = {
            'format': img.format,
            'width': img.size[0],
            'height': img.size[1],
            'mode': img.mode,
            'size_bytes': image_file.size if hasattr(image_file, 'size') else 0
        }
        image_file.seek(0)
        return info
    except Exception as e:
        logger.warning(f"Failed to get image info: {e}")
        return None
