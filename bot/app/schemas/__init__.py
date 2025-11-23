"""
Pydantic схемы для валидации данных.
"""

from .django_api import (
    TestAnswers,
    SaveTestRequest,
    SaveTestResponse,
    DjangoAPIError,
)

__all__ = [
    "TestAnswers",
    "SaveTestRequest",
    "SaveTestResponse",
    "DjangoAPIError",
]
