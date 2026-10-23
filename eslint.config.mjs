import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  // The skill's scripts ship to users as standalone plain-JS files (ADR 0105),
  // not part of the typed app code; .claude/skills holds a synced copy.
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/out',
      'resources/ai/skills/**',
      'resources/cli/export.mjs',
      'resources/cli/check.mjs',
      '.claude/**'
    ]
  },
  tseslint.configs.recommended,
  eslintPluginReact.configs.flat.recommended,
  eslintPluginReact.configs.flat['jsx-runtime'],
  {
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': eslintPluginReactHooks,
      'react-refresh': eslintPluginReactRefresh
    },
    rules: {
      ...eslintPluginReactHooks.configs.recommended.rules,
      ...eslintPluginReactRefresh.configs.vite.rules
    }
  },
  {
    // Process boundaries (ADR 0125): shared/ is pure and runs in every context (also the CLI and
    // the extension), and the sandboxed renderer never reaches into main/.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/main/**', '**/renderer/**', '@renderer/**', 'electron'],
              message: 'shared/ must not import main, renderer or electron (ADR 0125).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/main/**', 'electron'],
              message:
                'The renderer must not import main or electron; use the preload bridge (ADR 0125).'
            }
          ]
        }
      ]
    }
  },
  {
    // Renderer test code (ADR 0127): stubs are often empty on purpose.
    files: [
      '**/*.test.{ts,tsx}',
      'src/renderer/src/testSetup.ts',
      'src/renderer/src/**/*Harness.tsx'
    ],
    rules: { '@typescript-eslint/no-empty-function': 'off' }
  },
  {
    // Plain-JS node:test files, the standalone `chd` CLI (ADR 0106), the Claude
    // Desktop extension (ADR 0110) and its build script — the return-type rule
    // is for app code.
    files: ['**/*.test.mjs', 'resources/cli/**/*.mjs', 'extension/**/*.mjs', 'scripts/**/*.mjs'],
    rules: { '@typescript-eslint/explicit-function-return-type': 'off' }
  },
  eslintConfigPrettier
)
