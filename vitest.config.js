import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src/renderer'),
      '@shared': path.resolve(rootDir, 'src/shared')
    },
    extensions: ['.mjs', '.js', '.json', '.vue']
  },
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/shared/utils/**/*.js',
        'src/shared/aria2/lib/**/*.js',
        'src/shared/locales/**/*.js',
        'src/main/utils/**/*.js',
        'src/main/configs/**/*.js',
        'src/main/core/**/*.js',
        'src/renderer/store/**/*.js',
        'src/renderer/api/**/*.js',
        'src/renderer/components/**/*.vue',
        'src/renderer/components/CommandManager/**/*.js'
      ],
      reporter: ['text', 'lcov']
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/{main,shared,build}/**/*.test.js']
        }
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'happy-dom',
          include: ['tests/renderer/**/*.test.js']
        }
      }
    ]
  }
})
