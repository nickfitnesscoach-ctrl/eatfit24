"""
Billing adapter для Trainer Panel.

Цели:
- без N+1
- корректный статус подписки
- выручка только по SUCCEEDED
- деньги возвращаем Decimal (в API потом сериализуем строкой)
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from typing import Dict, List, Optional, TypedDict

from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.billing.models import Payment, Subscription


class SubscriptionInfo(TypedDict):
    plan_type: str  # free|monthly|yearly
    is_paid: bool
    status: str  # active|expired|canceled|unknown
    paid_until: Optional[str]


class RevenueMetrics(TypedDict):
    total: Decimal
    mtd: Decimal
    last_30d: Decimal
    currency: str


class SubscribersCounts(TypedDict):
    free: int
    monthly: int
    yearly: int
    paid_total: int


def _normalize_plan_code(code: str) -> str:
    code_upper = (code or "").upper()
    if code_upper == "FREE":
        return "free"
    if code_upper in ("PRO_MONTHLY", "MONTHLY"):
        return "monthly"
    if code_upper in ("PRO_YEARLY", "YEARLY"):
        return "yearly"
    return "free"


def _subscription_status(subscription: Subscription, now=None) -> str:
    if now is None:
        now = timezone.now()

    if not subscription.is_active:
        return "canceled"

    # Если end_date отсутствует — считаем active (например free/lifetime),
    # но paid определим отдельно по plan_type.
    if subscription.end_date and subscription.end_date <= now:
        return "expired"

    return "active"


def _build_subscription_info(subscription: Subscription, now=None) -> SubscriptionInfo:
    if now is None:
        now = timezone.now()

    plan_type = _normalize_plan_code(subscription.plan.code if subscription.plan else "")
    status = _subscription_status(subscription, now=now)
    is_paid = (plan_type != "free") and (status == "active")

    paid_until: Optional[str] = None
    if plan_type != "free" and subscription.end_date:
        paid_until = subscription.end_date.isoformat()

    return SubscriptionInfo(
        plan_type=plan_type,
        is_paid=is_paid,
        status=status,
        paid_until=paid_until,
    )


def _default_free_info(status: str = "active") -> SubscriptionInfo:
    return SubscriptionInfo(plan_type="free", is_paid=False, status=status, paid_until=None)


def get_user_subscription_info(user: User) -> SubscriptionInfo:
    now = timezone.now()
    try:
        subscription = user.subscription
    except Subscription.DoesNotExist:
        return _default_free_info(status="active")

    if not getattr(subscription, "plan", None):
        return _default_free_info(status="unknown")

    return _build_subscription_info(subscription, now=now)


def get_subscriptions_for_users(user_ids: List[int]) -> Dict[int, SubscriptionInfo]:
    now = timezone.now()

    subs = (
        Subscription.objects.filter(user_id__in=user_ids)
        .select_related("plan")
        .only("user_id", "is_active", "end_date", "plan__code")
    )

    result: Dict[int, SubscriptionInfo] = {}
    for sub in subs:
        if sub.plan_id is None:
            result[sub.user_id] = _default_free_info(status="unknown")
        else:
            result[sub.user_id] = _build_subscription_info(sub, now=now)

    for uid in user_ids:
        result.setdefault(uid, _default_free_info(status="active"))

    return result


def get_subscribers_metrics() -> SubscribersCounts:
    """
    Считаем:
    - monthly/yearly: активные платные подписки (is_active=True, end_date is null OR end_date > now)
    - free = total_users - paid_total
    """
    now = timezone.now()

    active_q = Q(is_active=True) & (Q(end_date__isnull=True) | Q(end_date__gt=now))

    qs = (
        Subscription.objects.filter(active_q)
        .select_related("plan")
        .values("plan__code")
        .annotate(c=Count("id"))
    )

    monthly = 0
    yearly = 0
    for row in qs:
        plan_type = _normalize_plan_code(row["plan__code"])
        if plan_type == "monthly":
            monthly += row["c"]
        elif plan_type == "yearly":
            yearly += row["c"]

    paid_total = monthly + yearly
    total_users = User.objects.count()
    free = max(total_users - paid_total, 0)

    return SubscribersCounts(free=free, monthly=monthly, yearly=yearly, paid_total=paid_total)


def get_revenue_metrics() -> RevenueMetrics:
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    thirty_days_ago = now - timedelta(days=30)

    succeeded = Payment.objects.filter(status="SUCCEEDED")

    total = succeeded.aggregate(v=Sum("amount"))["v"] or Decimal("0.00")
    mtd = succeeded.filter(paid_at__gte=month_start).aggregate(v=Sum("amount"))["v"] or Decimal(
        "0.00"
    )
    last_30d = succeeded.filter(paid_at__gte=thirty_days_ago).aggregate(v=Sum("amount"))[
        "v"
    ] or Decimal("0.00")

    return RevenueMetrics(total=total, mtd=mtd, last_30d=last_30d, currency="RUB")
