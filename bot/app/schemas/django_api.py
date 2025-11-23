"""
Pydantic схемы для валидации Django API запросов и ответов.
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


class TestAnswers(BaseModel):
    """Ответы пользователя на опрос."""

    model_config = ConfigDict(str_strip_whitespace=True)

    age: Optional[int] = Field(None, ge=10, le=120, description="Возраст пользователя")
    gender: Optional[str] = Field(None, pattern="^(male|female)$", description="Пол")
    weight: float = Field(ge=20.0, le=300.0, description="Текущий вес в кг")
    height: int = Field(ge=100, le=250, description="Рост в см")
    activity_level: str = Field(
        pattern="^(minimal|low|medium|high)$",
        description="Уровень активности"
    )
    goal: str = Field(
        default="maintenance",
        pattern="^(weight_loss|weight_gain|maintenance)$",
        description="Цель пользователя"
    )
    target_weight: Optional[float] = Field(
        None,
        ge=20.0,
        le=300.0,
        description="Целевой вес в кг"
    )
    timezone: Optional[str] = Field(None, max_length=100, description="Часовой пояс IANA")
    training_level: Optional[str] = Field(None, max_length=50, description="Уровень тренированности")
    goals: Optional[List[str]] = Field(default_factory=list, description="Цели тренировок")
    health_restrictions: Optional[List[str]] = Field(
        default_factory=list,
        description="Ограничения по здоровью"
    )
    current_body_type: Optional[int] = Field(None, ge=1, le=10, description="ID текущего телосложения")
    ideal_body_type: Optional[int] = Field(None, ge=1, le=10, description="ID желаемого телосложения")

    @field_validator("goals", "health_restrictions", mode="before")
    @classmethod
    def ensure_list(cls, v):
        """Преобразует None в пустой список."""
        if v is None:
            return []
        return v

    @field_validator("target_weight")
    @classmethod
    def validate_target_weight(cls, v, info):
        """Валидирует, что целевой вес не совпадает с текущим."""
        if v is not None and "weight" in info.data:
            current_weight = info.data["weight"]
            if abs(v - current_weight) < 0.1:
                raise ValueError("Target weight must differ from current weight")
        return v


class SaveTestRequest(BaseModel):
    """Запрос на сохранение результатов теста в Django."""

    model_config = ConfigDict(str_strip_whitespace=True)

    telegram_id: int = Field(gt=0, description="Telegram user ID")
    first_name: str = Field(min_length=1, max_length=150, description="Имя пользователя")
    last_name: str = Field(default="", max_length=150, description="Фамилия пользователя")
    username: str = Field(default="", max_length=150, description="Username в Telegram")
    answers: TestAnswers = Field(description="Ответы пользователя на опрос")

    @field_validator("first_name", "last_name", "username")
    @classmethod
    def clean_string(cls, v):
        """Удаляет лишние пробелы."""
        return v.strip() if v else ""


class SaveTestResponse(BaseModel):
    """Ответ Django API после сохранения теста."""

    model_config = ConfigDict(extra="allow")

    user_id: int = Field(gt=0, description="ID пользователя в Django")
    telegram_id: int = Field(gt=0, description="Telegram user ID")
    status: str = Field(description="Статус операции")
    message: Optional[str] = Field(None, description="Сообщение")
    created: bool = Field(default=False, description="Создан ли новый пользователь")


class DjangoAPIError(BaseModel):
    """Ошибка Django API."""

    model_config = ConfigDict(extra="allow")

    error: str = Field(description="Описание ошибки")
    detail: Optional[str] = Field(None, description="Детали ошибки")
    code: Optional[str] = Field(None, description="Код ошибки")
    field_errors: Optional[Dict[str, List[str]]] = Field(
        None,
        description="Ошибки валидации по полям"
    )
