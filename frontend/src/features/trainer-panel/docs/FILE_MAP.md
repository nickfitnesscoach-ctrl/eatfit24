# FILE_MAP — Структура Trainer Panel

> **Frozen state:** 2025-12-15  
> Отражает текущую структуру файлов.

---

## Структура feature

```
src/features/trainer-panel/
├── components/
│   ├── applications/
│   │   ├── ApplicationCard.tsx
│   │   └── ApplicationDetails.tsx
│   ├── clients/
│   │   ├── ClientCard.tsx
│   │   └── ClientDetails.tsx
│   └── Layout.tsx
├── constants/
│   ├── applications.ts      # ACTIVITY_DESCRIPTIONS, TRAINING_LEVEL_DESCRIPTIONS, etc.
│   └── invite.ts            # TRAINER_INVITE_LINK
├── docs/
│   ├── TRAINER_PANEL.md     # Главный канон
│   ├── TRAINER_API.md       # API эндпоинты
│   ├── FILE_MAP.md          # Этот файл
│   └── AUDIT_REPORT.md      # Отчёт рефакторинга
├── hooks/
│   ├── useApplications.ts   # Загрузка + трансформация заявок
│   └── useClientsList.ts    # Фильтрация клиентов
├── pages/
│   ├── ApplicationsPage.tsx
│   ├── ClientsPage.tsx
│   ├── InviteClientPage.tsx
│   └── TrainerPanelPage.tsx
└── types/
    ├── application.ts       # Все интерфейсы (SSOT)
    └── index.ts             # Re-export
```

---

## Связанные файлы вне feature

```
src/
├── contexts/
│   └── ClientsContext.tsx   # Управление клиентами + трансформация
├── services/api/
│   ├── trainer.ts           # API функции (SSOT)
│   ├── auth.ts              # Аутентификация (deprecated re-exports)
│   └── index.ts             # Объект api
└── App.tsx                  # Роутинг /panel/*
```

---

## Каноны импортов

### Типы

**SSOT:** `features/trainer-panel/types/`

```typescript
// Из внешних файлов (contexts/, services/, pages/)
import type { Application, ClientDetailsUi } from '../features/trainer-panel/types';

// Внутри feature
import type { Application } from '../types';
```

### API

**SSOT:** `services/api/trainer.ts`

```typescript
// ✅ Канон
import { api } from '../services/api';
await api.getApplications();

// ❌ Запрещено
import { getApplications } from '../services/api/auth';
```

### Constants

```typescript
// Внутри feature
import { ACTIVITY_DESCRIPTIONS } from '../constants/applications';

// Из внешних файлов
import { TRAINER_INVITE_LINK } from '../features/trainer-panel/constants/invite';
```

---

## Quick Reference

| Задача | Файл |
|--------|------|
| Добавить страницу | `pages/` + обновить `App.tsx` |
| Добавить API endpoint | `services/api/trainer.ts` |
| Добавить тип | `types/application.ts` + `types/index.ts` |
| Добавить маппинг данных | `constants/applications.ts` |
| Изменить трансформацию заявок | `hooks/useApplications.ts` |
| Изменить трансформацию клиентов | `contexts/ClientsContext.tsx` |
