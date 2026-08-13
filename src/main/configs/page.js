import path from 'node:path'

import { app } from 'electron'
import is from 'electron-is'

/**
 * 生产构建中 webpack 会将 process.env.NODE_ENV 内联为 "production"，此处恒为 false，
 * 避免仅依赖 electron-is-dev（ELECTRON_IS_DEV、execPath 等）误判为开发环境而去拉 localhost:9080 导致白屏。
 * 已打包应用一律走本地文件。
 */
function useRendererDevServer () {
  return !app.isPackaged && process.env.NODE_ENV !== 'production' && is.dev()
}

/**
 * electron-vite dev 会注入 ELECTRON_RENDERER_URL（如 http://localhost:5173）；
 * 勿硬编码 webpack dev-server 的 9080，否则默认 pnpm run dev 在 Windows 等环境只显示骨架屏、无界面文字。
 */
export function getRendererDevServerUrl () {
  const fromElectronVite = process.env.ELECTRON_RENDERER_URL
  if (fromElectronVite) {
    const base = fromElectronVite.replace(/\/$/, '')
    return `${base}/`
  }
  return 'http://localhost:9080/index.html'
}

export function resolveIndexLoad () {
  if (useRendererDevServer()) {
    return { url: getRendererDevServerUrl() }
  }
  // 打包后 app.getAppPath() 指向 app.asar 根目录；开发时指向仓库根目录。
  // 渲染产物始终位于 dist/electron/index.html，不能依赖当前源码模块的 __dirname。
  return {
    htmlFile: path.join(app.getAppPath(), 'dist', 'electron', 'index.html')
  }
}

const indexLoad = resolveIndexLoad()

export default {
  index: {
    /** 无保存窗口状态时，用主显示器 workArea 铺满（不占满任务栏区域） */
    defaultFillWorkArea: true,
    attrs: {
      title: 'imFile',
      width: 1024,
      height: 768,
      minWidth: 478,
      minHeight: 420,
      transparent: is.macOS()
    },
    bindCloseToHide: true,
    /** 仅在真实走 webpack-dev-server 时自动打开 DevTools，避免生产构建 + electron . 误开 */
    openDevTools: useRendererDevServer(),
    ...indexLoad
  }
}
