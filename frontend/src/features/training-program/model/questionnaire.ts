export type QuestionType = 'text' | 'number' | 'choice' | 'injuries';

export interface AnketaStep {
    id: string;
    type: QuestionType;
    question: string;
    placeholder?: string;
    options?: string[];
}

// 8 steps (removed "Что важнее?")
export const anketaSteps: AnketaStep[] = [
    {
        id: 'name',
        type: 'text',
        question: 'Как вас зовут?',
        placeholder: 'Введите ваше имя',
    },
    {
        id: 'age',
        type: 'number',
        question: 'Сколько вам лет?',
        placeholder: 'Введите ваш возраст',
    },
    {
        id: 'gender',
        type: 'choice',
        question: 'Ваш пол?',
        options: ['Мужской', 'Женский'],
    },
    {
        id: 'goal',
        type: 'choice',
        question: 'Какая ваша основная цель?',
        options: ['Набор массы', 'Похудение', 'Поддержание формы'],
    },
    {
        id: 'location',
        type: 'choice',
        question: 'Где вы тренируетесь?',
        options: ['В зале', 'Дома (гантели/резинки)', 'Дома (без оборудования)'],
    },
    {
        id: 'frequency',
        type: 'choice',
        question: 'Сколько раз в неделю можете тренироваться?',
        options: ['2 раза', '3 раза', '4 раза'],
    },
    {
        id: 'duration',
        type: 'choice',
        question: 'Сколько времени на тренировку?',
        options: ['До 45 мин', '~60 мин', '75+ мин'],
    },
    {
        id: 'injuries',
        type: 'injuries',
        question: 'Есть травмы или ограничения?',
        options: ['Нет', 'Да'],
    },
];
