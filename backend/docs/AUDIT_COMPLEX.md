# Аналитический отчёт: Backend Architecture Refactoring Plan

## 1. Текущее состояние архитектуры

### 1.1 Общая структура
```
backend/
├── apps/
│   ├── users/          # Профили, аутентификация
│   ├── nutrition/      # Приёмы пищи, КБЖУ
│   ├── billing/        # Подписки, платежи YooKassa
│   ├── ai/             # Распознавание еды
│   ├── ai_proxy/       # Клиент AI Proxy сервиса
│   ├── telegram/       # Telegram интеграция
│   ├── core/           # Базовые исключения
│   └── common/         # Утилиты, хранилище
├── config/
│   └── settings/       # base.py, local.py, production.py
└── manage.py
```

### 1.2 Текущие паттерны

| Компонент | Текущая реализация | Проблемы |
|-----------|-------------------|----------|
| **Views** | `APIView`, `generics.*` (DRF) | Бизнес-логика смешана с HTTP-слоем |
| **Services** | Функции и классы в `services.py` | Нет единого интерфейса, разная структура |
| **Models** | Django ORM напрямую в views | Нет абстракции DAL/Repository |
| **Serializers** | DRF Serializers | Часть валидации в serializers, часть в views |
| **Exceptions** | Иерархия в `core/exceptions.py` | Не везде используется, часто `Response()` напрямую |
| **DI** | Нет явного DI | Сервисы создаются инлайн, синглтоны через globals |

---

## 2. Идентифицированные проблемы

### 2.1 Смешение слоёв (Separation of Concerns)

**Пример из `nutrition/views.py`:**
```python
# View содержит бизнес-логику
def get(self, request, *args, **kwargs):
    stats = get_daily_stats(request.user, target_date)  # OK - вызов сервиса
    # Но затем формирование response напрямую...
    data = {
        'daily_goal': DailyGoalSerializer(stats['daily_goal']).data,
        ...
    }
```

**Пример из `billing/views.py`:**
```python
# Transaction и бизнес-логика прямо во view
with transaction.atomic():
    payment = Payment.objects.create(...)
    yookassa_service = YooKassaService()  # Создание сервиса инлайн
    yookassa_payment = yookassa_service.create_payment(...)
```

### 2.2 Inconsistent Service Layer

| Приложение | Структура services.py |
|------------|----------------------|
| `users` | `EmailVerificationService` - класс со статическими методами |
| `nutrition` | Функции `get_daily_stats()`, `create_auto_goal()` |
| `billing` | `YooKassaService` класс + отдельные функции |
| `ai` | `AIRecognitionService` класс + `recognize_and_save_meal()` функция |
| `telegram` | `TelegramWebAppAuthService` - хороший пример |

### 2.3 Отсутствие Repository/DAL

Прямые ORM-запросы везде:
```python
# views.py
Meal.objects.filter(user=request.user).prefetch_related('items')

# services.py  
DailyGoal.objects.get(user=user, is_active=True)

# Нет центрального места для кеширования, логирования запросов
```

### 2.4 Error Handling

Отличная иерархия исключений в `core/exceptions.py`, но:
- Не используется консистентно
- Views часто возвращают `Response()` напрямую вместо raise exceptions
- Нет глобального exception handler

### 2.5 DI & Testing

- Сервисы создаются инлайн: `YooKassaService()`, `AIProxyRecognitionService()`
- Сложно мокать для unit-тестов
- Синглтон через `get_webapp_auth_service()` - лучше, но не систематично

---

## 3. Целевая архитектура

### 3.1 Clean Architecture (адаптированная для Django)

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Views     │  │ Serializers │  │  Exception Handler  │  │
│  │ (APIView)   │  │ (Input/Out) │  │   (Global DRF)      │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
└─────────┼────────────────┼──────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Use Cases / Services                        ││
│  │  • CreateMealUseCase                                    ││
│  │  • RecognizeFoodUseCase                                 ││
│  │  • CreatePaymentUseCase                                 ││
│  │  • GetDailyStatsUseCase                                 ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│  ┌───────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │    Entities   │  │ Domain Services  │  │  Exceptions   │ │
│  │ (Models.py)   │  │ (KBJU calc, etc) │  │  (core/)      │ │
│  └───────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Repositories │  │  Gateways    │  │  External Services │ │
│  │ (ORM wrap)   │  │ (AI, Payment)│  │  (YooKassa client) │ │
│  └──────────────┘  └──────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Новая структура директорий

```
apps/
├── core/
│   ├── exceptions.py       # Иерархия исключений (уже есть)
│   ├── interfaces/         # Абстрактные классы
│   │   ├── repositories.py # ABC для репозиториев
│   │   └── gateways.py     # ABC для внешних сервисов
│   └── container.py        # Dependency Injection container
│
├── users/
│   ├── domain/
│   │   ├── entities.py     # Profile, EmailVerificationToken
│   │   └── services.py     # KBJU calculation, BMI
│   ├── application/
│   │   └── use_cases.py    # RegisterUser, VerifyEmail, UpdateProfile
│   ├── infrastructure/
│   │   ├── repositories.py # UserRepository, ProfileRepository
│   │   └── email_service.py # Email sending implementation
│   ├── presentation/
│   │   ├── views.py        # Thin views, delegate to use_cases
│   │   └── serializers.py  # Input/Output serializers
│   ├── models.py           # Django models (ORM)
│   └── urls.py
│
├── nutrition/
│   ├── domain/
│   │   ├── entities.py     # Meal, FoodItem, DailyGoal
│   │   └── services.py     # Nutrition calculation
│   ├── application/
│   │   └── use_cases.py    # CreateMeal, AddFoodItem, GetDailyStats
│   ├── infrastructure/
│   │   └── repositories.py # MealRepository, DailyGoalRepository
│   ├── presentation/
│   │   ├── views.py
│   │   └── serializers.py
│   ├── models.py
│   └── urls.py
│
├── billing/
│   ├── domain/
│   │   ├── entities.py     # Subscription, Payment, Plan
│   │   └── services.py     # Subscription logic
│   ├── application/
│   │   └── use_cases.py    # CreatePayment, ActivateSubscription
│   ├── infrastructure/
│   │   ├── repositories.py # SubscriptionRepository, PaymentRepository
│   │   └── yookassa_gateway.py  # YooKassa integration
│   ├── presentation/
│   │   ├── views.py
│   │   ├── serializers.py
│   │   └── webhooks.py     # Webhook handlers
│   ├── models.py
│   └── urls.py
│
├── ai/
│   ├── domain/
│   │   └── services.py     # Recognition result processing
│   ├── application/
│   │   └── use_cases.py    # RecognizeFood, ProcessRecognitionResult
│   ├── infrastructure/
│   │   └── ai_proxy_gateway.py  # AI Proxy client
│   ├── presentation/
│   │   ├── views.py
│   │   └── serializers.py
│   └── urls.py
```

---

## 4. Конкретные изменения по компонентам

### 4.1 Repository Pattern

**Создать `core/interfaces/repositories.py`:**
```python
from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional, List

T = TypeVar('T')

class BaseRepository(ABC, Generic[T]):
    """Abstract base class for all repositories."""
    
    @abstractmethod
    def get_by_id(self, id: int) -> Optional[T]:
        pass
    
    @abstractmethod
    def save(self, entity: T) -> T:
        pass
    
    @abstractmethod
    def delete(self, entity: T) -> None:
        pass
```

**Пример `nutrition/infrastructure/repositories.py`:**
```python
from typing import Optional, List
from datetime import date
from django.contrib.auth.models import User

from apps.core.interfaces.repositories import BaseRepository
from apps.nutrition.models import Meal, DailyGoal


class MealRepository(BaseRepository[Meal]):
    """Repository for Meal entity."""
    
    def get_by_id(self, id: int) -> Optional[Meal]:
        try:
            return Meal.objects.select_related('user').prefetch_related('items').get(id=id)
        except Meal.DoesNotExist:
            return None
    
    def get_by_user_and_date(self, user: User, target_date: date) -> List[Meal]:
        return list(
            Meal.objects
            .filter(user=user, date=target_date)
            .prefetch_related('items')
            .order_by('created_at')
        )
    
    def save(self, meal: Meal) -> Meal:
        meal.save()
        return meal
    
    def delete(self, meal: Meal) -> None:
        meal.delete()


class DailyGoalRepository(BaseRepository[DailyGoal]):
    """Repository for DailyGoal entity."""
    
    def get_active_for_user(self, user: User) -> Optional[DailyGoal]:
        try:
            return DailyGoal.objects.get(user=user, is_active=True)
        except DailyGoal.DoesNotExist:
            return None
    
    def deactivate_all_for_user(self, user: User) -> int:
        return DailyGoal.objects.filter(user=user, is_active=True).update(is_active=False)
    
    # ... остальные методы
```

### 4.2 Use Cases (Application Layer)

**Пример `nutrition/application/use_cases.py`:**
```python
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional
from django.contrib.auth.models import User

from apps.core.exceptions import NotFoundError, ValidationError
from apps.nutrition.infrastructure.repositories import MealRepository, DailyGoalRepository
from apps.nutrition.models import Meal, FoodItem


@dataclass
class DailyStatsResult:
    """Result of GetDailyStats use case."""
    date: date
    daily_goal: Optional[Dict]
    total_consumed: Dict[str, float]
    progress: Dict[str, float]
    meals: List[Meal]


class GetDailyStatsUseCase:
    """Get daily nutrition statistics for a user."""
    
    def __init__(
        self,
        meal_repository: MealRepository,
        daily_goal_repository: DailyGoalRepository
    ):
        self.meal_repo = meal_repository
        self.goal_repo = daily_goal_repository
    
    def execute(self, user: User, target_date: date) -> DailyStatsResult:
        """
        Execute the use case.
        
        Args:
            user: Target user
            target_date: Date to get stats for
            
        Returns:
            DailyStatsResult with all nutrition data
        """
        # Get data from repositories
        daily_goal = self.goal_repo.get_active_for_user(user)
        meals = self.meal_repo.get_by_user_and_date(user, target_date)
        
        # Calculate totals
        total_calories = sum(meal.total_calories for meal in meals)
        total_protein = sum(meal.total_protein for meal in meals)
        total_fat = sum(meal.total_fat for meal in meals)
        total_carbs = sum(meal.total_carbohydrates for meal in meals)
        
        total_consumed = {
            'calories': float(total_calories),
            'protein': float(total_protein),
            'fat': float(total_fat),
            'carbohydrates': float(total_carbs),
        }
        
        # Calculate progress
        progress = self._calculate_progress(daily_goal, total_consumed)
        
        return DailyStatsResult(
            date=target_date,
            daily_goal=self._goal_to_dict(daily_goal) if daily_goal else None,
            total_consumed=total_consumed,
            progress=progress,
            meals=meals
        )
    
    def _calculate_progress(self, goal, consumed: Dict) -> Dict[str, float]:
        if not goal:
            return {k: 0.0 for k in consumed.keys()}
        
        return {
            'calories': self._safe_percent(consumed['calories'], goal.calories),
            'protein': self._safe_percent(consumed['protein'], float(goal.protein)),
            'fat': self._safe_percent(consumed['fat'], float(goal.fat)),
            'carbohydrates': self._safe_percent(consumed['carbohydrates'], float(goal.carbohydrates)),
        }
    
    @staticmethod
    def _safe_percent(value: float, total: float) -> float:
        return round((value / total * 100), 1) if total else 0.0
    
    @staticmethod
    def _goal_to_dict(goal) -> Dict:
        return {
            'id': goal.id,
            'calories': goal.calories,
            'protein': float(goal.protein),
            'fat': float(goal.fat),
            'carbohydrates': float(goal.carbohydrates),
        }
```

### 4.3 Dependency Injection

**Создать `core/container.py`:**
```python
"""
Simple Dependency Injection container.
Uses factory functions instead of heavy DI frameworks.
"""
from functools import lru_cache
from typing import Callable, TypeVar, Dict, Any

T = TypeVar('T')

_container: Dict[str, Callable[[], Any]] = {}


def register(name: str, factory: Callable[[], T]) -> None:
    """Register a factory function for a dependency."""
    _container[name] = factory


def resolve(name: str) -> Any:
    """Resolve a dependency by name."""
    if name not in _container:
        raise KeyError(f"Dependency '{name}' not registered")
    return _container[name]()


def inject(name: str):
    """Decorator to inject dependency into function/method."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            kwargs[name] = resolve(name)
            return func(*args, **kwargs)
        return wrapper
    return decorator


# ============================================================
# Repository Factories
# ============================================================

@lru_cache(maxsize=1)
def get_meal_repository():
    from apps.nutrition.infrastructure.repositories import MealRepository
    return MealRepository()


@lru_cache(maxsize=1)
def get_daily_goal_repository():
    from apps.nutrition.infrastructure.repositories import DailyGoalRepository
    return DailyGoalRepository()


@lru_cache(maxsize=1)
def get_subscription_repository():
    from apps.billing.infrastructure.repositories import SubscriptionRepository
    return SubscriptionRepository()


# ============================================================
# Gateway Factories
# ============================================================

@lru_cache(maxsize=1)
def get_yookassa_gateway():
    from apps.billing.infrastructure.yookassa_gateway import YooKassaGateway
    return YooKassaGateway()


@lru_cache(maxsize=1)
def get_ai_proxy_gateway():
    from apps.ai.infrastructure.ai_proxy_gateway import AIProxyGateway
    return AIProxyGateway()


# ============================================================
# Use Case Factories
# ============================================================

def get_daily_stats_use_case():
    from apps.nutrition.application.use_cases import GetDailyStatsUseCase
    return GetDailyStatsUseCase(
        meal_repository=get_meal_repository(),
        daily_goal_repository=get_daily_goal_repository()
    )


def get_create_payment_use_case():
    from apps.billing.application.use_cases import CreatePaymentUseCase
    return CreatePaymentUseCase(
        subscription_repository=get_subscription_repository(),
        yookassa_gateway=get_yookassa_gateway()
    )


# ============================================================
# Register all dependencies
# ============================================================

def setup_container():
    """Setup all dependencies in container."""
    # Repositories
    register('meal_repository', get_meal_repository)
    register('daily_goal_repository', get_daily_goal_repository)
    register('subscription_repository', get_subscription_repository)
    
    # Gateways
    register('yookassa_gateway', get_yookassa_gateway)
    register('ai_proxy_gateway', get_ai_proxy_gateway)
    
    # Use Cases
    register('get_daily_stats', get_daily_stats_use_case)
    register('create_payment', get_create_payment_use_case)
```

### 4.4 Thin Views

**Пример `nutrition/presentation/views.py`:**
```python
from datetime import datetime
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.core.container import get_daily_stats_use_case
from .serializers import DailyStatsResponseSerializer


@extend_schema(tags=['Nutrition'])
class DailyStatsView(APIView):
    """
    GET /api/v1/meals/?date=YYYY-MM-DD
    
    Returns daily nutrition statistics with meals.
    """
    permission_classes = [IsAuthenticated]
    
    @extend_schema(
        summary="Получить дневник питания",
        responses={200: DailyStatsResponseSerializer}
    )
    def get(self, request):
        # Parse date
        date_str = request.query_params.get('date')
        if not date_str:
            target_date = datetime.now().date()
        else:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Execute use case
        use_case = get_daily_stats_use_case()
        result = use_case.execute(request.user, target_date)
        
        # Serialize and return
        serializer = DailyStatsResponseSerializer(result)
        return Response(serializer.data)
```

### 4.5 Global Exception Handler

**Добавить в `core/exception_handler.py`:**
```python
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

from apps.core.exceptions import (
    FoodMindException,
    ValidationError,
    NotFoundError,
    PermissionDeniedError,
    BusinessLogicError,
    ExternalServiceError,
)


def custom_exception_handler(exc, context):
    """
    Custom exception handler for DRF.
    Maps domain exceptions to HTTP responses.
    """
    # Let DRF handle its own exceptions first
    response = exception_handler(exc, context)
    
    if response is not None:
        return response
    
    # Handle our domain exceptions
    if isinstance(exc, FoodMindException):
        status_code = _get_status_code(exc)
        return Response(exc.to_dict(), status=status_code)
    
    # Log unexpected exceptions and return 500
    import logging
    logger = logging.getLogger(__name__)
    logger.exception(f"Unhandled exception: {exc}")
    
    return Response(
        {
            "error": "internal_error",
            "message": "An unexpected error occurred",
            "details": {}
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def _get_status_code(exc: FoodMindException) -> int:
    """Map exception type to HTTP status code."""
    if isinstance(exc, ValidationError):
        return status.HTTP_400_BAD_REQUEST
    if isinstance(exc, NotFoundError):
        return status.HTTP_404_NOT_FOUND
    if isinstance(exc, PermissionDeniedError):
        return status.HTTP_403_FORBIDDEN
    if isinstance(exc, BusinessLogicError):
        return status.HTTP_409_CONFLICT
    if isinstance(exc, ExternalServiceError):
        return status.HTTP_502_BAD_GATEWAY
    return status.HTTP_500_INTERNAL_SERVER_ERROR
```

**Обновить `settings/base.py`:**
```python
REST_FRAMEWORK = {
    ...
    "EXCEPTION_HANDLER": "apps.core.exception_handler.custom_exception_handler",
}
```

---

## 5. План миграции (Пошаговый)

### Phase 1: Инфраструктура (1-2 дня)
1. Создать `core/interfaces/` с базовыми абстракциями
2. Создать `core/container.py` с простым DI
3. Добавить `core/exception_handler.py`
4. Обновить настройки DRF

### Phase 2: Nutrition App (2-3 дня) - Пилот
1. Создать `nutrition/infrastructure/repositories.py`
2. Создать `nutrition/application/use_cases.py`
3. Рефакторить views на thin views
4. Написать тесты для use cases
5. Валидировать работоспособность

### Phase 3: Billing App (2-3 дня)
1. Создать `billing/infrastructure/repositories.py`
2. Вынести YooKassa в `billing/infrastructure/yookassa_gateway.py`
3. Создать use cases для платежей
4. Рефакторить views

### Phase 4: AI App (1-2 дня)
1. Создать `ai/infrastructure/ai_proxy_gateway.py`
2. Создать use cases для распознавания
3. Рефакторить views

### Phase 5: Users & Telegram (2 дня)
1. Рефакторить по аналогии
2. Вынести email service в infrastructure

### Phase 6: Cleanup (1 день)
1. Удалить старый код
2. Обновить документацию
3. Финальное тестирование

---

## 6. Что НЕ менять (Keep as is)

| Компонент | Причина |
|-----------|---------|
| **Django Models** | ORM отлично работает, models = entities |
| **DRF Serializers** | Хороший инструмент для Input/Output validation |
| **Celery Tasks** | Работает, только добавить вызов use cases |
| **URL Routing** | Стандартный Django, без изменений |
| **Authentication** | TelegramAuth работает корректно |
| **`core/exceptions.py`** | Отличная иерархия, только расширить использование |

---

## 7. Риски и митигация

| Риск | Митигация |
|------|-----------|
| Regression bugs | Сначала пилот на nutrition, полное покрытие тестами |
| Увеличение сложности | Документация, код-ревью, консистентные паттерны |
| Время разработки | Инкрементальная миграция, старый код работает параллельно |
| Тестирование | Unit tests для use cases, integration tests для API |

---

## 8. Примерные метрики успеха

- [ ] Все use cases покрыты unit-тестами (>80%)
- [ ] Views содержат только HTTP-логику (< 20 строк)
- [ ] Нет прямых ORM-запросов в views
- [ ] Все domain exceptions используют `core/exceptions.py`
- [ ] DI container используется для всех зависимостей
- [ ] API backward compatible (тесты API не сломаны)

---

## 9. Следующие шаги

Рекомендуемый порядок имплементации:
1. **Phase 1** - Инфраструктура (создание базовых абстракций)
2. **Phase 2** - Пилот на nutrition app (проверка концепции)
3. Итерация по остальным приложениям
