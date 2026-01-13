// frontend/src/features/billing/components/BasicPlanCard.tsx
//
// Карточка базового тарифа (FREE).
// Цель: не менять визуальную идею, но сделать отступы управляемыми.
// Принцип: вертикальные расстояния задаются в одном месте через gap контейнеров (SSOT),
// без mb-6 / space-y-4 / mt-auto как "костылей".

import { Zap, Calculator, Calendar } from 'lucide-react';
import { cleanFeatureText } from '../utils/text';

interface BasicPlanCardProps {
  displayName: string;
  price: number;
  features: string[];
  ctaText: string;
  isCurrent: boolean;
  isLoading: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

type IconType = 'zap' | 'calculator' | 'calendar';

const getIconForFeature = (text: string): IconType => {
  const lower = text.toLowerCase();
  if (lower.includes('ai') || lower.includes('распозн') || lower.includes('фото')) return 'zap';
  if (lower.includes('кбжу') || lower.includes('расчет') || lower.includes('расчёт') || lower.includes('калор'))
    return 'calculator';
  if (lower.includes('истор') || lower.includes('дней') || lower.includes('дня')) return 'calendar';
  return 'zap';
};

// Иконки оставляем такими же по размеру/цвету, чтобы дизайн не "поплыл"
const FeatureIcon = ({ type }: { type: IconType }) => {
  switch (type) {
    case 'zap':
      return <Zap className="w-5 h-5 text-gray-600 flex-shrink-0" />;
    case 'calculator':
      return <Calculator className="w-5 h-5 text-gray-600 flex-shrink-0" />;
    case 'calendar':
      return <Calendar className="w-5 h-5 text-gray-600 flex-shrink-0" />;
    default:
      return <Zap className="w-5 h-5 text-gray-600 flex-shrink-0" />;
  }
};

export function BasicPlanCard({
  displayName,
  price,
  features,
  ctaText,
  isCurrent,
  isLoading,
  disabled,
  onSelect,
}: BasicPlanCardProps) {
  const isButtonDisabled = Boolean(disabled || isCurrent || isLoading);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Общий ритм карточки: всё расстояние между крупными блоками контролируем через gap */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
        {/* Хедер (заголовок + цена) — тоже через gap, без mb */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          <div className="flex flex-col gap-1">
            <p className="text-xs sm:text-sm text-gray-500 uppercase tracking-wide">
              ЛИМИТИРОВАННЫЙ ДОСТУП
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{displayName}</h2>
          </div>

          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-gray-900">
              {Math.round(price)}₽
            </span>
          </div>
        </div>

        {/* Блок фич:
            Раньше было space-y-4 (16px) — карточка "раздувалась".
            Теперь делаем flex-col + gap-3 (12px) — плотнее и аккуратнее. */}
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200/40">
          <div className="flex flex-col gap-3">
            {features.map((feature, index) => {
              const cleanText = cleanFeatureText(feature);
              const iconType = getIconForFeature(cleanText);

              return (
                <div key={index} className="flex items-center gap-3">
                  <FeatureIcon type={iconType} />
                  <span className="text-sm sm:text-base text-gray-700">{cleanText}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Кнопка:
            Убираем mt-auto — он тут не нужен и может давать сюрпризы.
            Отступ сверху задаёт общий gap карточки. */}
        <button
          type="button"
          onClick={onSelect}
          disabled={isButtonDisabled}
          className={[
            'w-full py-3.5 sm:py-4 bg-transparent border-2 border-gray-900 text-gray-900 rounded-2xl font-bold text-sm sm:text-base transition-colors uppercase',
            isButtonDisabled
              ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400'
              : 'hover:bg-gray-900 hover:text-white',
            isLoading ? 'opacity-70 cursor-wait' : '',
          ].join(' ')}
        >
          {isLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span>Ждем...</span>
            </div>
          ) : (
            ctaText
          )}
        </button>
      </div>
    </div>
  );
}
