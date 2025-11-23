// Types
export interface AuthResponse {
    access: string;
    refresh: string;
    user: {
        id: number;
        username: string;
        telegram_id: number;
        first_name: string;
        last_name?: string;
        completed_ai_test: boolean;
    };
}

export interface TelegramProfile {
    telegram_id: number;
    username: string;
    first_name: string;
    last_name?: string;
    language_code: string;
    is_premium: boolean;
    ai_test_completed: boolean;
    assigned_calories: number;
    assigned_protein: number;
    assigned_fat: number;
    assigned_carbs: number;
    trainer_plan: string;
}

export const MOCK_USER: AuthResponse = {
    access: 'mock_access_token',
    refresh: 'mock_refresh_token',
    user: {
        id: 1,
        username: 'demo_user',
        telegram_id: 123456789,
        first_name: 'Николай',
        last_name: 'Demo',
        completed_ai_test: true,
    },
};

export const MOCK_PROFILE: TelegramProfile = {
    telegram_id: 123456789,
    username: 'demo_user',
    first_name: 'Николай',
    last_name: 'Demo',
    language_code: 'ru',
    is_premium: true,
    ai_test_completed: true,
    assigned_calories: 2250,
    assigned_protein: 140,
    assigned_fat: 80,
    assigned_carbs: 250,
    trainer_plan: `
# 🥗 Ваш персональный план питания

## 🎯 Цель: Набор мышечной массы

Основываясь на ваших данных, мы составили сбалансированный рацион.

### Основные принципы:
*   **Белки**: Важны для роста мышц. Источники: курица, рыба, творог.
*   **Жиры**: Необходимы для гормональной системы. Источники: орехи, авокадо, масла.
*   **Углеводы**: Энергия для тренировок. Источники: крупы, макароны, фрукты.

---

### 📅 Пример меню на день:

**Завтрак:**
*   Овсяная каша на молоке с ягодами
*   2 вареных яйца

**Обед:**
*   Гречка с куриной грудкой
*   Салат из свежих овощей

**Ужин:**
*   Творог с медом
*   Яблоко
  `,
};

export interface Application {
    id: number;
    username: string;
    first_name: string;
    date: string;
    status?: 'new' | 'viewed' | 'contacted'; // Status field for applications
    photo_url?: string; // Optional avatar
    details: {
        age: number;
        gender: 'Мужской' | 'Женский';
        height: number;
        weight: number;
        target_weight: number;
        activity_level: string;
        training_level: string;
        goals: string[];
        limitations: string[];
        body_type: {
            id: number;
            description: string;
            image_url: string;
        };
        desired_body_type: {
            id: number;
            description: string;
            image_url: string;
        };
        diet_type: string;
        meals_per_day: number;
        allergies: string;
        disliked_food: string;
        supplements: string;
        timezone: string;
    }
}

export const MOCK_APPLICATIONS: Application[] = [
    {
        id: 1,
        username: 'dmitriykiselw',
        first_name: 'Дмитрий',
        date: '19 нояб.',
        details: {
            age: 34,
            gender: 'Мужской',
            height: 180,
            weight: 75,
            target_weight: 75,
            activity_level: 'Низкая',
            training_level: 'Средний',
            goals: ['Прокачать спину и осанку', 'Сформировать более круглую/подтянутую попу'],
            limitations: ['Проблемы с позвоночником (грыжи, протрузии, боли)', 'Пищевые аллергии / непереносимость продуктов'],
            body_type: {
                id: 1,
                description: 'Вариант 1: Крупный, значительный избыток веса',
                image_url: '/assets/body_types/m_type_1.jpg'
            },
            desired_body_type: {
                id: 1,
                description: 'Вариант 1: Поджарый с видимым прессом',
                image_url: '/assets/body_types/m_type_after_1.jpg'
            },
            diet_type: 'Сбалансированная',
            meals_per_day: 3,
            allergies: 'Нет',
            disliked_food: 'Рыба',
            supplements: 'Omega-3',
            timezone: 'UTC+6 (Asia/Omsk)'
        }
    },
    {
        id: 2,
        username: 'anna_fit',
        first_name: 'Анна',
        date: '20 нояб.',
        details: {
            age: 28,
            gender: 'Женский',
            height: 165,
            weight: 60,
            target_weight: 55,
            activity_level: 'Высокая',
            training_level: 'Продвинутый',
            goals: ['Похудение'],
            limitations: [],
            body_type: {
                id: 2,
                description: 'Вариант 2: Склонность к животу и бедрам',
                image_url: '/assets/body_types/f_type_2.jpg'
            },
            desired_body_type: {
                id: 2,
                description: 'Вариант 2: Подтянутая спортивная фигура',
                image_url: '/assets/body_types/f_type_after_2.jpg'
            },
            diet_type: 'Кето',
            meals_per_day: 4,
            allergies: 'Глютен',
            disliked_food: 'Лук',
            supplements: 'Витамины',
            timezone: 'UTC+3 (Europe/Moscow)'
        }
    }
];
