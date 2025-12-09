export const getProgress = (consumed: number, goal: number) => {
    if (!goal) return 0;
    return Math.min((consumed / goal) * 100, 100);
};

export const getProgressColor = (progress: number) => {
    if (progress < 50) return 'bg-blue-500';
    if (progress < 80) return 'bg-green-500';
    if (progress < 100) return 'bg-yellow-500';
    return 'bg-red-500';
};
