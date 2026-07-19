import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'dist-electron', 'dist-release'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // 렌더러 — 브라우저 전역 + React 훅 규칙.
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },

  // 메인 프로세스 / 빌드 설정 — Node 전역 (postcss.config.js 는 CommonJS).
  {
    files: [
      'electron/**/*.ts',
      'assets/*.mjs',
      '*.config.ts',
      '*.config.js',
      '*.config.mjs',
    ],
    languageOptions: {
      globals: { ...globals.node, ...globals.commonjs },
    },
  },

  // 포맷 관련 규칙은 Prettier 에 맡긴다(항상 마지막).
  prettier,
)
