"""
Trainer Panel API.

Правила безопасности:
- Доступ только Telegram admin (TelegramAdminPermission)
- Не отдаём ai_test_answers в списках (только по запросу/детальной ручке)
- Пагинация возвращает total
- Деньги не float (строка/Decimal)
"""

from __future__ import annotations

from typing import Any, Dict, List

from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.telegram.models import TelegramUser
from apps.telegram.telegram_auth import TelegramAdminPermission
from apps.telegram.trainer_panel.billing_adapter import (
    get_revenue_metrics,
    get_subscribers_metrics,
    get_subscriptions_for_users,
)

DEFAULT_LIMIT = 200
MAX_LIMIT = 1000


def _safe_int(value: Any, field_name: str) -> int:
    try:
        ivalue = int(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be an integer")
    if ivalue <= 0:
        raise ValueError(f"{field_name} must be positive")
    return ivalue


def _get_pagination_params(request) -> tuple[int, int]:
    raw_limit = request.query_params.get("limit", DEFAULT_LIMIT)
    raw_offset = request.query_params.get("offset", 0)

    limit = DEFAULT_LIMIT
    offset = 0

    try:
        limit = _safe_int(raw_limit, "limit")
    except ValueError:
        limit = DEFAULT_LIMIT

    try:
        offset = int(raw_offset)
    except (TypeError, ValueError):
        offset = 0

    limit = min(limit, MAX_LIMIT)
    offset = max(offset, 0)

    return limit, offset


def _default_subscription() -> Dict[str, Any]:
    return {"plan_type": "free", "is_paid": False, "status": "unknown", "paid_until": None}


def _serialize_client_for_panel(
    client: TelegramUser,
    subscription: Dict[str, Any],
    status_value: str,
    *,
    include_details: bool,
) -> Dict[str, Any]:
    payload = {
        "id": client.id,
        "telegram_id": str(client.telegram_id),
        "first_name": client.first_name or "",
        "last_name": client.last_name or "",
        "username": client.username or "",
        "photo_url": "",
        "status": status_value,
        "display_name": client.display_name,
        "ai_test_completed": client.ai_test_completed,
        "recommended_calories": client.recommended_calories,
        "recommended_protein": client.recommended_protein,
        "recommended_fat": client.recommended_fat,
        "recommended_carbs": client.recommended_carbs,
        "created_at": client.created_at.isoformat(),
        "subscription": subscription,
        "is_paid": bool(subscription.get("is_paid", False)),
    }

    # В списках по умолчанию НЕ отдаём details.
    if include_details:
        payload["details"] = client.ai_test_answers or {}

    return payload


def _query_applications_qs():
    return (
        TelegramUser.objects.filter(ai_test_completed=True)
        .select_related("user")
        .only(
            "id",
            "telegram_id",
            "first_name",
            "last_name",
            "username",
            "ai_test_completed",
            "ai_test_answers",
            "recommended_calories",
            "recommended_protein",
            "recommended_fat",
            "recommended_carbs",
            "created_at",
            "is_client",
            "user_id",
        )
        .order_by("-created_at")
    )


@extend_schema(
    tags=["Telegram"],
    summary="Get all applications",
    parameters=[
        OpenApiParameter(name="limit", required=False, type=int),
        OpenApiParameter(name="offset", required=False, type=int),
        OpenApiParameter(
            name="include_details", required=False, type=int, description="1 чтобы вернуть answers"
        ),
    ],
)
@api_view(["GET"])
@permission_classes([TelegramAdminPermission])
def get_applications_api(request):
    limit, offset = _get_pagination_params(request)
    include_details = request.query_params.get("include_details") == "1"

    qs = _query_applications_qs()
    total = qs.count()
    clients = list(qs[offset : offset + limit])

    user_ids = [c.user_id for c in clients if c.user_id]
    subscriptions_map = get_subscriptions_for_users(user_ids)

    items: List[Dict[str, Any]] = []
    for client in clients:
        subscription = subscriptions_map.get(client.user_id, _default_subscription())
        status_value = "contacted" if client.is_client else "new"
        items.append(
            _serialize_client_for_panel(
                client, subscription, status_value, include_details=include_details
            )
        )

    return Response(
        {"items": items, "pagination": {"limit": limit, "offset": offset, "total": total}},
        status=status.HTTP_200_OK,
    )


@extend_schema(
    tags=["Telegram"],
    summary="Get clients / Promote application to client",
    parameters=[
        OpenApiParameter(name="limit", required=False, type=int),
        OpenApiParameter(name="offset", required=False, type=int),
        OpenApiParameter(name="include_details", required=False, type=int),
    ],
)
@api_view(["GET", "POST"])
@permission_classes([TelegramAdminPermission])
def clients_list(request):
    if request.method == "GET":
        limit, offset = _get_pagination_params(request)
        include_details = request.query_params.get("include_details") == "1"

        qs = _query_applications_qs().filter(is_client=True)
        total = qs.count()
        clients = list(qs[offset : offset + limit])

        user_ids = [c.user_id for c in clients if c.user_id]
        subscriptions_map = get_subscriptions_for_users(user_ids)

        items: List[Dict[str, Any]] = []
        for client in clients:
            subscription = subscriptions_map.get(client.user_id, _default_subscription())
            items.append(
                _serialize_client_for_panel(
                    client, subscription, "contacted", include_details=include_details
                )
            )

        return Response(
            {"items": items, "pagination": {"limit": limit, "offset": offset, "total": total}},
            status=status.HTTP_200_OK,
        )

    raw_id = request.data.get("id")
    if raw_id is None:
        return Response({"error": "ID is required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        client_id = _safe_int(raw_id, "id")
    except ValueError:
        return Response(
            {"error": "ID must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST
        )

    telegram_user = get_object_or_404(TelegramUser, id=client_id)

    if not telegram_user.ai_test_completed:
        return Response(
            {"error": "User has not completed AI test"}, status=status.HTTP_400_BAD_REQUEST
        )

    if telegram_user.is_client:
        return Response(
            {"status": "success", "message": "Client already added", "id": telegram_user.id}
        )

    telegram_user.is_client = True
    telegram_user.save(update_fields=["is_client"])

    return Response(
        {"status": "success", "message": "Client added successfully", "id": telegram_user.id}
    )


@extend_schema(tags=["Telegram"], summary="Remove client flag")
@api_view(["DELETE"])
@permission_classes([TelegramAdminPermission])
def client_detail(request, client_id: int):
    telegram_user = get_object_or_404(TelegramUser, id=client_id)

    if not telegram_user.is_client:
        return Response(
            {"status": "success", "message": "Client already removed"}, status=status.HTTP_200_OK
        )

    telegram_user.is_client = False
    telegram_user.save(update_fields=["is_client"])
    return Response(
        {"status": "success", "message": "Client removed successfully"}, status=status.HTTP_200_OK
    )


@extend_schema(tags=["Telegram"], summary="Get subscribers stats and revenue")
@api_view(["GET"])
@permission_classes([TelegramAdminPermission])
def get_subscribers_api(request):
    counts = get_subscribers_metrics()
    revenue = get_revenue_metrics()

    limit, offset = _get_pagination_params(request)

    # Это не “чистые подписчики”, а пользователи воронки ai_test_completed (как было в исходнике).
    # Если хочешь настоящий список подписчиков — фильтровать по paid подписке.
    qs = (
        TelegramUser.objects.filter(ai_test_completed=True)
        .select_related("user")
        .only("id", "telegram_id", "first_name", "last_name", "username", "created_at", "user_id")
        .order_by("-created_at")
    )
    total = qs.count()
    users = list(qs[offset : offset + limit])

    user_ids = [u.user_id for u in users if u.user_id]
    subscriptions_map = get_subscriptions_for_users(user_ids)

    subscribers: List[Dict[str, Any]] = []
    for u in users:
        subscription = subscriptions_map.get(u.user_id, _default_subscription())
        subscribers.append(
            {
                "id": u.id,
                "telegram_id": str(u.telegram_id),
                "first_name": u.first_name or "",
                "last_name": u.last_name or "",
                "username": u.username or "",
                "plan_type": subscription.get("plan_type", "free"),
                "subscribed_at": u.created_at.isoformat(),
                "expires_at": subscription.get("paid_until"),
                "is_active": subscription.get("status") == "active",
            }
        )

    stats = {
        "total": int(counts["free"] + counts["monthly"] + counts["yearly"]),
        "free": int(counts["free"]),
        "monthly": int(counts["monthly"]),
        "yearly": int(counts["yearly"]),
        # деньги строкой, чтобы не терять точность
        "revenue_total": str(revenue["total"]),
        "revenue_mtd": str(revenue["mtd"]),
        "revenue_last_30d": str(revenue["last_30d"]),
        "currency": revenue["currency"],
    }

    return Response(
        {
            "items": subscribers,
            "pagination": {"limit": limit, "offset": offset, "total": total},
            "stats": stats,
        },
        status=status.HTTP_200_OK,
    )
