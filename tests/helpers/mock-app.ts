import { App } from 'obsidian';

/**
 * Standard Obsidian App stub shared by the UI/lifecycle test suites.
 */
export function createMockApp(): App {
  return {
    // `on` records its handlers so a test can fire a workspace event — the
    // plugin listens for `window-open` to reach detached windows.
    //
    // `editorSuggest` is Obsidian's own suggest manager, which the public
    // typings do not declare. The plugin reaches it to open the popup after a
    // write the user did not type; a stub here keeps that path exercised
    // instead of falling into its own no-op fallback.
    workspace: {
      openLinkText: jest.fn(),
      on: jest.fn(() => ({})),
      editorSuggest: { trigger: jest.fn() },
    },
    vault: {
      getAbstractFileByPath: jest.fn(),
      create: jest.fn(),
      createFolder: jest.fn(),
    },
    internalPlugins: { getPluginById: jest.fn(() => null) },
  } as unknown as App;
}
