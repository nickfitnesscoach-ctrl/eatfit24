import { ProgramHero } from "@/components/program/program-hero"
import { ProgramInfoCards } from "@/components/program/program-info-cards"
import { TrainingDay } from "@/components/program/training-day"
import { ProgressionBlock } from "@/components/program/progression-block"
import { UpsellBlock } from "@/components/program/upsell-block"
import { trainingDays } from "@/lib/mock-data"

export default function ProgramPage() {
  return (
    <main className="min-h-screen bg-background">
      <ProgramHero />
      <ProgramInfoCards />
      {trainingDays.map((day) => (
        <TrainingDay key={day.dayNumber} day={day} />
      ))}
      <ProgressionBlock />
      <UpsellBlock />
    </main>
  )
}
