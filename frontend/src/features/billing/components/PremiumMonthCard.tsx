// frontend/src/features/billing/components/PremiumMonthCard.tsx
//
// Карточка тарифа "PRO Месяц".
// Цель верстки: ВСЕ вертикальные расстояния контролируются в одном месте (через gap у контейнеров),
// без "лечебных" mt/pt на дочерних элементах.
// Дизайн не ломаем: оставляем тот же градиент, скругления, иконки, кнопку.
//
// Принципы:
// 1) Вся карточка — flex-col + gap-* (SSOT для вертикальных отступов).
// 2) Хедер (заголовок + цена) — один блок со своим gap.
// 3) Список фич — один блок со своим gap (вместо space-y-*).
// 4) Кнопка всегда внизу потока, без mt-auto (меньше сюрпризов при изменениях).

import React from 'react';
import { UtensilsCrossed, Zap, TrendingUp, Target } from 'lucide-react';
import { cleanFeatureText } from '../utils/text';

interface PremiumMonthCardProps {
  displayName: string;
  price: number;
  features: string[];
  ctaText: string;
  isCurrent: boolean;
  isLoading: boolean;
  disabled?: boolean;
  onSelect: () => void;
  bottomContent?: React.ReactNode;
}

type IconType = 'utensils' | 'zap' | 'trending' | 'target';

/**
 * Очень простой маппер: по ключевым словам выбираем иконку.
 * Это НЕ "идеальная" классификация — она нужна только для красивых карточек.
 * Если текст непонятный — по умолчанию используем "zap".
 */
const getIconForFeature = (text: string): IconType => {
  const lower = text.toLowerCase();

  if (lower.includes('свобода') || lower.includes('питани')) return 'utensils';
  if (lower.includes('мгнов') || lower.includes('подсчет') || lower.includes('подсчёт'))
    return 'zap';
  if (lower.includes('анализ') || lower.includes('прогресс') || lower.includes('привыч'))
    return 'trending';
  if (lower.includes('адаптив') || lower.includes('цель')) return 'target';

  return 'zap';
};

/**
 * Рендер иконки по типу. Оставляем одинаковый размер и цвет,
 * чтобы карточка выглядела цельно.
 */
const FeatureIcon = ({ type }: { type: IconType }) => {
  switch (type) {
    case 'utensils':
      return <UtensilsCrossed className="w-4 h-4 text-emerald-400" />;
    case 'zap':
      return <Zap className="w-4 h-4 text-emerald-400" />;
    case 'trending':
      return <TrendingUp className="w-4 h-4 text-emerald-400" />;
    case 'target':
      return <Target className="w-4 h-4 text-emerald-400" />;
    default:
      return <Zap className="w-4 h-4 text-emerald-400" />;
  }
};

export function PremiumMonthCard({
  displayName,
  price,
  features,
  ctaText,
  isCurrent,
  isLoading,
  disabled,
  onSelect,
  bottomContent,
}: PremiumMonthCardProps) {
  // Когда кнопка должна быть заблокирована:
  // - тариф уже текущий
  // - идёт загрузка
  // - внешний флаг disabled
  const isButtonDisabled = Boolean(disabled || isCurrent || isLoading);

  // Цена для отображения — целое число (без .00)
  const displayPrice = Math.round(price);

  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* ВАЖНО: общий вертикальный ритм карточки контролируется тут через gap */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-700/50 flex flex-col gap-4">
        {/* ---------------- ХЕДЕР (название + цена) ---------------- */}
        {/* Здесь тоже SSOT: расстояние между "левым блоком" и ценой задаём через gap */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4">
          {/* Левый блок: подпись + название */}
          <div className="flex flex-col gap-1">
            <p className="text-xs sm:text-sm text-slate-400 uppercase tracking-wide">
              ПРЕМИУМ ФУНКЦИИ
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">{displayName}</h2>
          </div>

          {/* Правый блок: цена */}
          <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
            <span className="text-3xl sm:text-4xl font-bold text-white">{displayPrice}₽</span>
            <span className="text-sm text-slate-400 uppercase">/МЕС</span>
          </div>
        </div>

        {/* ---------------- СПИСОК ФИЧ ---------------- */}
        {/* Раньше тут был space-y-4 (16px между строками) → из-за этого карточка "раздувалась".
            Теперь вместо этого используем flex-col + gap-3 (12px) — выглядит плотнее и "дороже". */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-5 sm:p-5 border border-slate-700/30">
          <div className="flex flex-col gap-3">
            {features.map((feature, index) => {
              const cleanText = cleanFeatureText(feature);
              const iconType = getIconForFeature(cleanText);

              return (
                <div key={index} className="flex items-center gap-3">
                  {/* Иконка в плашке */}
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <FeatureIcon type={iconType} />
                  </div>

                  {/* Текст фичи */}
                  <span className="text-sm sm:text-base text-slate-200">{cleanText}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ---------------- НИЗ (кнопка или кастомный контент) ---------------- */}
        {bottomContent ? (
          // Если передали кастомный нижний блок — показываем его
          bottomContent
        ) : (
          // Иначе показываем стандартную CTA-кнопку
          <button
            type="button"
            onClick={onSelect}
            disabled={isButtonDisabled}
            className={[
              // Базовый вид кнопки
              'w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm sm:text-base transition-colors uppercase',
              // Активное состояние
              !isButtonDisabled ? 'bg-white text-slate-900 hover:bg-slate-100' : '',
              // Disabled состояние
              isButtonDisabled
                ? 'opacity-50 cursor-not-allowed bg-slate-700 text-slate-500 hover:bg-slate-700'
                : '',
              // Loading состояние (доп. подсказка курсором/прозрачностью)
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
        )}
      </div>
    </div>
  );
}
