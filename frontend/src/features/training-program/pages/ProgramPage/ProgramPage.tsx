import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { program_test } from '../../model/fixtures';
import {
    ProgramHero,
    ConsideredBlock,
    WorkingWeightRule,
    DaySection,
    ProgressionBlock,
    UpsellBlock,
} from './ui';

export function ProgramPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // For MVP: only "test" id works
    if (id !== 'test') {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
                <div className="w-full max-w-md text-center">
                    <h1 className="mb-4 text-2xl font-bold text-foreground">Программа не найдена</h1>
                    <p className="mb-8 text-muted-foreground">
                        Проверьте ссылку или откройте пример программы.
                    </p>
                    <Button
                        size="lg"
                        className="h-14 w-full rounded-2xl text-base font-semibold"
                        onClick={() => navigate('/p/test')}
                    >
                        Открыть пример программы
                    </Button>
                </div>
            </div>
        );
    }

    const program = program_test;

    return (
        <div className="min-h-screen bg-background">
            <ProgramHero client={program.client} />

            <section className="px-6 pb-10">
                <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
                    <ConsideredBlock client={program.client} />
                    <WorkingWeightRule />
                </div>
            </section>

            {program.days.map((day) => (
                <DaySection key={day.dayNumber} day={day} />
            ))}

            <ProgressionBlock />
            <UpsellBlock />
        </div>
    );
}
