import React from 'react';
import ReactMarkdown from 'react-markdown';

interface AIRecommendationsProps {
    plan: string;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({ plan }) => {
    return (
        <div className="ai-recommendations">
            <h2>План от тренера 👨‍⚕️</h2>
            <div className="plan-content">
                <ReactMarkdown>{plan}</ReactMarkdown>
            </div>
        </div>
    );
};
