import babelParser from '@babel/eslint-parser'
import standard from '@vue/eslint-config-standard'
import globals from 'globals'
import pluginVue from 'eslint-plugin-vue'

export default [
  {
    ignores: [
      'src/renderer/components/Icons/*.js',
      'src/shared/locales/*/**'
    ]
  },
  ...pluginVue.configs['flat/essential'],
  ...standard,
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          presets: ['@babel/preset-env']
        }
      }
    }
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        appId: 'readonly',
        __static: 'readonly'
      }
    },
    rules: {
      'no-console': 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off'
    }
  }
]
