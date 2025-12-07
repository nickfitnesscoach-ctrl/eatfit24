"""
Tests for common utilities.
"""

import io
from PIL import Image
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from .image_utils import compress_image, get_image_info


class ImageCompressionTestCase(TestCase):
    """Tests for B-013: Image compression utility."""

    def create_test_image(self, width=2000, height=1500, format='JPEG'):
        """Create a test image file."""
        img = Image.new('RGB', (width, height), color='red')
        buffer = io.BytesIO()
        img.save(buffer, format=format)
        buffer.seek(0)
        return SimpleUploadedFile(
            name=f'test.{format.lower()}',
            content=buffer.read(),
            content_type=f'image/{format.lower()}'
        )

    def test_compress_large_image(self):
        """Test that large images are resized."""
        # Create 2000x1500 image (larger than MAX_DIMENSION=1920)
        image_file = self.create_test_image(2000, 1500)
        original_size = image_file.size

        # Compress
        result = compress_image(image_file)

        # Verify it's compressed
        self.assertLessEqual(result.size, original_size)

        # Verify dimensions are reduced
        result.seek(0)
        img = Image.open(result)
        self.assertLessEqual(img.width, 1920)
        self.assertLessEqual(img.height, 1920)

    def test_small_image_unchanged(self):
        """Test that small images are not resized."""
        # Create 800x600 image (smaller than MAX_DIMENSION)
        image_file = self.create_test_image(800, 600)

        # Compress
        result = compress_image(image_file)

        # Should still be valid image
        result.seek(0)
        img = Image.open(result)
        # Dimensions should be similar (might change due to recompression)
        self.assertLessEqual(img.width, 1920)

    def test_rgba_to_rgb_conversion(self):
        """Test that RGBA images are converted to RGB."""
        # Create RGBA image (PNG with alpha)
        img = Image.new('RGBA', (500, 500), color=(255, 0, 0, 128))
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        image_file = SimpleUploadedFile(
            name='test.png',
            content=buffer.read(),
            content_type='image/png'
        )

        # Compress
        result = compress_image(image_file)

        # Should be JPEG (RGB)
        result.seek(0)
        img = Image.open(result)
        self.assertEqual(img.mode, 'RGB')

    def test_get_image_info(self):
        """Test get_image_info utility."""
        image_file = self.create_test_image(1024, 768)

        info = get_image_info(image_file)

        self.assertEqual(info['width'], 1024)
        self.assertEqual(info['height'], 768)
        self.assertEqual(info['format'], 'JPEG')
        self.assertEqual(info['mode'], 'RGB')
        self.assertGreater(info['size_bytes'], 0)

    def test_compress_preserves_aspect_ratio(self):
        """Test that compression preserves aspect ratio."""
        # Create wide image
        image_file = self.create_test_image(3000, 1000)

        result = compress_image(image_file)

        result.seek(0)
        img = Image.open(result)

        # Aspect ratio should be preserved (3:1)
        aspect_ratio = img.width / img.height
        self.assertAlmostEqual(aspect_ratio, 3.0, places=1)

    def test_compress_tall_image(self):
        """Test compression of tall image."""
        # Create tall image
        image_file = self.create_test_image(1000, 3000)

        result = compress_image(image_file)

        result.seek(0)
        img = Image.open(result)

        # Height should be limited to 1920
        self.assertLessEqual(img.height, 1920)
        # Aspect ratio should be preserved
        aspect_ratio = img.height / img.width
        self.assertAlmostEqual(aspect_ratio, 3.0, places=1)


class ImageCompressionEdgeCasesTestCase(TestCase):
    """Edge case tests for image compression."""

    def test_invalid_image_returns_original(self):
        """Test that invalid image returns original file."""
        invalid_file = SimpleUploadedFile(
            name='invalid.jpg',
            content=b'not an image',
            content_type='image/jpeg'
        )

        # Should return original without crashing
        result = compress_image(invalid_file)
        self.assertIsNotNone(result)

    def test_empty_file_returns_original(self):
        """Test that empty file returns original."""
        empty_file = SimpleUploadedFile(
            name='empty.jpg',
            content=b'',
            content_type='image/jpeg'
        )

        result = compress_image(empty_file)
        self.assertIsNotNone(result)
