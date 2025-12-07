/**
 * Tests for F-013: Online status hook
 */

import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
    // Store original navigator.onLine
    const originalOnLine = navigator.onLine;

    beforeEach(() => {
        // Reset to online by default
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true,
        });
    });

    afterEach(() => {
        // Restore original
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: originalOnLine,
        });
    });

    test('should return true when online', () => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: true,
        });

        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(true);
    });

    test('should return false when offline', () => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: false,
        });

        const { result } = renderHook(() => useOnlineStatus());
        expect(result.current).toBe(false);
    });

    test('should update when going offline', () => {
        const { result } = renderHook(() => useOnlineStatus());

        expect(result.current).toBe(true);

        // Simulate going offline
        act(() => {
            Object.defineProperty(navigator, 'onLine', {
                configurable: true,
                value: false,
            });
            window.dispatchEvent(new Event('offline'));
        });

        expect(result.current).toBe(false);
    });

    test('should update when going online', () => {
        Object.defineProperty(navigator, 'onLine', {
            configurable: true,
            value: false,
        });

        const { result } = renderHook(() => useOnlineStatus());

        expect(result.current).toBe(false);

        // Simulate going online
        act(() => {
            Object.defineProperty(navigator, 'onLine', {
                configurable: true,
                value: true,
            });
            window.dispatchEvent(new Event('online'));
        });

        expect(result.current).toBe(true);
    });

    test('should cleanup event listeners on unmount', () => {
        const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount } = renderHook(() => useOnlineStatus());

        expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        unmount();

        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));

        addEventListenerSpy.mockRestore();
        removeEventListenerSpy.mockRestore();
    });
});
