import { Card, CardContent } from '@/components/ui/card';
import type { ClientProfile } from '../../../model/types';

interface ConsideredBlockProps {
    client: ClientProfile;
}

function InfoItem({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-foreground">{value}</p>
        </div>
    );
}

export function ConsideredBlock({ client }: ConsideredBlockProps) {
    return (
        <Card className="rounded-2xl border-0 shadow-sm">
            <CardContent className="p-5">
                <h2 className="mb-4 text-base font-bold tracking-tight text-foreground">
                    Учтено при составлении
                </h2>
                <div className="grid grid-cols-2 gap-3">
                    <InfoItem label="Цель" value={client.goal} />
                    <InfoItem label="Формат" value={client.format} />
                    <InfoItem label="Частота" value={client.trainingsPerWeek} />
                    <InfoItem label="Уровень" value={client.level} />
                    <InfoItem label="Ограничения" value={client.limitations} />
                    <InfoItem label="Акцент" value={client.focus} />
                </div>
            </CardContent>
        </Card>
    );
}
