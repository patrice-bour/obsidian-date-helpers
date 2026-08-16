import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { builtinModules } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  input: 'src/main.ts',
  output: {
    dir: '.',
    // No sourcemap in the published bundle: inlining one tripled the download
    // and shipped the full source with it. Sizes live in the CHANGELOG, which is
    // measured per release rather than restated here where it would drift.
    sourcemap: false,
    format: 'cjs',
    exports: 'default',
  },
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...builtinModules,
  ],
  plugins: [
    alias({
      entries: [{ find: '@', replacement: resolve(__dirname, 'src') }],
    }),
    json(),
    // Overrides tsconfig's `sourceMap: true`, which serves the dev build; the
    // plugin warns otherwise that Rollup emits no map for what it produces.
    typescript({ sourceMap: false }),
    nodeResolve({ browser: false }),
    commonjs(),
  ],
};
