import { Card, CardContent } from "@/components/ui/card"
import { mockClient } from "@/lib/mock-data"

export function ProgramInfoCards() {
  return (
    <section className="px-6 pb-10">
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
        {/* Considered when building */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardContent className="p-5">
            <h2 className="mb-4 text-base font-bold tracking-tight text-foreground">
              Учтено при составлении
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="Цель" value={mockClient.goal} />
              <InfoItem label="Формат" value={mockClient.format} />
              <InfoItem label="Частота" value={mockClient.trainingsPerWeek} />
              <InfoItem label="Уровень" value={mockClient.level} />
              <InfoItem label="Ограничения" value={mockClient.limitations} />
              <InfoItem label="Акцент" value={mockClient.focus} />
            </div>
          </CardContent>
        </Card>

        {/* Working weight rule */}
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
      </div>
    </section>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
