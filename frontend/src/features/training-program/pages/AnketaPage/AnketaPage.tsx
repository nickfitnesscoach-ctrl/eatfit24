import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { anketaSteps } from '../../model/questionnaire';

export function AnketaPage() {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [injuryText, setInjuryText] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    const totalSteps = anketaSteps.length;
    const currentQuestion = anketaSteps[currentStep];
    const progress = ((currentStep + 1) / totalSteps) * 100;

    const handleAnswer = (value: string) => {
        setAnswers((prev) => ({ ...prev, [currentQuestion.id]: value }));
    };

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep((prev) => prev + 1);
        } else {
            setIsComplete(true);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep((prev) => prev - 1);
        }
    };

    const canProceed = () => {
        const answer = answers[currentQuestion.id];
        if (!answer) return false;
        if (currentQuestion.type === 'injuries' && answer === 'Да' && !injuryText.trim()) {
            return false;
        }
        return true;
    };

    if (isComplete) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6">
                <div className="w-full max-w-md text-center">
                    <div className="mb-8 flex justify-center">
                        <div className="flex size-20 items-center justify-center rounded-full bg-primary/10">
                            <Check className="size-10 text-primary" />
                        </div>
                    </div>
                    <h1 className="mb-4 text-3xl font-bold tracking-tight text-foreground">Спасибо!</h1>
                    <p className="mb-8 text-lg text-muted-foreground leading-relaxed">
                        Ваша тренировочная программа будет доступна по персональной ссылке.
                    </p>
                    <Button
                        size="lg"
                        className="h-14 w-full rounded-2xl text-base font-semibold shadow-sm hover:shadow-md transition-all"
                        onClick={() => navigate('/p/test')}
                    >
                        Открыть пример программы
                        <ArrowRight className="ml-2 size-5" />
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-50">
            {/* Progress Bar */}
            <div className="sticky top-0 z-10 bg-gray-50/80 px-6 py-4 backdrop-blur-sm">
                <div className="mx-auto max-w-md">
                    <div className="mb-3 flex items-center justify-between text-sm font-medium text-muted-foreground">
                        <span>Шаг {currentStep + 1} из {totalSteps}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                        <div
                            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Question Content */}
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
                <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="mb-10 text-center text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl text-balance">
                        {currentQuestion.question}
                    </h1>

                    {/* Text Input */}
                    {currentQuestion.type === 'text' && (
                        <Input
                            type="text"
                            placeholder={currentQuestion.placeholder}
                            value={answers[currentQuestion.id] || ''}
                            onChange={(e) => handleAnswer(e.target.value)}
                            className="h-16 rounded-2xl border-0 bg-white px-6 text-xl shadow-sm transition-all focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400"
                        />
                    )}

                    {/* Number Input */}
                    {currentQuestion.type === 'number' && (
                        <Input
                            type="number"
                            placeholder={currentQuestion.placeholder}
                            value={answers[currentQuestion.id] || ''}
                            onChange={(e) => handleAnswer(e.target.value)}
                            className="h-16 rounded-2xl border-0 bg-white px-6 text-xl shadow-sm transition-all focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400"
                            min={1}
                            max={120}
                        />
                    )}

                    {/* Choice Options */}
                    {currentQuestion.type === 'choice' && (
                        <div className="flex flex-col gap-4">
                            {currentQuestion.options?.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => handleAnswer(option)}
                                    className={cn(
                                        'flex h-16 w-full items-center justify-center rounded-2xl border-2 px-6 text-lg font-medium transition-all duration-200',
                                        answers[currentQuestion.id] === option
                                            ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                            : 'border-gray-100 bg-white text-gray-900 shadow-sm hover:border-primary/30 hover:shadow-md hover:scale-[1.01] active:scale-[0.98]'
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Injuries Question */}
                    {currentQuestion.type === 'injuries' && (
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-4">
                                {currentQuestion.options?.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => handleAnswer(option)}
                                        className={cn(
                                            'flex h-16 w-full items-center justify-center rounded-2xl border-2 px-6 text-lg font-medium transition-all duration-200',
                                            answers[currentQuestion.id] === option
                                                ? 'border-primary bg-primary text-primary-foreground shadow-md scale-[1.02]'
                                                : 'border-gray-100 bg-white text-gray-900 shadow-sm hover:border-primary/30 hover:shadow-md hover:scale-[1.01] active:scale-[0.98]'
                                        )}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            {answers[currentQuestion.id] === 'Да' && (
                                <Input
                                    type="text"
                                    placeholder="Опишите ваши травмы или ограничения"
                                    value={injuryText}
                                    onChange={(e) => setInjuryText(e.target.value)}
                                    className="h-16 rounded-2xl border-0 bg-white px-6 text-xl shadow-sm transition-all focus:ring-2 focus:ring-primary/20 placeholder:text-gray-400 animate-in fade-in slide-in-from-top-2"
                                    autoFocus
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <div className="sticky bottom-0 bg-gray-50/80 px-6 py-6 backdrop-blur-md">
                <div className="mx-auto flex max-w-md gap-4">
                    {currentStep > 0 && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={handleBack}
                            className="h-14 flex-1 rounded-2xl border-gray-200 bg-white text-base font-semibold text-gray-900 shadow-sm hover:bg-gray-50 hover:text-gray-900"
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
                            'h-14 rounded-2xl text-base font-semibold shadow-md transition-all hover:shadow-lg hover:translate-y-[-1px] active:translate-y-[0px]',
                            currentStep === 0 ? 'w-full' : 'flex-1'
                        )}
                    >
                        {currentStep === totalSteps - 1 ? 'Завершить' : 'Далее'}
                        <ArrowRight className="ml-2 size-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
