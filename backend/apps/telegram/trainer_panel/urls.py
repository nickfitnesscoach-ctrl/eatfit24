"""
URL конфигурация для Trainer Panel (панель тренера).

Зачем нужен этот файл:
- Здесь описываются ВСЕ эндпоинты, относящиеся к панели тренера.
- Панель тренера — это административная часть Telegram WebApp,
  поэтому её URL'ы вынесены в отдельный модуль.

Преимущества такого подхода:
- Чёткое разделение ответственности (auth / bot / trainer_panel)
- Проще поддерживать и расширять
- Проще ограничивать доступ и проводить аудит безопасности
"""

from django.urls import path

from apps.telegram.auth.views import trainer_panel_auth

urlpatterns = [
    # Аутентификация панели тренера через Telegram WebApp
    # Используется фронтендом Trainer Panel
    # Итоговый URL: /api/v1/trainer-panel/auth/
    path("auth/", trainer_panel_auth, name="trainer-panel-auth"),
]
