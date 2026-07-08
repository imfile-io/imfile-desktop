/**
 * 必须在任何读取 app.getPath('userData') 的代码之前执行（如 electron-store / conf）。
 *
 * 便携模式触发条件（按优先级）：
 * 1. electron-builder portable 目标设置的 PORTABLE_EXECUTABLE_DIR
 * 2. 环境变量 IMFILE_PORTABLE=1 或命令行 --portable
 * 3. Windows ZIP 解压版：exe 旁有 resources/app.asar 且无 NSIS 卸载程序
 */
import { cpSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'

const PORTABLE_DATA_FILES = new Set([
  'user.json',
  'system.json',
  'download.session',
  'session.json',
  'dht.dat',
  'dht6.dat',
  'engine.pid',
  '.go-aria2-migration.conf'
])

const PORTABLE_DATA_DIRS = new Set([
  '.go-aria2',
  'goed2kd'
])

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

function shouldMigratePortableEntry (name) {
  return PORTABLE_DATA_FILES.has(name) || PORTABLE_DATA_DIRS.has(name)
}

/**
 * ZIP 版旧用户可能已在 %APPDATA%\\imFile 产生配置；首次便携启动时迁入程序目录。
 * 仅迁移配置与引擎数据，不复制 AppData 下的 logs/Cache 等目录。
 */
function migrateLegacyUserDataIfNeeded (legacyDir, portableRoot) {
  if (!legacyDir || legacyDir === portableRoot) {
    return
  }
  if (existsSync(join(portableRoot, 'user.json'))) {
    return
  }
  const hasLegacyData =
    existsSync(join(legacyDir, 'user.json')) ||
    existsSync(join(legacyDir, 'system.json'))
  if (!hasLegacyData) {
    return
  }
  try {
    for (const name of readdirSync(legacyDir)) {
      if (!shouldMigratePortableEntry(name)) {
        continue
      }
      const src = join(legacyDir, name)
      const dest = join(portableRoot, name)
      if (existsSync(dest)) {
        continue
      }
      cpSync(src, dest, { recursive: true })
    }
  } catch (err) {
    console.warn('[imFile] 便携模式：从 AppData 迁移配置失败', err)
  }
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

function getPortableCacheDir (portableRoot) {
  // 与 Electron 默认目录名一致（Windows 下为 userData/Cache）
  return join(portableRoot, 'Cache')
}

const defaultUserData = app.getPath('userData')
const portableRoot = resolvePortableRoot()
if (portableRoot) {
  migrateLegacyUserDataIfNeeded(defaultUserData, portableRoot)
  process.env.PORTABLE_EXECUTABLE_DIR = portableRoot
  app.setPath('userData', portableRoot)
  app.setPath('logs', join(portableRoot, 'logs'))
  app.setPath('cache', getPortableCacheDir(portableRoot))
}
