import type { Program } from './types';

export const program_test: Program = {
    id: 'test',
    client: {
        name: 'Алексей',
        goal: 'Набор массы',
        format: 'Сплит',
        trainingsPerWeek: '3 раза/нед',
        level: 'Новичок',
        limitations: 'Нет',
        focus: 'Руки и плечи',
    },
    days: [
        {
            dayNumber: 1,
            title: 'ДЕНЬ 01',
            muscleGroups: 'ГРУДЬ + ТРИЦЕПС',
            exercises: [
                {
                    name: 'Жим штанги лёжа',
                    sets: 4,
                    repsMin: 8,
                    repsMax: 10,
                    restSeconds: 120,
                    videoUrl: '#',
                },
                {
                    name: 'Жим гантелей на наклонной',
                    sets: 3,
                    repsMin: 10,
                    repsMax: 12,
                    restSeconds: 90,
                    videoUrl: '#',
                },
                {
                    name: 'Сведения в кроссовере',
                    sets: 3,
                    repsMin: 12,
                    repsMax: 15,
                    restSeconds: 60,
                    videoUrl: '#',
                },
                {
                    name: 'Жим узким хватом',
                    sets: 3,
                    repsMin: 8,
                    repsMax: 10,
                    restSeconds: 90,
                    videoUrl: '#',
                },
                {
                    name: 'Французский жим',
                    sets: 3,
                    repsMin: 10,
                    repsMax: 12,
                    restSeconds: 60,
                    videoUrl: '#',
                },
            ],
        },
    ],
};
