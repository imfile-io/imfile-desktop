/**
 * 必须在任何读取 app.getPath('userData') 的代码之前执行（如 electron-store / conf）。
 *
 * 便携模式触发条件（按优先级）：
 * 1. electron-builder portable 目标设置的 PORTABLE_EXECUTABLE_DIR
 * 2. 环境变量 IMFILE_PORTABLE=1 或命令行 --portable
 * 3. Windows ZIP 解压版：exe 旁有 resources/app.asar 且无 NSIS 卸载程序
 */
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

function isTruthyPortableFlag (value) {
  if (value === undefined || value === null || value === '') {
    return false
  }
  const normalized = String(value).toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function hasPortableCliFlag () {
  return process.argv.some((arg) => {
    if (arg === '--portable') {
      return true
    }
    if (arg.startsWith('--portable=')) {
      return isTruthyPortableFlag(arg.slice('--portable='.length))
    }
    return false
  })
}

function hasNsisUninstaller (exeDir) {
  try {
    return readdirSync(exeDir).some((name) => {
      const lower = name.toLowerCase()
      return lower.startsWith('uninstall') && lower.endsWith('.exe')
    })
  } catch {
    return false
  }
}

function isWindowsZipDistribution (exeDir) {
  if (process.platform !== 'win32' || !app.isPackaged) {
    return false
  }
  if (!existsSync(join(exeDir, 'resources', 'app.asar'))) {
    return false
  }
  // NSIS 安装目录会带卸载程序；ZIP 解压目录没有
  return !hasNsisUninstaller(exeDir)
}

function resolvePortableRoot () {
  const envDir = process.env.PORTABLE_EXECUTABLE_DIR
  if (typeof envDir === 'string' && envDir.length > 0) {
    return envDir
  }

  if (isTruthyPortableFlag(process.env.IMFILE_PORTABLE) || hasPortableCliFlag()) {
    return dirname(app.getPath('exe'))
  }

  const exeDir = dirname(app.getPath('exe'))
  if (isWindowsZipDistribution(exeDir)) {
    return exeDir
  }

  return null
}

const portableRoot = resolvePortableRoot()
if (portableRoot) {
  process.env.PORTABLE_EXECUTABLE_DIR = portableRoot
  app.setPath('userData', portableRoot)
  app.setPath('logs', join(portableRoot, 'logs'))
  app.setPath('cache', join(portableRoot, 'cache'))
}
