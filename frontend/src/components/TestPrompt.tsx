import React from 'react';

export const TestPrompt: React.FC = () => {
    return (
        <div className="test-prompt">
            <h2>Добро пожаловать в FoodMind AI! 👋</h2>
            <p>Для начала работы пройдите AI тест в нашем боте.</p>
            <button
                onClick={() => window.Telegram?.WebApp?.openTelegramLink('https://t.me/AI_test_bot')}
            >
                Пройти AI тест
            </button>
        </div>
    );
};
