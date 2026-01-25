import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, ClipboardList, Dumbbell } from "lucide-react"

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            FitProtocol
          </h1>
          <p className="text-muted-foreground text-lg">
            Персональные тренировочные программы
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="rounded-3xl border-0 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <ClipboardList className="size-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-lg font-semibold text-foreground">Пройти анкету</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Ответьте на несколько вопросов и получите персональную программу
                  </p>
                  <Button asChild className="h-11 rounded-xl font-semibold">
                    <Link href="/anketa">
                      Начать
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                  <Dumbbell className="size-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="mb-1 text-lg font-semibold text-foreground">Пример программы</h2>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Посмотрите, как выглядит готовая тренировочная программа
                  </p>
                  <Button asChild variant="outline" className="h-11 rounded-xl font-semibold bg-transparent">
                    <Link href="/p/test">
                      Посмотреть
                      <ArrowRight className="ml-2 size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
