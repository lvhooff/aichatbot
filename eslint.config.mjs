import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'

export default defineConfig(
  // node_modules/dist/out are build artifacts; src/renderer/public holds
  // third-party minified bundles (onnxruntime-web worker glue, the VAD
  // worklet) that ship as-is and must not be linted.
  { ignores: ['**/node_modules', '**/dist', '**/out', 'src/renderer/public/**'] },
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
      ...eslintPluginReactRefresh.configs.vite.rules,
      // TypeScript infers return types reliably here, and annotating every
      // React component / hook / handler is noisy and unidiomatic.
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },
  {
    // Test files mock SDK clients, where `any` is the pragmatic choice.
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off'
    }
  },
  eslintConfigPrettier
)
