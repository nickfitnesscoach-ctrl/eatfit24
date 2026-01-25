import { mockClient } from "@/lib/mock-data"

export function ProgramHero() {
  return (
    <section className="px-6 py-10 md:py-14">
      <div className="mx-auto max-w-4xl">
        <div className="mb-3">
          <span className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold tracking-wider text-primary">
            ВАША ПРОГРАММА
          </span>
        </div>
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-5xl">
          ТРЕНИРОВОЧНЫЙ ПРОТОКОЛ
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm md:text-base">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Цель</span>
            <span className="font-semibold text-foreground">{mockClient.goal}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Формат</span>
            <span className="font-semibold text-foreground">{mockClient.format}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Частота</span>
            <span className="font-semibold text-foreground">{mockClient.trainingsPerWeek}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Клиент</span>
            <span className="font-bold text-primary">{mockClient.name}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
