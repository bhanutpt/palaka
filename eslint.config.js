import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Hard rule: the engine is pure. No DOM, and no imports from the UI layers.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/editor', '**/editor/**', '**/chart', '**/chart/**', '**/app', '**/app/**', '**/help', '**/help/**'],
              message: 'src/engine must not import from the editor, chart, app or help layers.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'localStorage', 'indexedDB'],
    },
  },
);
