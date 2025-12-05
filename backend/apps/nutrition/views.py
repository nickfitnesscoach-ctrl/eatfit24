"""
Views for nutrition app - meals, food items, daily goals.

REST API documentation compliant implementation.
"""

import logging

from datetime import date, datetime
from rest_framework import generics, status, views
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiResponse
from drf_spectacular.types import OpenApiTypes
from django.shortcuts import get_object_or_404

from .models import Meal, FoodItem, DailyGoal
from .serializers import (
    MealSerializer,
    MealCreateSerializer,
    FoodItemSerializer,
    DailyGoalSerializer,
    DailyStatsSerializer,
    CalculateGoalsSerializer,
)

logger = logging.getLogger(__name__)


@extend_schema(tags=['Meals'])
class MealListCreateView(generics.ListCreateAPIView):
    """
    GET /api/v1/meals/?date=YYYY-MM-DD - Get daily diary with nutrition stats
    GET /api/v1/meals/ - List all meals (with pagination)
    POST /api/v1/meals/ - Create new meal
    """

    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MealCreateSerializer
        return MealSerializer

    def get_queryset(self):
        """Filter meals by current user and optionally by date."""
        queryset = Meal.objects.filter(user=self.request.user).prefetch_related('items')

        # Filter by date if provided
        date_str = self.request.query_params.get('date')
        if date_str:
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
                queryset = queryset.filter(date=target_date)
            except ValueError:
                pass  # Invalid date format, return all meals

        return queryset

    @extend_schema(
        summary="Получить дневник питания за день",
        description="Возвращает все приёмы пищи за указанную дату с общей статистикой КБЖУ и прогрессом выполнения цели. Если date не указан, возвращает все приёмы пищи.",
        parameters=[
            OpenApiParameter(
                name='date',
                type=OpenApiTypes.DATE,
                location=OpenApiParameter.QUERY,
                description='Дата в формате YYYY-MM-DD (опционально)',
                required=False
            )
        ],
        responses={
            200: OpenApiResponse(
                description="Daily diary with meals and nutrition stats",
                response=DailyStatsSerializer
            ),
        }
    )
    def get(self, request, *args, **kwargs):
        """
        Get daily diary with meals and nutrition stats (if ?date= provided).
        Otherwise returns simple list of all meals.
        """
        date_str = request.query_params.get('date')

        if date_str:
            # Return daily stats (as per REST API docs)
            try:
                target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {"error": "Невалидный формат даты. Используйте YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Get active daily goal (optional)
            try:
                daily_goal = DailyGoal.objects.get(user=request.user, is_active=True)
            except DailyGoal.DoesNotExist:
                daily_goal = None

            # Get all meals for the date
            meals = Meal.objects.filter(user=request.user, date=target_date).prefetch_related('items')

            # Calculate total consumed
            total_calories = sum(meal.total_calories for meal in meals)
            total_protein = sum(meal.total_protein for meal in meals)
            total_fat = sum(meal.total_fat for meal in meals)
            total_carbs = sum(meal.total_carbohydrates for meal in meals)

            # Calculate progress percentage (only if daily goal exists)
            if daily_goal:
                progress = {
                    'calories': round((total_calories / daily_goal.calories * 100), 1) if daily_goal.calories else 0,
                    'protein': round((float(total_protein) / float(daily_goal.protein) * 100), 1) if daily_goal.protein else 0,
                    'fat': round((float(total_fat) / float(daily_goal.fat) * 100), 1) if daily_goal.fat else 0,
                    'carbohydrates': round((float(total_carbs) / float(daily_goal.carbohydrates) * 100), 1) if daily_goal.carbohydrates else 0,
                }
            else:
                # No goal set - progress is null
                progress = {
                    'calories': 0,
                    'protein': 0,
                    'fat': 0,
                    'carbohydrates': 0,
                }

            data = {
                'date': target_date,
                'daily_goal': DailyGoalSerializer(daily_goal).data if daily_goal else None,
                'total_consumed': {
                    'calories': float(total_calories),
                    'protein': float(total_protein),
                    'fat': float(total_fat),
                    'carbohydrates': float(total_carbs),
                },
                'progress': progress,
                'meals': MealSerializer(meals, many=True).data,
            }

            return Response(data)
        else:
            # Return simple list of meals
            return super().list(request, *args, **kwargs)

    @extend_schema(
        summary="Создать новый приём пищи",
        description="Создаёт новый приём пищи (завтрак, обед, ужин или перекус).",
        request=MealCreateSerializer,
        responses={
            201: MealSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
        }
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


@extend_schema(tags=['Meals'])
class MealDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/v1/meals/{id}/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = MealSerializer

    def get_queryset(self):
        return Meal.objects.filter(user=self.request.user).prefetch_related('items')

    @extend_schema(
        summary="Получить детали приёма пищи",
        description="Возвращает детальную информацию о приёме пищи со всеми блюдами.",
        responses={
            200: MealSerializer,
            404: OpenApiResponse(description="Приём пищи не найден"),
        }
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        summary="Обновить приём пищи",
        description="Обновляет информацию о приёме пищи (тип или дату).",
        request=MealCreateSerializer,
        responses={
            200: MealSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            404: OpenApiResponse(description="Приём пищи не найден"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        summary="Частично обновить приём пищи",
        description="Частично обновляет информацию о приёме пищи.",
        request=MealCreateSerializer,
        responses={
            200: MealSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            404: OpenApiResponse(description="Приём пищи не найден"),
        }
    )
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(
        summary="Удалить приём пищи",
        description="Удаляет приём пищи и все связанные блюда.",
        responses={
            204: OpenApiResponse(description="Приём пищи успешно удалён"),
            404: OpenApiResponse(description="Приём пищи не найден"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


@extend_schema(tags=['Food Items'])
class FoodItemCreateView(generics.CreateAPIView):
    """
    POST /api/v1/meals/{meal_id}/items/ - Add food item to meal

    Nested resource: creates food item within specific meal.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = FoodItemSerializer

    @extend_schema(
        summary="Добавить блюдо в приём пищи",
        description="Создаёт новое блюдо и добавляет его в указанный приём пищи.",
        request=FoodItemSerializer,
        responses={
            201: FoodItemSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            404: OpenApiResponse(description="Приём пищи не найден"),
        }
    )
    def post(self, request, meal_id, *args, **kwargs):
        # Verify meal exists and belongs to user
        meal = get_object_or_404(Meal, id=meal_id, user=request.user)

        # Create food item
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(meal=meal)

        return Response(serializer.data, status=status.HTTP_201_CREATED)


@extend_schema(tags=['Food Items'])
class FoodItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET/PUT/PATCH/DELETE /api/v1/meals/{meal_id}/items/{id}/

    Nested resource: manages specific food item within meal.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = FoodItemSerializer

    def get_queryset(self):
        meal_id = self.kwargs.get('meal_id')
        # First verify that meal belongs to current user
        meal = get_object_or_404(Meal, id=meal_id, user=self.request.user)
        # Then return food items only from this verified meal
        return FoodItem.objects.filter(meal=meal)

    @extend_schema(
        summary="Получить детали блюда",
        description="Возвращает детальную информацию о блюде.",
        responses={
            200: FoodItemSerializer,
            404: OpenApiResponse(description="Блюдо не найдено"),
        }
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        summary="Обновить блюдо",
        description="Обновляет информацию о блюде (название, вес, КБЖУ).",
        request=FoodItemSerializer,
        responses={
            200: FoodItemSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            404: OpenApiResponse(description="Блюдо не найдено"),
        }
    )
    def put(self, request, *args, **kwargs):
        return super().put(request, *args, **kwargs)

    @extend_schema(
        summary="Частично обновить блюдо",
        description="Частично обновляет информацию о блюде.",
        request=FoodItemSerializer,
        responses={
            200: FoodItemSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            404: OpenApiResponse(description="Блюдо не найдено"),
        }
    )
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)

    @extend_schema(
        summary="Удалить блюдо",
        description="Удаляет блюдо из приёма пищи.",
        responses={
            204: OpenApiResponse(description="Блюдо успешно удалено"),
            404: OpenApiResponse(description="Блюдо не найдено"),
        }
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)


@extend_schema(tags=['Nutrition - Daily Goals'])
class DailyGoalView(generics.RetrieveUpdateAPIView):
    """
    Get or update current daily goal.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DailyGoalSerializer

    def get_object(self):
        """Get active daily goal for current user."""
        try:
            return DailyGoal.objects.get(user=self.request.user, is_active=True)
        except DailyGoal.DoesNotExist:
            return None

    @extend_schema(
        summary="Получить текущую дневную цель",
        description="Возвращает активную дневную цель КБЖУ для пользователя.",
        responses={
            200: DailyGoalSerializer,
            404: OpenApiResponse(description="Дневная цель не установлена"),
        }
    )
    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj is None:
            return Response(
                {"error": "Дневная цель не установлена"},
                status=status.HTTP_404_NOT_FOUND
            )
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    @extend_schema(
        summary="Обновить дневную цель (полностью)",
        description="Полностью обновляет дневную цель КБЖУ.",
        request=DailyGoalSerializer,
        responses={
            200: DailyGoalSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            401: OpenApiResponse(description="Не авторизован"),
        }
    )
    def put(self, request, *args, **kwargs):
        # Проверяем аутентификацию
        if not request.user or not request.user.is_authenticated:
            logger.warning("[DailyGoal] PUT called with unauthenticated user")
            logger.warning("[DailyGoal] Headers: X-Telegram-ID=%s, X-Telegram-Init-Data=%s",
                         request.META.get('HTTP_X_TELEGRAM_ID', 'NOT SET'),
                         'SET' if request.META.get('HTTP_X_TELEGRAM_INIT_DATA') else 'NOT SET')
            return Response(
                {"detail": "unauthenticated_webapp_user"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        telegram_id = getattr(request.user, 'telegram_profile', None)
        logger.info("[DailyGoal] PUT called by user=%s telegram_id=%s data=%s",
                   request.user.id,
                   telegram_id.telegram_id if telegram_id else 'N/A',
                   request.data)

        obj = self.get_object()
        if obj is None:
            logger.info("[DailyGoal] No existing goal found, creating new one")
            # Create new goal if none exists
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
                logger.info("[DailyGoal] Created new DailyGoal for user=%s", request.user.id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as exc:
                logger.exception("[DailyGoal] Failed to create DailyGoal for user=%s: %s", request.user.id, exc)
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        logger.info("[DailyGoal] Updating existing goal id=%s", obj.id)
        return super().put(request, *args, **kwargs)

    @extend_schema(
        summary="Обновить дневную цель (частично)",
        description="Частично обновляет дневную цель КБЖУ.",
        request=DailyGoalSerializer,
        responses={
            200: DailyGoalSerializer,
            400: OpenApiResponse(description="Невалидные данные"),
            401: OpenApiResponse(description="Не авторизован"),
        }
    )
    def patch(self, request, *args, **kwargs):
        # Проверяем аутентификацию
        if not request.user or not request.user.is_authenticated:
            logger.warning("[DailyGoal] PATCH called with unauthenticated user")
            return Response(
                {"detail": "unauthenticated_webapp_user"},
                status=status.HTTP_401_UNAUTHORIZED
            )

        logger.info("[DailyGoal] PATCH called by user=%s data=%s", request.user.id, request.data)
        obj = self.get_object()
        if obj is None:
            # Create new goal if none exists
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
                logger.info("[DailyGoal] Created new DailyGoal for user=%s", request.user.id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            except Exception as exc:
                logger.exception("[DailyGoal] Failed to create DailyGoal for user=%s: %s", request.user.id, exc)
                return Response(
                    {"detail": str(exc)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        return super().patch(request, *args, **kwargs)


@extend_schema(tags=['Nutrition - Daily Goals'])
class CalculateGoalsView(views.APIView):
    """
    Calculate daily goals using Mifflin-St Jeor formula based on user profile.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = CalculateGoalsSerializer

    @extend_schema(
        summary="Рассчитать дневную цель по профилю",
        description="Автоматически рассчитывает дневную цель КБЖУ на основе данных профиля пользователя (пол, возраст, рост, вес, активность) используя формулу Mifflin-St Jeor.",
        responses={
            200: CalculateGoalsSerializer,
            400: OpenApiResponse(description="Не заполнен профиль или недостаточно данных"),
        }
    )
    def post(self, request):
        try:
            goals = DailyGoal.calculate_goals(request.user)
            return Response(goals)
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@extend_schema(tags=['Nutrition - Daily Goals'])
class SetAutoGoalView(views.APIView):
    """
    Calculate and set daily goal automatically.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DailyGoalSerializer

    @extend_schema(
        summary="Установить автоматическую дневную цель",
        description="Рассчитывает и устанавливает дневную цель КБЖУ на основе профиля пользователя.",
        responses={
            201: DailyGoalSerializer,
            400: OpenApiResponse(description="Не заполнен профиль или недостаточно данных"),
        }
    )
    def post(self, request):
        try:
            goals = DailyGoal.calculate_goals(request.user)

            # Create new daily goal with calculated values
            daily_goal = DailyGoal.objects.create(
                user=request.user,
                calories=goals['calories'],
                protein=goals['protein'],
                fat=goals['fat'],
                carbohydrates=goals['carbohydrates'],
                source='AUTO',
                is_active=True
            )

            serializer = DailyGoalSerializer(daily_goal)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


@extend_schema(tags=['Nutrition - Statistics'])
class WeeklyStatsView(views.APIView):
    """
    GET /api/v1/stats/weekly/?start_date=YYYY-MM-DD

    Returns weekly nutrition statistics with daily averages.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Получить недельную статистику",
        description="Возвращает статистику по КБЖУ за неделю с ежедневными данными и средними значениями.",
        parameters=[
            OpenApiParameter(
                name='start_date',
                type=str,
                location=OpenApiParameter.QUERY,
                description='Дата начала недели (понедельник) в формате YYYY-MM-DD',
                required=True
            )
        ],
        responses={
            200: OpenApiResponse(
                description="Недельная статистика",
                response={
                    'type': 'object',
                    'properties': {
                        'start_date': {'type': 'string'},
                        'end_date': {'type': 'string'},
                        'daily_data': {
                            'type': 'array',
                            'items': {
                                'type': 'object',
                                'properties': {
                                    'date': {'type': 'string'},
                                    'calories': {'type': 'number'},
                                    'protein': {'type': 'number'},
                                    'fat': {'type': 'number'},
                                    'carbs': {'type': 'number'},
                                }
                            }
                        },
                        'averages': {
                            'type': 'object',
                            'properties': {
                                'calories': {'type': 'number'},
                                'protein': {'type': 'number'},
                                'fat': {'type': 'number'},
                                'carbs': {'type': 'number'},
                            }
                        }
                    }
                }
            ),
            400: OpenApiResponse(description="Невалидные параметры"),
        }
    )
    def get(self, request):
        from datetime import datetime, timedelta

        start_date_str = request.query_params.get('start_date')
        if not start_date_str:
            return Response(
                {"error": "start_date parameter is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Calculate end date (start + 6 days = 7 days total)
        end_date = start_date + timedelta(days=6)

        # Get all meals for the week
        meals = Meal.objects.filter(
            user=request.user,
            date__gte=start_date,
            date__lte=end_date
        ).prefetch_related('items')

        # Collect daily data
        daily_data = {}
        for i in range(7):
            current_date = start_date + timedelta(days=i)
            daily_data[current_date.isoformat()] = {
                'date': current_date.isoformat(),
                'calories': 0,
                'protein': 0,
                'fat': 0,
                'carbs': 0,
            }

        # Sum up nutrition for each day
        for meal in meals:
            date_key = meal.date.isoformat()
            if date_key in daily_data:
                for item in meal.items.all():
                    daily_data[date_key]['calories'] += item.calories
                    daily_data[date_key]['protein'] += item.protein
                    daily_data[date_key]['fat'] += item.fat
                    daily_data[date_key]['carbs'] += item.carbohydrates

        # Calculate averages
        total_calories = sum(day['calories'] for day in daily_data.values())
        total_protein = sum(day['protein'] for day in daily_data.values())
        total_fat = sum(day['fat'] for day in daily_data.values())
        total_carbs = sum(day['carbs'] for day in daily_data.values())

        days_count = 7

        result = {
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'daily_data': list(daily_data.values()),
            'averages': {
                'calories': round(total_calories / days_count, 1),
                'protein': round(total_protein / days_count, 1),
                'fat': round(total_fat / days_count, 1),
                'carbs': round(total_carbs / days_count, 1),
            }
        }

        return Response(result)
