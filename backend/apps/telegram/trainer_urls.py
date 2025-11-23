"""
URL configuration for Trainer Panel.
"""

from django.urls import path

from . import views

urlpatterns = [
    # Trainer panel authentication
    path('auth/', views.trainer_panel_auth, name='trainer-panel-auth'),
]
