import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, Camera, CreditCard, User } from 'lucide-react';

/**
 * ClientLayout - Persistent layout wrapper
 *
 * This component:
 * - Mounts ONCE and stays mounted throughout the app session
 * - Contains bottom navigation
 * - Renders page content via <Outlet />
 *
 * NO artificial delays, overlays or transitions that mask loading states.
 */
const ClientLayout: React.FC = () => {
    const navRef = React.useRef<HTMLElement>(null);

    React.useLayoutEffect(() => {
        const updateNavHeight = () => {
            if (navRef.current) {
                const height = navRef.current.offsetHeight;
                document.documentElement.style.setProperty('--nav-h', `${height}px`);
                console.log('[Layout] --nav-h updated (full):', height);
            }
        };

        // Initial measurement
        updateNavHeight();

        // Observe height changes (including padding-bottom growth)
        const observer = new ResizeObserver(updateNavHeight);
        if (navRef.current) {
            observer.observe(navRef.current, { box: 'border-box' });
        }

        return () => {
            observer.disconnect();
            document.documentElement.style.setProperty('--nav-h', '56px');
        };
    }, []);

    return (
        <div className="min-h-dvh bg-gray-50 flex flex-col">
            <main
                className="flex-1 flex flex-col overflow-y-auto"
                style={{ paddingBottom: 'var(--nav-h)' }}
            >
                <Outlet />
            </main>

            {/* Bottom Navigation Bar */}
            <nav
                ref={navRef}
                className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 z-50 px-page"
                style={{
                    paddingBottom: 'var(--safe-bottom)',
                }}
            >
                <div className="flex justify-between items-stretch py-2">
                    <NavLink
                        to="/"
                        end
                        className={({ isActive }) =>
                            `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                        }
                    >
                        <Home size={22} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Дневник</span>
                    </NavLink>

                    <NavLink
                        to="/log"
                        className={({ isActive }) =>
                            `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                        }
                    >
                        <Camera size={22} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Камера</span>
                    </NavLink>

                    <NavLink
                        to="/subscription"
                        className={({ isActive }) =>
                            `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                        }
                    >
                        <CreditCard size={22} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Тариф</span>
                    </NavLink>

                    <NavLink
                        to="/profile"
                        className={({ isActive }) =>
                            `flex-1 flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`
                        }
                    >
                        <User size={22} />
                        <span className="text-[10px] font-semibold uppercase tracking-wider">Профиль</span>
                    </NavLink>
                </div>
            </nav>
        </div>
    );
};

export default ClientLayout;
