"""
URL конфигурация для billing app.
"""

from django.urls import path
from . import views, webhooks

app_name = 'billing'

urlpatterns = [
    # Subscription management
    path('plan', views.get_current_plan, name='current-plan'),
    path('me/', views.get_subscription_status, name='subscription-status'),
    path('subscribe', views.subscribe, name='subscribe'),
    path('create-payment/', views.create_payment, name='create-payment'),  # Universal payment creation
    path('create-plus-payment/', views.create_plus_payment, name='create-plus-payment'),  # Deprecated, use create-payment
    path('auto-renew/toggle', views.toggle_auto_renew, name='toggle-auto-renew'),
    path('payments', views.get_payment_history, name='payment-history'),

    # Webhooks
    path('webhooks/yookassa', webhooks.yookassa_webhook, name='yookassa-webhook'),
]
