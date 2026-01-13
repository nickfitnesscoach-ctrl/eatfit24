// frontend/src/features/billing/components/PlanPriceStack.tsx
//
// Компонент для отображения цены в 1–2 строки.
// Row 1: основная цена + единица (/мес)
// Row 2: старая цена (перечёркнутая) + подстрока (например "≈ 208 ₽/мес")
//
// Важно по UX:
// - Если Row2 НЕ нужна (нет oldPrice и нет priceSubtext) — мы её НЕ рендерим.
//   Иначе появляется "пустая строка" и карточка кажется рыхлой.
// - Если Row2 нужна — держим минимальную высоту, чтобы верстка не прыгала.

interface PlanPriceStackProps {
    priceMain: string | number;
    priceUnit?: string;
    oldPrice?: string | number;
    priceSubtext?: string;
    alignRight?: boolean;
    isDark?: boolean;
  }
  
  function formatNumber(v: string | number): string {
    if (typeof v === 'number') return v.toLocaleString('ru-RU');
    return String(v);
  }
  
  export function PlanPriceStack({
    priceMain,
    priceUnit,
    oldPrice,
    priceSubtext,
    alignRight = false,
    isDark = false,
  }: PlanPriceStackProps) {
    const mainTextColor = isDark ? 'text-white' : 'text-slate-900';
    const unitTextColor = isDark ? 'text-slate-300' : 'text-slate-600';
    const secondaryTextColor = isDark ? 'text-slate-400' : 'text-slate-500';
  
    const align = alignRight ? 'items-end text-right' : 'items-start text-left';
  
    // Row2 реально нужна только если есть хотя бы один из элементов
    const hasRow2 = oldPrice != null || Boolean(priceSubtext);
  
    return (
      <div className={`shrink-0 flex flex-col ${align} min-w-[7.5rem]`}>
        {/* Row 1: цена + единица */}
        <div className={`flex items-baseline gap-1 ${alignRight ? 'justify-end' : 'justify-start'}`}>
          <span className={`tabular-nums font-extrabold leading-none ${mainTextColor} text-4xl sm:text-5xl`}>
            {formatNumber(priceMain)}
          </span>
  
          {priceUnit ? (
            <span className={`whitespace-nowrap font-bold leading-none ${unitTextColor} text-base sm:text-xl`}>
              {priceUnit}
            </span>
          ) : null}
        </div>
  
        {/* Row 2: старая цена + подстрока (рендерим только если нужно) */}
        {hasRow2 ? (
          <div
            className={`mt-2 flex items-baseline gap-3 min-h-[1.25rem] ${
              alignRight ? 'justify-end' : 'justify-start'
            }`}
          >
            {oldPrice != null ? (
              <span className={`${secondaryTextColor} text-sm font-semibold line-through tabular-nums whitespace-nowrap`}>
                {formatNumber(oldPrice)} ₽
              </span>
            ) : null}
  
            {/* Подстроку показываем только если она есть.
                Если её нет, НЕ вставляем &nbsp; — иначе появится пустота. */}
            {priceSubtext ? (
              <span className={`${secondaryTextColor} text-sm font-medium whitespace-nowrap`}>
                {priceSubtext}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  