import { Card, CardContent } from '@/components/ui/card';

export function WorkingWeightRule() {
    return (
        <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="flex h-full flex-col justify-center p-5">
                <h2 className="mb-3 text-base font-bold tracking-tight text-foreground">
                    Правило рабочего веса
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    Подбирай вес так, чтобы в конце подхода оставалось 1–2 повтора в запасе.
                </p>
            </CardContent>
        </Card>
    );
}
