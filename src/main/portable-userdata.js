/**
 * 必须在任何读取 app.getPath('userData') 的代码之前执行（如 electron-store / conf）。
 * electron-builder Windows 便携版会设置 process.env.PORTABLE_EXECUTABLE_DIR。
 */
import { app } from 'electron'

const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
if (typeof portableDir === 'string' && portableDir.length > 0) {
  app.setPath('userData', portableDir)
}
