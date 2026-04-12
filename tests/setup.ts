/**
 * Jest setup file
 * Runs before all tests to set up global mocks and environment
 */

// Mock window.moment for locale detection
(global as any).window = {
  moment: {
    locale: () => 'en',
  },
};

// Suppress console.warn in tests unless explicitly needed
global.console.warn = jest.fn();
