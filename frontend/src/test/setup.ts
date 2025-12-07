/**
 * Vitest test setup file
 */

import '@testing-library/jest-dom';

// Mock navigator.onLine for tests
Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value: true,
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});
