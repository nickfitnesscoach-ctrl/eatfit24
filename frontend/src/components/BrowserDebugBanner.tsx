/**
 * Browser Debug Mode Banner
 *
 * Displayed at the top of the app when Browser Debug Mode is active.
 * Shows a prominent warning that the app is running in debug mode.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const BrowserDebugBanner: React.FC = () => {
    const { isBrowserDebug, telegramUser } = useAuth();

    if (!isBrowserDebug) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white px-4 py-2 z-50 shadow-lg">
            <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-sm font-medium">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>
                    BROWSER DEBUG MODE • USER: {telegramUser?.username || 'debug'} • ID: {telegramUser?.id}
                </span>
            </div>
        </div>
    );
};

export default BrowserDebugBanner;
