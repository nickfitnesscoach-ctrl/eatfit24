import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Camera, CreditCard, User } from 'lucide-react';

const ClientLayout: React.FC = () => {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <main className="flex-1 pb-20">
                <Outlet />
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-between items-center z-50 safe-area-bottom">
                <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                    }
                >
                    <Home size={24} />
                    <span className="text-xs font-medium">Главная</span>
                </NavLink>

                <NavLink
                    to="/log"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                    }
                >
                    <Camera size={24} />
                    <span className="text-xs font-medium">Дневник</span>
                </NavLink>

                <NavLink
                    to="/subscription"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                    }
                >
                    <CreditCard size={24} />
                    <span className="text-xs font-medium">Подписка</span>
                </NavLink>

                <NavLink
                    to="/profile"
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                    }
                >
                    <User size={24} />
                    <span className="text-xs font-medium">Профиль</span>
                </NavLink>
            </nav>
        </div>
    );
};

export default ClientLayout;
