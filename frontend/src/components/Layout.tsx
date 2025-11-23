import { useMemo } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { ClipboardList, Users, LayoutDashboard } from 'lucide-react';
import { isTelegramWebAppAvailable } from '../lib/telegram';

const Layout = () => {
    const isTelegramContext = useMemo(() => isTelegramWebAppAvailable(), []);

    if (!isTelegramContext) {
        return (
            <div className="no-access">
                <h1>Нет доступа</h1>
                <p>Панель тренера доступна только из Telegram-бота.</p>
                <p>Откройте бота и нажмите «📱 Открыть панель тренера».</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-1 p-4 overflow-y-auto">
                <Outlet />
            </main>

            <nav className="bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center shadow-lg z-10">
                <NavLink
                    to="/"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    <LayoutDashboard size={24} />
                    <span>Главная</span>
                </NavLink>

                <NavLink
                    to="/applications"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    <ClipboardList size={24} />
                    <span>Заявки</span>
                </NavLink>

                <NavLink
                    to="/clients"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 text-xs font-medium transition-colors ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
                        }`
                    }
                >
                    <Users size={24} />
                    <span>Клиенты</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default Layout;
