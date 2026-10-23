import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: tsParser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } }, globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', performance: 'readonly', localStorage: 'readonly', URL: 'readonly', TextEncoder: 'readonly', Blob: 'readonly', File: 'readonly', console: 'readonly', confirm: 'readonly' } }, plugins: { '@typescript-eslint': tsPlugin }, rules: { ...tsPlugin.configs.recommended.rules, '@typescript-eslint/no-explicit-any': 'warn' } },
];
