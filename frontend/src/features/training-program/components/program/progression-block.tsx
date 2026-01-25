import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

export function ProgressionBlock() {
  return (
    <section className="px-6 pb-8">
      <div className="mx-auto max-w-4xl">
        <Card className="rounded-2xl border-0 bg-secondary shadow-sm">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="size-5 text-primary" />
            </div>
            <div>
              <h3 className="mb-1.5 text-base font-bold text-foreground">Прогрессия нагрузки</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Если выполнил все подходы в верхней границе повторов — добавь вес на следующей
                тренировке. Если техника ухудшилась — оставь тот же вес.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
