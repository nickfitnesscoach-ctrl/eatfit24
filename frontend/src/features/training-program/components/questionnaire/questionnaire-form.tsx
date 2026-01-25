"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { questionnaireQuestions } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { ArrowRight, ArrowLeft, Check } from "lucide-react"

type QuestionType = "text" | "number" | "choice" | "injuries"

interface Question {
  id: string
  type: QuestionType
  question: string
  placeholder?: string
  options?: string[]
}

export function QuestionnaireForm() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [injuryText, setInjuryText] = useState("")
  const [isComplete, setIsComplete] = useState(false)

  const questions = questionnaireQuestions as Question[]
  const totalSteps = questions.length
  const currentQuestion = questions[currentStep]
  const progress = ((currentStep + 1) / totalSteps) * 100

  const handleAnswer = (value: string) => {
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }))
  }

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1)
    } else {
      setIsComplete(true)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const canProceed = () => {
    const answer = answers[currentQuestion.id]
    if (!answer) return false
    if (currentQuestion.type === "injuries" && answer === "Да" && !injuryText.trim()) {
      return false
    }
    return true
  }

  if (isComplete) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <div className="w-full max-w-md text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-primary">
              <Check className="size-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">Спасибо!</h1>
          <p className="mb-8 text-lg text-muted-foreground leading-relaxed">
            Ваша тренировочная программа будет доступна по персональной ссылке.
          </p>
          <Button
            size="lg"
            className="h-14 w-full rounded-2xl text-base font-semibold"
            onClick={() => router.push("/p/test")}
          >
            Открыть пример программы
            <ArrowRight className="ml-2 size-5" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 bg-background/80 px-6 py-4 backdrop-blur-sm">
        <div className="mx-auto max-w-md">
          <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>Шаг {currentStep + 1} из {totalSteps}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <h1 className="mb-8 text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl text-balance">
            {currentQuestion.question}
          </h1>

          {/* Text Input */}
          {currentQuestion.type === "text" && (
            <Input
              type="text"
              placeholder={currentQuestion.placeholder}
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswer(e.target.value)}
              className="h-14 rounded-2xl border-2 px-5 text-lg transition-colors focus:border-primary"
            />
          )}

          {/* Number Input */}
          {currentQuestion.type === "number" && (
            <Input
              type="number"
              placeholder={currentQuestion.placeholder}
              value={answers[currentQuestion.id] || ""}
              onChange={(e) => handleAnswer(e.target.value)}
              className="h-14 rounded-2xl border-2 px-5 text-lg transition-colors focus:border-primary"
              min={1}
              max={120}
            />
          )}

          {/* Choice Options */}
          {currentQuestion.type === "choice" && (
            <div className="flex flex-col gap-3">
              {currentQuestion.options?.map((option) => (
                <button
                  key={option}
                  onClick={() => handleAnswer(option)}
                  className={cn(
                    "flex h-14 items-center justify-center rounded-2xl border-2 px-5 text-base font-medium transition-all",
                    answers[currentQuestion.id] === option
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  )}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {/* Injuries Question */}
          {currentQuestion.type === "injuries" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                {currentQuestion.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleAnswer(option)}
                    className={cn(
                      "flex h-14 items-center justify-center rounded-2xl border-2 px-5 text-base font-medium transition-all",
                      answers[currentQuestion.id] === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-foreground hover:border-primary/50"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {answers[currentQuestion.id] === "Да" && (
                <Input
                  type="text"
                  placeholder="Опишите ваши травмы или ограничения"
                  value={injuryText}
                  onChange={(e) => setInjuryText(e.target.value)}
                  className="h-14 rounded-2xl border-2 px-5 text-lg transition-colors focus:border-primary"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-background/80 px-6 py-6 backdrop-blur-sm">
        <div className="mx-auto flex max-w-md gap-3">
          {currentStep > 0 && (
            <Button
              variant="outline"
              size="lg"
              onClick={handleBack}
              className="h-14 flex-1 rounded-2xl text-base font-semibold bg-transparent"
            >
              <ArrowLeft className="mr-2 size-5" />
              Назад
            </Button>
          )}
          <Button
            size="lg"
            onClick={handleNext}
            disabled={!canProceed()}
            className={cn(
              "h-14 rounded-2xl text-base font-semibold",
              currentStep === 0 ? "w-full" : "flex-1"
            )}
          >
            {currentStep === totalSteps - 1 ? "Завершить" : "Далее"}
            <ArrowRight className="ml-2 size-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
