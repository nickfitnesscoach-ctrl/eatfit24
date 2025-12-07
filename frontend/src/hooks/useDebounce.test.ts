/**
 * Tests for F-022: Debounce hooks
 */

import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce, useDebouncedCallback, useButtonGuard } from './useDebounce';

// Mock timers
vi.useFakeTimers();

describe('useDebounce', () => {
    afterEach(() => {
        vi.clearAllTimers();
    });

    test('should return initial value immediately', () => {
        const { result } = renderHook(() => useDebounce('initial', 500));
        expect(result.current).toBe('initial');
    });

    test('should debounce value changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'initial', delay: 500 } }
        );

        expect(result.current).toBe('initial');

        // Change value
        rerender({ value: 'changed', delay: 500 });

        // Value should not change immediately
        expect(result.current).toBe('initial');

        // Fast-forward time
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Now value should be updated
        expect(result.current).toBe('changed');
    });

    test('should cancel previous timer on rapid changes', () => {
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebounce(value, delay),
            { initialProps: { value: 'a', delay: 500 } }
        );

        // Rapid changes
        rerender({ value: 'b', delay: 500 });
        act(() => { vi.advanceTimersByTime(200); });

        rerender({ value: 'c', delay: 500 });
        act(() => { vi.advanceTimersByTime(200); });

        rerender({ value: 'd', delay: 500 });

        // Value should still be initial
        expect(result.current).toBe('a');

        // Wait for full delay
        act(() => { vi.advanceTimersByTime(500); });

        // Should have final value
        expect(result.current).toBe('d');
    });
});

describe('useDebouncedCallback', () => {
    afterEach(() => {
        vi.clearAllTimers();
    });

    test('should debounce callback execution', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        // Call multiple times rapidly
        act(() => {
            result.current();
            result.current();
            result.current();
        });

        // Callback should not be called yet
        expect(callback).not.toHaveBeenCalled();

        // Wait for delay
        act(() => {
            vi.advanceTimersByTime(300);
        });

        // Should be called only once
        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('should pass arguments to callback', () => {
        const callback = vi.fn();
        const { result } = renderHook(() => useDebouncedCallback(callback, 300));

        act(() => {
            result.current('arg1', 'arg2');
        });

        act(() => {
            vi.advanceTimersByTime(300);
        });

        expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
    });
});

describe('useButtonGuard', () => {
    afterEach(() => {
        vi.clearAllTimers();
    });

    test('should prevent rapid clicks', () => {
        const handler = vi.fn();
        const { result } = renderHook(() => useButtonGuard(handler, 500));

        const [isDisabled, guardedHandler] = result.current;

        // Initially not disabled
        expect(isDisabled).toBe(false);

        // First click
        act(() => {
            guardedHandler();
        });

        // Handler should be called
        expect(handler).toHaveBeenCalledTimes(1);

        // Should be disabled now
        expect(result.current[0]).toBe(true);

        // Second click while disabled
        act(() => {
            result.current[1]();
        });

        // Handler should not be called again
        expect(handler).toHaveBeenCalledTimes(1);

        // Wait for cooldown
        act(() => {
            vi.advanceTimersByTime(500);
        });

        // Should be enabled again
        expect(result.current[0]).toBe(false);
    });

    test('should handle async handlers', async () => {
        const handler = vi.fn().mockResolvedValue(undefined);
        const { result } = renderHook(() => useButtonGuard(handler, 500));

        act(() => {
            result.current[1]();
        });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(result.current[0]).toBe(true);

        // Resolve promise
        await act(async () => {
            await Promise.resolve();
        });

        // Wait for cooldown after promise resolves
        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(result.current[0]).toBe(false);
    });
});
