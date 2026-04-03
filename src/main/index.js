import { app } from 'electron'
import path from 'node:path'
import is from 'electron-is'
import { initialize } from '@electron/remote/main'

import Launcher from './Launcher'

/**
 * initialize the main-process side of the remote module
 */
initialize()

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

if (process.env.NODE_ENV !== 'development') {
  global.__static = path.join(app.getAppPath(), 'dist', 'electron', 'static').replace(/\\/g, '\\\\')
}

function shouldUseCustomWindowsAppId () {
  if (!is.windows()) {
    return false
  }

  const execPath = process.execPath.toLowerCase()
  // 直接运行 win-unpacked / portable 时没有安装后的壳层快捷方式，
  // 自定义 AppUserModelId 可能导致任务栏图标关联不到 exe 资源而退回默认图标。
  return !execPath.includes('\\win-unpacked\\') && !execPath.includes('portable')
}

/**
 * Fix Windows notification func
 * appId defined in .electron-vue/webpack.main.config.js
 */
if (is.windows()) {
  if (shouldUseCustomWindowsAppId()) {
    app.setAppUserModelId(appId)
  }
}

global.launcher = new Launcher()
