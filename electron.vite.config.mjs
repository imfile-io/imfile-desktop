import path from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import electronRenderer from 'vite-plugin-electron-renderer'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const staticDir = path.resolve(rootDir, 'static')
const distElectron = path.resolve(rootDir, 'dist/electron')

const { createRequire } = await import('node:module')
const requireJson = createRequire(import.meta.url)
const { appId } = requireJson('./electron-builder.json')

let punycodeUserland
try {
  const { createRequire } = await import('node:module')
  const require = createRequire(import.meta.url)
  punycodeUserland = require.resolve('punycode/punycode.js')
} catch {
  punycodeUserland = null
}

const ssapiBuildDefault = process.env.SSAPI_BUILD_DEFAULT_BASE_URL || ''

function emitModulePackageJsonPlugin (outDir) {
  return {
    name: 'emit-module-package-json',
    generateBundle () {
      this.emitFile({
        type: 'asset',
        fileName: 'package.json',
        source: JSON.stringify({ type: 'module' }, null, 2) + '\n'
      })
    }
  }
}

/** Webpack 允许省略 .vue/.js 扩展名；Vite 需补全 */
function extensionResolvePlugin (rendererRoot) {
  const suffixes = ['.vue', '.js', '/index.vue', '/index.js']
  return {
    name: 'extension-resolve',
    enforce: 'pre',
    resolveId (source, importer) {
      const base = source.split('?')[0]
      if (/\.[a-zA-Z0-9]+$/.test(base)) {
        return null
      }
      let resolvedBase = null
      if (base.startsWith('@/')) {
        resolvedBase = path.join(rendererRoot, base.slice(2))
      } else if (base.startsWith(rendererRoot)) {
        resolvedBase = base
      } else if (base.startsWith('@shared/')) {
        resolvedBase = path.join(path.dirname(rendererRoot), 'shared', base.slice(8))
      } else if (base.startsWith('.') && importer) {
        resolvedBase = path.resolve(path.dirname(importer), base)
      } else {
        return null
      }
      for (const suffix of suffixes) {
        const candidate = resolvedBase + suffix
        if (existsSync(candidate)) {
          return candidate
        }
      }
      return null
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), emitModulePackageJsonPlugin(distElectron)],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src/main'),
        '@shared': path.resolve(rootDir, 'src/shared'),
        ...(punycodeUserland ? { punycode: punycodeUserland } : {})
      }
    },
    define: {
      appId: JSON.stringify(appId),
      'process.env.SSAPI_BUILD_DEFAULT_BASE_URL': JSON.stringify(ssapiBuildDefault)
    },
    build: {
      outDir: distElectron,
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/main/index.js'),
        output: {
          format: 'es',
          entryFileNames: 'main.js'
        }
      }
    }
  },
  renderer: {
    root: path.resolve(rootDir, 'src/renderer'),
    // file:// 协议必须用相对路径，否则安装包脚本变成 /assets/... 导致只显示骨架
    base: './',
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src/renderer'),
        '@shared': path.resolve(rootDir, 'src/shared'),
        static: staticDir,
        ...(punycodeUserland ? { punycode: punycodeUserland } : {})
      }
    },
    plugins: [
      extensionResolvePlugin(path.resolve(rootDir, 'src/renderer')),
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: false
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: false
      }),
      // 渲染进程开了 nodeIntegration：把 electron / Node 内置模块转成 require 垫片，
      // 避免打包后 <script type="module"> 在 file:// 下无法解析裸 ESM import。
      // 勿把 npm 包标为 type:cjs：asar 不含 node_modules，运行时 require 会失败导致骨架屏。
      electronRenderer(),
      // Windows 下 tinyglobby 会把 `\` 当转义符，需用 `/`。
      // src 指向 static 目录本身、dest 为 '.'，得到 dist/electron/static/（与 window.__static 一致）。
      viteStaticCopy({
        targets: [
          {
            src: staticDir.replace(/\\/g, '/'),
            dest: '.'
          }
        ]
      })
    ],
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@import "@/components/Theme/Variables.scss";',
          quietDeps: true,
          silenceDeprecations: ['import']
        },
        sass: {
          additionalData: '@import "@/components/Theme/Variables.scss";',
          quietDeps: true,
          silenceDeprecations: ['import']
        }
      }
    },
    define: {
      __VUE_OPTIONS_API__: JSON.stringify(true),
      __VUE_PROD_DEVTOOLS__: JSON.stringify(false),
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: JSON.stringify(false)
    },
    build: {
      outDir: distElectron,
      emptyOutDir: false,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/renderer/index.html'),
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name].[ext]'
        }
      }
    }
  }
})
