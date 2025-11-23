import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MacroChartProps {
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
}

export const MacroChart: React.FC<MacroChartProps> = ({
    calories,
    protein,
    fat,
    carbs,
}) => {
    const data = {
        labels: ['Белки', 'Жиры', 'Углеводы'],
        datasets: [
            {
                data: [protein, fat, carbs],
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',  // Синий для белков
                    'rgba(255, 206, 86, 0.8)',  // Желтый для жиров
                    'rgba(75, 192, 192, 0.8)',  // Зеленый для углеводов
                ],
                borderColor: [
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 206, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                ],
                borderWidth: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom' as const,
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const label = context.label || '';
                        const value = context.parsed || 0;
                        return `${label}: ${value}г`;
                    },
                },
            },
        },
    };

    return (
        <div className="macro-chart">
            <div className="calories-display">
                <h3>{calories}</h3>
                <p>ккал/день</p>
            </div>

            <Doughnut data={data} options={options} />

            <div className="macro-details">
                <div className="macro-item">
                    <span className="label">Белки:</span>
                    <span className="value">{protein}г</span>
                </div>
                <div className="macro-item">
                    <span className="label">Жиры:</span>
                    <span className="value">{fat}г</span>
                </div>
                <div className="macro-item">
                    <span className="label">Углеводы:</span>
                    <span className="value">{carbs}г</span>
                </div>
            </div>
        </div>
    );
};
