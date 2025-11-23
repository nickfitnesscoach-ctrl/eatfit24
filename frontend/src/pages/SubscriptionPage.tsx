import React, { useEffect, useState } from 'react';
import { Check, Star } from 'lucide-react';
import { api } from '../services/api';

const SubscriptionPage: React.FC = () => {
    const [currentPlan, setCurrentPlan] = useState<any>(null);

    useEffect(() => {
        const fetchPlan = async () => {
            const plan = await api.getSubscriptionPlan();
            setCurrentPlan(plan);
        };
        fetchPlan();
    }, []);

    const handleSubscribe = () => {
        // Logic to initiate payment (e.g., via Telegram Payments)
        alert('Переход к оплате...');
    };

    return (
        <div className="p-4 pb-24 space-y-6">
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">Премиум доступ</h1>
                <p className="text-gray-500">Получи максимум от FoodMind AI</p>
            </div>

            {/* Current Plan Status */}
            {currentPlan && currentPlan.is_active && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                        <Check size={20} className="text-green-600" />
                    </div>
                    <div>
                        <p className="font-bold text-green-800">Активная подписка</p>
                        <p className="text-sm text-green-600">Истекает: {new Date(currentPlan.expires_at).toLocaleDateString()}</p>
                    </div>
                </div>
            )}

            {/* Pricing Card */}
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-3xl p-8 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl">
                    POPULAR
                </div>

                <div className="flex items-center gap-2 mb-4">
                    <Star className="text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-lg">PRO Plan</span>
                </div>

                <div className="mb-6">
                    <span className="text-4xl font-bold">299₽</span>
                    <span className="text-gray-400">/месяц</span>
                </div>

                <ul className="space-y-4 mb-8">
                    {[
                        'Безлимитный анализ еды',
                        'Персональные рекомендации',
                        'История прогресса',
                        'Приоритетная поддержка'
                    ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-3">
                            <div className="bg-white/10 p-1 rounded-full">
                                <Check size={14} />
                            </div>
                            <span className="text-sm text-gray-200">{feature}</span>
                        </li>
                    ))}
                </ul>

                <button
                    onClick={handleSubscribe}
                    className="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-100 transition-colors active:scale-95"
                >
                    Оформить подписку
                </button>
            </div>

            <p className="text-center text-xs text-gray-400">
                Нажимая кнопку, вы соглашаетесь с условиями использования и политикой конфиденциальности.
            </p>
        </div>
    );
};

export default SubscriptionPage;
