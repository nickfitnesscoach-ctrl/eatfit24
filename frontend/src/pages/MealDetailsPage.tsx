import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, MealAnalysis } from '../services/api';
import PageHeader from '../components/PageHeader';
import { Flame, Drumstick, Droplets, Wheat } from 'lucide-react';

const MealDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MealAnalysis | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const result = await api.getMealAnalysis(parseInt(id));
                setData(result);
            } catch (err) {
                console.error('Failed to load meal details:', err);
                setError('Не удалось загрузить данные блюда');
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-white p-4">
                <PageHeader title="Детали блюда" />
                <div className="flex flex-col items-center justify-center h-[80vh] text-center">
                    <p className="text-red-500 font-medium mb-4">{error || 'Блюдо не найдено'}</p>
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 font-medium"
                    >
                        Вернуться назад
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-8">
            <PageHeader title="Детали блюда" />

            {/* Large Photo */}
            <div className="w-full aspect-[4/3] bg-gray-200 relative">
                {data.photo_url ? (
                    <img
                        src={data.photo_url}
                        alt={data.label}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        Нет фото
                    </div>
                )}

                {/* Badge Overlay */}
                <div className="absolute bottom-4 left-4">
                    <span className="bg-white/90 backdrop-blur-sm text-gray-900 px-4 py-2 rounded-full font-bold shadow-lg">
                        {data.label}
                    </span>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Recognized Dishes Block */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4">
                        Распознанные блюда ({data.recognized_items.length})
                    </h2>

                    <div className="space-y-3">
                        {data.recognized_items.map((item) => (
                            <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg leading-tight">
                                            {item.name}
                                        </h3>
                                        <p className="text-gray-500 text-sm mt-1">
                                            {item.amount_grams} г
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-xl">
                                        <Flame size={16} className="text-orange-500" />
                                        <span className="font-bold text-orange-700">
                                            {Math.round(item.calories)}
                                        </span>
                                    </div>
                                </div>

                                {/* Macros */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                                        <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                            <Drumstick size={12} />
                                            <span>Белки</span>
                                        </div>
                                        <span className="font-bold text-gray-900">{item.protein}</span>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                                        <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                            <Droplets size={12} />
                                            <span>Жиры</span>
                                        </div>
                                        <span className="font-bold text-gray-900">{item.fat}</span>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-2 flex flex-col items-center">
                                        <div className="flex items-center gap-1 text-gray-500 text-xs mb-1">
                                            <Wheat size={12} />
                                            <span>Угл.</span>
                                        </div>
                                        <span className="font-bold text-gray-900">{item.carbs}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MealDetailsPage;
