// Mock data for the training program

export const mockClient = {
  name: "Алексей",
  goal: "Набор массы",
  format: "Сплит",
  trainingsPerWeek: "3 раза/нед",
  level: "Новичок",
  limitations: "Нет",
  focus: "Руки и плечи",
}

export interface Exercise {
  name: string
  sets: number
  repsMin: number
  repsMax: number
  restSeconds: number
  videoUrl: string
}

export interface TrainingDay {
  dayNumber: number
  title: string
  muscleGroups: string
  exercises: Exercise[]
}

export const trainingDays: TrainingDay[] = [
  {
    dayNumber: 1,
    title: "ДЕНЬ 01",
    muscleGroups: "ГРУДЬ + ТРИЦЕПС",
    exercises: [
      {
        name: "Жим штанги лёжа",
        sets: 4,
        repsMin: 8,
        repsMax: 10,
        restSeconds: 120,
        videoUrl: "#",
      },
      {
        name: "Жим гантелей на наклонной",
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        restSeconds: 90,
        videoUrl: "#",
      },
      {
        name: "Сведения в кроссовере",
        sets: 3,
        repsMin: 12,
        repsMax: 15,
        restSeconds: 60,
        videoUrl: "#",
      },
      {
        name: "Жим узким хватом",
        sets: 3,
        repsMin: 8,
        repsMax: 10,
        restSeconds: 90,
        videoUrl: "#",
      },
      {
        name: "Французский жим",
        sets: 3,
        repsMin: 10,
        repsMax: 12,
        restSeconds: 60,
        videoUrl: "#",
      },
    ],
  },
]

export const questionnaireQuestions = [
  {
    id: "name",
    type: "text" as const,
    question: "Как вас зовут?",
    placeholder: "Введите ваше имя",
  },
  {
    id: "age",
    type: "number" as const,
    question: "Сколько вам лет?",
    placeholder: "Введите ваш возраст",
  },
  {
    id: "gender",
    type: "choice" as const,
    question: "Ваш пол?",
    options: ["Мужской", "Женский"],
  },
  {
    id: "goal",
    type: "choice" as const,
    question: "Какая ваша основная цель?",
    options: ["Набор массы", "Похудение", "Поддержание формы"],
  },
  {
    id: "location",
    type: "choice" as const,
    question: "Где вы тренируетесь?",
    options: ["В зале", "Дома (гантели/резинки)", "Дома (без оборудования)"],
  },
  {
    id: "frequency",
    type: "choice" as const,
    question: "Сколько раз в неделю можете тренироваться?",
    options: ["2 раза", "3 раза", "4 раза"],
  },
  {
    id: "duration",
    type: "choice" as const,
    question: "Сколько времени на тренировку?",
    options: ["До 45 мин", "~60 мин", "75+ мин"],
  },
  {
    id: "injuries",
    type: "injuries" as const,
    question: "Есть травмы или ограничения?",
    options: ["Нет", "Да"],
  },
  {
    id: "priority",
    type: "choice" as const,
    question: "Что для вас важнее?",
    options: ["Быстрый визуальный прогресс", "Комфорт и устойчивость"],
  },
]
