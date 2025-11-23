"""
Pydantic схемы для валидации данных.
"""

from .django_api import (
    DjangoAPIError,
    SaveTestRequest,
    SaveTestResponse,
    TestAnswers,
)

__all__ = [
    "TestAnswers",
    "SaveTestRequest",
    "SaveTestResponse",
    "DjangoAPIError",
]
