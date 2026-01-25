// Training Program Types

export interface Exercise {
    name: string;
    sets: number;
    repsMin: number;
    repsMax: number;
    restSeconds: number;
    videoUrl: string;
}

export interface Day {
    dayNumber: number;
    title: string;
    muscleGroups: string;
    exercises: Exercise[];
}

export interface ClientProfile {
    name: string;
    goal: string;
    format: string;
    trainingsPerWeek: string;
    level: string;
    limitations: string;
    focus: string;
}

export interface Program {
    id: string;
    client: ClientProfile;
    days: Day[];
}
