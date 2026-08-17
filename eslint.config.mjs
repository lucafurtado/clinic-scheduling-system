// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const nodeGlobals = {
  require: 'readonly',
  module: 'readonly',
  exports: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  console: 'readonly',
};

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...nodeGlobals,
        describe: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        jest: 'readonly',
      },
    },
  },
  eslintConfigPrettier,
);
