/**
 * Jest setup file
 * Runs before all tests to set up global mocks and environment
 */

// Install Obsidian DOM prototype helpers (no-op without a DOM)
import { Notice } from './mocks/obsidian';
import './mocks/obsidian-dom';

// Mock window.moment for locale detection.
// Under jsdom, attach to the real window instead of replacing it.
if (typeof window === 'undefined') {
  (global as any).window = {
    moment: {
      locale: () => 'en',
    },
  };
} else {
  (window as any).moment = {
    locale: () => 'en',
  };
}

// Suppress console.warn in tests unless explicitly needed
global.console.warn = jest.fn();

// The Notice mock records every message so a test can read what the user saw.
// Without a reset, the next reader inherits the previous test's notices.
beforeEach(() => {
  Notice.messages = [];
});
