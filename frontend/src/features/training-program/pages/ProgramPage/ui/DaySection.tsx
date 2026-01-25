import { Card, CardContent } from '@/components/ui/card';
import { Play } from 'lucide-react';
import type { Day, Exercise } from '../../../model/types';

interface DaySectionProps {
    day: Day;
}

function formatReps(exercise: Exercise) {
    return `${exercise.sets}\u00D7${exercise.repsMin}–${exercise.repsMax}`;
}

function formatRest(seconds: number) {
    if (seconds >= 120) {
        return `${seconds / 60} мин`;
    }
    return `${seconds} сек`;
}

export function DaySection({ day }: DaySectionProps) {
    return (
        <section className="px-6 pb-8">
            <div className="mx-auto max-w-4xl">
                <h2 className="mb-5 text-lg font-bold tracking-tight text-foreground md:text-xl">
                    {day.title} <span className="text-muted-foreground">//</span>{' '}
                    <span className="text-primary">{day.muscleGroups}</span>
                </h2>

                {/* Desktop Table - Hidden on mobile */}
                <Card className="hidden rounded-2xl border-0 shadow-sm md:block">
                    <CardContent className="p-0">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Упражнение
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Подходы × Повторы
                                    </th>
                                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Отдых
                                    </th>
                                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        Видео
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {day.exercises.map((exercise, index) => (
                                    <tr
                                        key={exercise.name}
                                        className={index !== day.exercises.length - 1 ? 'border-b border-border/30' : ''}
                                    >
                                        <td className="px-5 py-4 text-sm font-medium text-foreground">
                                            {exercise.name}
                                        </td>
                                        <td className="px-5 py-4 font-mono text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                                            {formatReps(exercise)}
                                        </td>
                                        <td className="px-5 py-4 font-mono text-sm tabular-nums text-muted-foreground">
                                            {formatRest(exercise.restSeconds)}
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <button
                                                className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110"
                                                aria-label={`Смотреть технику: ${exercise.name}`}
                                                title="Смотреть технику"
                                            >
                                                <Play className="ml-0.5 size-3.5" fill="currentColor" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>

                {/* Mobile Cards - Hidden on desktop */}
                <div className="flex flex-col gap-3 md:hidden">
                    {day.exercises.map((exercise) => (
                        <Card key={exercise.name} className="rounded-2xl border-0 shadow-sm">
                            <CardContent className="p-4">
                                <h3 className="mb-3 text-base font-semibold leading-tight text-foreground">
                                    {exercise.name}
                                </h3>
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="font-mono text-xl font-bold tabular-nums text-foreground whitespace-nowrap">
                                        {formatReps(exercise)}
                                    </span>
                                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                                        Отдых {formatRest(exercise.restSeconds)}
                                    </span>
                                </div>
                                <button
                                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                                    aria-label={`Смотреть технику: ${exercise.name}`}
                                >
                                    <Play className="size-4" fill="currentColor" />
                                    Техника
                                </button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </section>
    );
}
