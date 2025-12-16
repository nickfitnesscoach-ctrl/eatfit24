"""
Admin/Trainer panel views for Telegram integration.
"""

import logging

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.telegram.telegram_auth import TelegramAdminPermission
from apps.telegram.models import TelegramUser
from apps.telegram.trainer_panel.billing_adapter import (
    get_subscriptions_for_users,
    get_subscribers_metrics,
    get_revenue_metrics,
)

logger = logging.getLogger(__name__)


@extend_schema(
    tags=['Telegram'],
    summary="Get all clients/applications",
    description="Получить список всех клиентов, прошедших опрос через бота"
)
@api_view(['GET'])
@permission_classes([TelegramAdminPermission])
def get_applications_api(request):
    """
    API endpoint для получения списка клиентов.

    GET /api/v1/telegram/applications/
    """
    clients = TelegramUser.objects.filter(ai_test_completed=True).select_related('user').only(
        'id', 'telegram_id', 'first_name', 'last_name', 'username',
        'ai_test_completed', 'ai_test_answers', 'recommended_calories', 'recommended_protein',
        'recommended_fat', 'recommended_carbs', 'created_at', 'is_client', 'user_id'
    ).order_by('-created_at')

    # Batch fetch subscription data to prevent N+1 queries
    user_ids = [client.user_id for client in clients]
    subscriptions_map = get_subscriptions_for_users(user_ids)

    data = []
    for client in clients:
        subscription_info = subscriptions_map.get(client.user_id, {
            'plan_type': 'free',
            'is_paid': False,
            'status': 'unknown',
            'paid_until': None
        })

        data.append({
            "id": client.id,
            "telegram_id": str(client.telegram_id),
            "first_name": client.first_name or "",
            "last_name": client.last_name or "",
            "username": client.username or "",
            "photo_url": "",  # TODO: Add photo support
            "status": "contacted" if client.is_client else "new",
            "display_name": client.display_name,
            "ai_test_completed": client.ai_test_completed,
            "details": client.ai_test_answers or {},
            "recommended_calories": client.recommended_calories,
            "recommended_protein": client.recommended_protein,
            "recommended_fat": client.recommended_fat,
            "recommended_carbs": client.recommended_carbs,
            "created_at": client.created_at.isoformat(),
            "subscription": subscription_info,
        })

    return Response(data, status=status.HTTP_200_OK)


@extend_schema(
    tags=['Telegram'],
    summary="Get list of clients",
    description="Получить список всех клиентов (applications с флагом is_client=True)"
)
@api_view(['GET', 'POST'])
@permission_classes([TelegramAdminPermission])
def clients_list(request):
    """
    GET: Получить список клиентов
    POST: Добавить заявку в клиенты

    GET /api/v1/telegram/clients/
    POST /api/v1/telegram/clients/
    """
    if request.method == 'GET':
        clients = TelegramUser.objects.filter(
            ai_test_completed=True,
            is_client=True
        ).select_related('user').only(
            'id', 'telegram_id', 'first_name', 'last_name', 'username',
            'ai_test_completed', 'ai_test_answers', 'recommended_calories', 'recommended_protein',
            'recommended_fat', 'recommended_carbs', 'created_at', 'is_client', 'user_id'
        ).order_by('-created_at')

        # Batch fetch subscription data to prevent N+1 queries
        user_ids = [client.user_id for client in clients]
        subscriptions_map = get_subscriptions_for_users(user_ids)

        data = []
        for client in clients:
            subscription_info = subscriptions_map.get(client.user_id, {
                'plan_type': 'free',
                'is_paid': False,
                'status': 'unknown',
                'paid_until': None
            })

            data.append({
                "id": client.id,
                "telegram_id": str(client.telegram_id),
                "first_name": client.first_name or "",
                "last_name": client.last_name or "",
                "username": client.username or "",
                "photo_url": "",  # TODO: Add photo support
                "status": "contacted",
                "display_name": client.display_name,
                "ai_test_completed": client.ai_test_completed,
                "details": client.ai_test_answers or {},
                "recommended_calories": client.recommended_calories,
                "recommended_protein": client.recommended_protein,
                "recommended_fat": client.recommended_fat,
                "recommended_carbs": client.recommended_carbs,
                "created_at": client.created_at.isoformat(),
                "is_paid": subscription_info['is_paid'],
                "subscription": subscription_info,
            })

        return Response(data, status=status.HTTP_200_OK)
    
    elif request.method == 'POST':
        client_id = request.data.get('id')
        
        if not client_id:
            return Response(
                {"error": "ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            telegram_user = TelegramUser.objects.get(id=client_id)
            telegram_user.is_client = True
            telegram_user.save()
            
            return Response({
                "status": "success",
                "message": "Client added successfully",
                "id": telegram_user.id
            }, status=status.HTTP_200_OK)
            
        except TelegramUser.DoesNotExist:
            return Response(
                {"error": "User not found"},
                status=status.HTTP_404_NOT_FOUND
            )


@extend_schema(
    tags=['Telegram'],
    summary="Delete client",
    description="Удалить клиента (убрать флаг is_client)"
)
@api_view(['DELETE'])
@permission_classes([TelegramAdminPermission])
def client_detail(request, client_id):
    """
    DELETE: Удалить клиента

    DELETE /api/v1/telegram/clients/{id}/
    """
    try:
        telegram_user = TelegramUser.objects.get(id=client_id)
        telegram_user.is_client = False
        telegram_user.save()

        return Response({
            "status": "success",
            "message": "Client removed successfully"
        }, status=status.HTTP_200_OK)

    except TelegramUser.DoesNotExist:
        return Response(
            {"error": "Client not found"},
            status=status.HTTP_404_NOT_FOUND
        )


@extend_schema(
    tags=['Telegram'],
    summary="Get subscribers stats and revenue",
    description="Получить статистику подписчиков и выручки"
)
@api_view(['GET'])
@permission_classes([TelegramAdminPermission])
def get_subscribers_api(request):
    """
    API endpoint для получения статистики подписчиков и выручки.

    GET /api/v1/telegram/subscribers/

    Returns:
        {
            "subscribers": [
                {
                    "id": 1,
                    "telegram_id": 123456,
                    "first_name": "John",
                    "last_name": "Doe",
                    "username": "johndoe",
                    "plan_type": "monthly",
                    "subscribed_at": "2025-01-01T00:00:00Z",
                    "expires_at": "2025-02-01T00:00:00Z",
                    "is_active": true
                }
            ],
            "stats": {
                "total": 100,
                "free": 50,
                "monthly": 30,
                "yearly": 20,
                "revenue": 50000
            }
        }
    """
    # Get metrics
    counts = get_subscribers_metrics()
    revenue = get_revenue_metrics()

    # Get all users with subscriptions
    users = TelegramUser.objects.filter(
        ai_test_completed=True
    ).select_related('user').order_by('-created_at')

    # Batch fetch subscription data
    user_ids = [u.user_id for u in users]
    subscriptions_map = get_subscriptions_for_users(user_ids)

    # Build subscribers list
    subscribers = []
    for telegram_user in users:
        subscription_info = subscriptions_map.get(telegram_user.user_id, {
            'plan_type': 'free',
            'is_paid': False,
            'status': 'unknown',
            'paid_until': None
        })

        subscribers.append({
            'id': telegram_user.id,
            'telegram_id': telegram_user.telegram_id,
            'first_name': telegram_user.first_name or '',
            'last_name': telegram_user.last_name or '',
            'username': telegram_user.username or '',
            'plan_type': subscription_info['plan_type'],
            'subscribed_at': telegram_user.created_at.isoformat(),
            'expires_at': subscription_info['paid_until'],
            'is_active': subscription_info['status'] == 'active'
        })

    # Build stats (frontend expects revenue as a single number)
    stats = {
        'total': counts['free'] + counts['monthly'] + counts['yearly'],
        'free': counts['free'],
        'monthly': counts['monthly'],
        'yearly': counts['yearly'],
        'revenue': float(revenue['total'])  # Total revenue as single number
    }

    return Response({
        'subscribers': subscribers,
        'stats': stats
    }, status=status.HTTP_200_OK)
