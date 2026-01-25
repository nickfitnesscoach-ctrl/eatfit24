import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Utensils } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function UpsellBlock() {
    const navigate = useNavigate();

    return (
        <section className="px-6 pb-14">
            <div className="mx-auto max-w-4xl">
                <Card className="overflow-hidden rounded-2xl border-0 bg-foreground shadow-lg">
                    <CardContent className="p-6 md:p-8">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-5 flex size-14 items-center justify-center rounded-xl bg-primary">
                                <Utensils className="size-7 text-primary-foreground" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-background md:text-2xl text-balance">
                                Тренировки — это только часть результата
                            </h3>
                            <p className="mb-6 max-w-md text-sm text-muted md:text-base leading-relaxed">
                                Без контроля питания и подсчёта калорий прогресс будет ограничен.
                            </p>
                            <Button
                                size="lg"
                                className="h-12 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 md:h-14 md:px-8 md:text-base"
                                onClick={() => navigate('/')}
                            >
                                Рассчитать КБЖУ бесплатно в EatFit24
                                <ArrowRight className="ml-2 size-5" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    );
}
