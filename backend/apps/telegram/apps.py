"""
AppConfig для приложения Telegram.

Зачем нужен этот файл:
- Django использует AppConfig как "паспорт" приложения.
- Здесь задаются базовые настройки приложения:
  • как оно называется
  • как отображается в Django Admin
  • какие настройки применять по умолчанию

Даже если сейчас тут мало кода — файл важен для архитектуры.
В будущем сюда можно добавить инициализацию:
- сигналов (signals)
- startup-логики
- проверок окружения
"""

from django.apps import AppConfig


class TelegramConfig(AppConfig):
    """
    Конфигурация приложения Telegram Integration.

    Этот класс сообщает Django:
    - где находится приложение (name)
    - какое имя показывать в админке (verbose_name)
    - какой тип primary key использовать по умолчанию (default_auto_field)

    Удалять этот файл не нужно — он является частью
    стандартной структуры Django-приложения.
    """

    # Тип primary key по умолчанию для моделей этого приложения
    # BigAutoField безопаснее AutoField для роста проекта
    default_auto_field = "django.db.models.BigAutoField"

    # Python-путь до приложения
    name = "apps.telegram"

    # Человекочитаемое имя приложения (видно в Django Admin)
    verbose_name = "Telegram Integration"
