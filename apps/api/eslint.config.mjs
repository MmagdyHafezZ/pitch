// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pitchPlugin from '../../packages/eslint-plugin-pitch/index.mjs';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      '**/prisma/generated/**',
      '**/prisma/migrations/**',
      '**/*.d.ts',
      '*.tsbuildinfo',
      'test/**',
      'build/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: {
      pitch: pitchPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-call': 'off',
      'pitch/require-tests': [
        'error',
        {
          ignore: [
            'src/main.ts',
            'src/config/**',
            'src/common/**',
            'src/gateway/**/*.ts',
            'src/microservices/**/dto/**',
            'src/microservices/**/decorators/**',
            'src/microservices/**/interceptors/**',
            'src/microservices/**/guards/**',
            'src/microservices/**/filters/**',
            'src/microservices/**/interfaces/**',
            'src/microservices/**/prisma/**',
            'src/microservices/**/strategies/**',
            'src/microservices/**/entities/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
);
