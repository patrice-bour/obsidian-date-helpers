import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import alias from '@rollup/plugin-alias';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import builtinModulesPackage from 'builtin-modules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const builtinModules = builtinModulesPackage;

export default {
  input: 'src/main.ts',
  output: {
    dir: '.',
    sourcemap: 'inline',
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
    typescript(),
    nodeResolve({ browser: false }),
    commonjs(),
  ],
};
