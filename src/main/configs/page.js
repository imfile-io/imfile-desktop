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

const indexLoad = useRendererDevServer()
  ? { url: 'http://localhost:9080/index.html' }
  : {
      // 打包后 app.getAppPath() 指向 app.asar 根目录；开发时指向仓库根目录。
      // 渲染产物始终位于 dist/electron/index.html，不能依赖当前源码模块的 __dirname。
      htmlFile: path.join(app.getAppPath(), 'dist', 'electron', 'index.html')
    }

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
