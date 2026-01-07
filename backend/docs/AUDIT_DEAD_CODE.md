# 🗑️ EatFit24 Dead Code Candidates

> **Тип:** Приложение к AUDIT.md  
> **Дата:** 2025-12-24  
> **Правило:** Каждый кандидат содержит доказательство "не используется"

---

## Критерии включения

Файл/функция считается "мёртвым кодом" если:
1. Не импортируется ни одним файлом в проекте
2. Не вызывается через reflection/dynamic import
3. Не является точкой входа (URL, management command, Celery task)
4. Не используется тестами (или тесты тоже мёртвые)

---

## Confirmed Dead Code

### 1. services_legacy.py

| Attribute | Value |
|-----------|-------|
| **File** | [backend/apps/ai/services_legacy.py](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/ai/services_legacy.py) |
| **Size** | 3.9 KB (121 lines) |
| **Proof** | `rg "services_legacy" backend/` — 0 matches. Не импортируется. |
| **Additional** | Импортирует несуществующий `AIProxyRecognitionService` — сломан при попытке использования |
| **Recommendation** | ✅ **DELETE** |

**Evidence:**
```bash
$ rg "from apps.ai.services_legacy" backend/
# No results

$ rg "from apps.ai import.*services_legacy" backend/
# No results

$ rg "recognize_and_save_meal" backend/
# Only found in services_legacy.py itself
```

---

### 2. tests_legacy.py

| Attribute | Value |
|-----------|-------|
| **File** | [backend/apps/ai/tests_legacy.py](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/ai/tests_legacy.py) |
| **Size** | 8.6 KB (232 lines) |
| **Proof** | Патчит `apps.ai.services.AIProxyRecognitionService` — путь не существует. Тесты гарантированно не работают. |
| **Additional** | Суффикс `_legacy` явно указывает на устаревший код |
| **Recommendation** | ✅ **DELETE** |

**Evidence:**
```python
# tests_legacy.py:89
with patch("apps.ai.services.AIProxyRecognitionService") as MockService:
    # PROBLEM: apps.ai.services не существует (есть apps.ai_proxy.service)
```

---

### 3. AIProxyRecognitionService (не существует)

| Attribute | Value |
|-----------|-------|
| **File** | N/A — класс не существует |
| **Referenced In** | `services_legacy.py:13`, `tests_legacy.py:89` |
| **Proof** | `rg "class AIProxyRecognitionService" backend/` — 0 matches |
| **Reality** | Существует `AIProxyService` в `apps/ai_proxy/service.py` |
| **Recommendation** | Ссылки на класс будут удалены вместе с legacy файлами |

---

## Potentially Dead Code (Requires Verification)

### 4. create_monthly_subscription_payment

| Attribute | Value |
|-----------|-------|
| **File** | [backend/apps/billing/services.py:398-404](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/billing/services.py#L398-L404) |
| **Proof** | `rg "create_monthly_subscription_payment" backend/` — только определение |
| **Note** | Помечено как "Legacy helper" в docstring |
| **Recommendation** | ⚠️ **VERIFY** before removal — может использоваться внешними системами |

---

### 5. Billing report files

| Attribute | Value |
|-----------|-------|
| **Files** | `backend/apps/billing/reports/*.md` |
| **Proof** | Markdown файлы в reports/ — не импортируются кодом |
| **Note** | Могут быть историческими артефактами аудитов |
| **Recommendation** | ⚠️ **VERIFY** — если исторические, можно архивировать |

---

## Runtime Artifacts (Not Dead Code, But Should Not Be in Repo)

### 6. db.sqlite3

| Attribute | Value |
|-----------|-------|
| **File** | [backend/db.sqlite3](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/db.sqlite3) |
| **Size** | 434 KB |
| **Proof** | Production использует PostgreSQL. SQLite — dev only. |
| **Recommendation** | ✅ **REMOVE from git** (git rm --cached) |

---

### 7. celerybeat-schedule

| Attribute | Value |
|-----------|-------|
| **File** | [backend/celerybeat-schedule](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/celerybeat-schedule) |
| **Size** | 16 KB |
| **Proof** | Runtime artifact от Celery Beat. Генерируется при запуске. |
| **Recommendation** | ✅ **REMOVE from git** |

---

### 8. gunicorn.pid

| Attribute | Value |
|-----------|-------|
| **File** | [backend/gunicorn.pid](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/gunicorn.pid) |
| **Size** | 2 bytes |
| **Proof** | PID файл процесса Gunicorn. Создаётся при старте. |
| **Recommendation** | ✅ **REMOVE from git** |

---

## Functions That May Be Unused

### 9. _normalize_uploaded_file (in serializers.py)

| Attribute | Value |
|-----------|-------|
| **Location** | [serializers.py:96-121](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/ai/serializers.py#L96-L121) |
| **Status** | ✅ **USED** — called in validate() method |
| **Note** | False positive — function IS used |

---

### 10. compute_totals_from_items (in adapter.py)

| Attribute | Value |
|-----------|-------|
| **Location** | [adapter.py:147-164](file:///d:/NICOLAS/1_PROJECTS/_IT_Projects/eatfit24/backend/apps/ai_proxy/adapter.py#L147-L164) |
| **Status** | ✅ **USED** — called in normalize_proxy_response() as fallback |
| **Note** | False positive — function IS used |

---

## Cleanup Commands

```bash
# Step 1: Delete confirmed dead code
rm backend/apps/ai/services_legacy.py
rm backend/apps/ai/tests_legacy.py

# Step 2: Remove runtime artifacts from git (keep files locally)
git rm --cached backend/db.sqlite3
git rm --cached backend/celerybeat-schedule
git rm --cached backend/gunicorn.pid

# Step 3: Add to .gitignore
cat >> backend/.gitignore << 'EOF'
# Runtime artifacts
db.sqlite3
celerybeat-schedule
gunicorn.pid
*.pyc
__pycache__/
EOF

# Step 4: Verify
python -c "from apps.ai import *; print('OK')"
pytest backend/apps/ai/tests/ -v
```

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Confirmed Dead Code | 2 files | DELETE |
| Potentially Dead | 2 items | VERIFY |
| Runtime Artifacts | 3 files | git rm --cached |
| False Positives | 2 functions | KEEP |
