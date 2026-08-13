import { App } from 'obsidian';

/**
 * Standard Obsidian App stub shared by the UI/lifecycle test suites.
 */
export function createMockApp(): App {
  return {
    workspace: { openLinkText: jest.fn() },
    vault: {
      getAbstractFileByPath: jest.fn(),
      create: jest.fn(),
      createFolder: jest.fn(),
    },
    internalPlugins: { getPluginById: jest.fn(() => null) },
  } as unknown as App;
}
