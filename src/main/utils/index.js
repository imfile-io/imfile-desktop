import { basename, resolve } from 'node:path'
import { access, constants, existsSync, lstatSync } from 'node:fs'
import { app, nativeTheme, shell } from 'electron'
import is from 'electron-is'

import {
  APP_THEME,
  ENGINE_MAX_CONNECTION_PER_SERVER,
  IP_VERSION,
  IS_PORTABLE,
  PORTABLE_EXECUTABLE_DIR
} from '@shared/constants'
import {
  engineGoAria2BinMap,
  engineAria2cBinMap,
  engineArchMap,
  getGoAria2ExecutableNames,
  goed2kdBinMap
} from '../configs/engine'
import logger from '../core/Logger'

export const getUserDataPath = () => {
  return IS_PORTABLE ? PORTABLE_EXECUTABLE_DIR : app.getPath('userData')
}

export const getSystemLogPath = () => {
  return app.getPath('logs')
}

export const getUserDownloadsPath = () => {
  return app.getPath('downloads')
}

export const getConfigBasePath = () => {
  const path = getUserDataPath()
  return path
}

export const getSessionPath = () => {
  return resolve(getUserDataPath(), './download.session')
}

/** go-aria2 运行时状态目录（与 aria2 文本 session 分离） */
export const getGoAria2DataDir = () => {
  return resolve(getUserDataPath(), '.go-aria2')
}

/** go-aria2 内部 session（JSON），由 migrate-from-aria2 或守护进程写入 */
export const getGoAria2SessionJsonPath = () => {
  return resolve(getGoAria2DataDir(), 'session.json')
}

/** 一次性迁移用的合并配置（含 dir / data-dir / save-session） */
export const getGoAria2MigrationConfPath = () => {
  return resolve(getUserDataPath(), '.go-aria2-migration.conf')
}

/** 可执行文件名包含 go-aria2 时走 go-aria2 分支（迁移 + session 路径） */
export const isGoAria2EngineBin = (binPath) => {
  if (!binPath || typeof binPath !== 'string') {
    return false
  }
  return basename(binPath).toLowerCase().includes('go-aria2')
}

export const getEnginePidPath = () => {
  return resolve(getUserDataPath(), './engine.pid')
}

export const getDhtPath = (protocol) => {
  const name = protocol === IP_VERSION.V6 ? 'dht6.dat' : 'dht.dat'
  return resolve(getUserDataPath(), `./${name}`)
}

export const ENGINE_BACKEND = {
  GO_ARIA2: 'go-aria2',
  ARIA2: 'aria2'
}

export const getEngineBin = (platform) => {
  const result = engineGoAria2BinMap[platform] || ''
  return result
}

/**
 * @param {'go-aria2'|'aria2'} backend
 */
export const getEngineBinPathByBackend = (platform, arch, backend) => {
  const base = getEnginePath(platform, arch)
  if (backend === ENGINE_BACKEND.GO_ARIA2) {
    const names = getGoAria2ExecutableNames(platform)
    for (const name of names) {
      const full = resolve(base, name)
      if (existsSync(full)) {
        return full
      }
    }
    return resolve(base, names[0])
  }
  const binName = engineAria2cBinMap[platform]
  return resolve(base, `./${binName || ''}`)
}

/**
 * 根据 user 配置与磁盘上是否存在引擎文件，推断当前应使用的后端（与启动时自动选择逻辑一致，不含弹窗分支）。
 */
export const inferDownloadEngineBackendFromUserStore = (configManager) => {
  const stored = configManager.getUserConfig('download-engine')
  if (
    stored === ENGINE_BACKEND.GO_ARIA2 ||
    stored === ENGINE_BACKEND.ARIA2
  ) {
    return stored
  }
  const { platform, arch } = process
  const hasGo = existsSync(
    getEngineBinPathByBackend(platform, arch, ENGINE_BACKEND.GO_ARIA2)
  )
  const hasAria = existsSync(
    getEngineBinPathByBackend(platform, arch, ENGINE_BACKEND.ARIA2)
  )
  if (hasGo) {
    return ENGINE_BACKEND.GO_ARIA2
  }
  if (hasAria) {
    return ENGINE_BACKEND.ARIA2
  }
  return ENGINE_BACKEND.GO_ARIA2
}

export const getEngineArch = (platform, arch) => {
  if (!['darwin', 'win32', 'linux'].includes(platform)) {
    return ''
  }

  const result = engineArchMap[platform][arch]
  return result
}

/**
 * 开发环境下定位仓库内 extra/<platform>/<arch>/… 目录。
 * 同时尝试 app.getAppPath() 与沿 __dirname 向上查找，避免打包后 __dirname 层级不一致导致启动失败。
 */
const resolveDevExtraSubdir = (platform, arch, ...segments) => {
  const ah = getEngineArch(platform, arch)
  const suffix = [platform, ah, ...segments]
  const tryDirs = []
  try {
    tryDirs.push(resolve(app.getAppPath(), 'extra', ...suffix))
  } catch (_) {
    // app 未就绪时忽略
  }
  let dir = __dirname
  for (let i = 0; i < 8; i++) {
    tryDirs.push(resolve(dir, 'extra', ...suffix))
    dir = resolve(dir, '..')
  }
  const seen = new Set()
  for (const p of tryDirs) {
    if (seen.has(p)) {
      continue
    }
    seen.add(p)
    if (existsSync(p)) {
      return p
    }
  }
  const lastResort = resolve(__dirname, '../../extra', ...suffix)
  return tryDirs[0] || lastResort
}

export const getDevEnginePath = (platform, arch) => {
  return resolveDevExtraSubdir(platform, arch, 'engine')
}

export const getProdEnginePath = () => {
  return resolve(app.getAppPath(), '../engine')
}

export const getEnginePath = (platform, arch) => {
  return is.dev() ? getDevEnginePath(platform, arch) : getProdEnginePath()
}

export const getAria2BinPath = (platform, arch) => {
  return getEngineBinPathByBackend(platform, arch, ENGINE_BACKEND.GO_ARIA2)
}

export const getAria2ConfPath = (platform, arch) => {
  const base = getEnginePath(platform, arch)
  return resolve(base, './aria2.conf')
}

export const getGoed2kdConfigPath = () => {
  return resolve(getUserDataPath(), './goed2kd/config/config.json')
}

export const getGoed2kdBin = (platform) => {
  return goed2kdBinMap[platform] || ''
}

export const getDevGoed2kdPath = (platform, arch) => {
  return resolveDevExtraSubdir(platform, arch, 'goed2kd')
}

export const getProdGoed2kdPath = () => {
  return resolve(app.getAppPath(), '../goed2kd')
}

export const getGoed2kdPath = (platform, arch) => {
  return is.dev() ? getDevGoed2kdPath(platform, arch) : getProdGoed2kdPath()
}

export const getGoed2kdBinPath = (platform, arch) => {
  const base = getGoed2kdPath(platform, arch)
  const binName = getGoed2kdBin(platform)
  return resolve(base, `./${binName}`)
}

export const transformConfig = (config) => {
  const result = []
  for (const [k, v] of Object.entries(config)) {
    if (v !== '') {
      result.push(`--${k}=${v}`)
    }
  }
  return result
}

export const isRunningInDmg = () => {
  if (!is.macOS() || is.dev()) {
    return false
  }
  const appPath = app.getAppPath()
  const result = appPath.startsWith('/Volumes/')
  return result
}

export const moveAppToApplicationsFolder = (errorMsg = '') => {
  return new Promise((resolve, reject) => {
    try {
      const result = app.moveToApplicationsFolder()
      if (result) {
        resolve(result)
      } else {
        reject(new Error(errorMsg))
      }
    } catch (err) {
      reject(err)
    }
  })
}

export const splitArgv = (argv) => {
  const args = []
  const extra = {}
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const kv = arg.split('=')
      const key = kv[0]
      const value = kv[1] || '1'
      extra[key] = value
      continue
    }
    args.push(arg)
  }
  return { args, extra }
}

export const parseArgvAsUrl = (argv) => {
  const arg = argv[1]
  if (!arg) {
    return
  }

  if (checkIsSupportedSchema(arg)) {
    return arg
  }
}

export const checkIsSupportedSchema = (url = '') => {
  const str = url.toLowerCase()
  if (
    str.startsWith('ftp:') ||
    str.startsWith('http:') ||
    str.startsWith('https:') ||
    str.startsWith('magnet:') ||
    str.startsWith('thunder:') ||
    str.startsWith('mo:') ||
    str.startsWith('imfile:')
  ) {
    return true
  } else {
    return false
  }
}

export const isDirectory = (path) => {
  return existsSync(path) && lstatSync(path).isDirectory()
}

export const parseArgvAsFile = (argv) => {
  let arg = argv[1]
  if (!arg || isDirectory(arg)) {
    return
  }

  if (is.linux()) {
    arg = arg.replace('file://', '')
  }
  return arg
}

export const getMaxConnectionPerServer = () => {
  return ENGINE_MAX_CONNECTION_PER_SERVER
}

export const getSystemTheme = () => {
  let result = APP_THEME.LIGHT
  result = nativeTheme.shouldUseDarkColors ? APP_THEME.DARK : APP_THEME.LIGHT
  return result
}

export const convertArrayBufferToBuffer = (arrayBuffer) => {
  const buffer = Buffer.alloc(arrayBuffer.byteLength)
  const view = new Uint8Array(arrayBuffer)
  for (let i = 0; i < buffer.length; ++i) {
    buffer[i] = view[i]
  }
  return buffer
}

export const showItemInFolder = (fullPath) => {
  if (!fullPath) {
    return
  }

  fullPath = resolve(fullPath)
  access(fullPath, constants.F_OK, (err) => {
    if (err) {
      logger.warn(`[imFile] ${fullPath} ${err ? 'does not exist' : 'exists'}`)
      return
    }

    shell.showItemInFolder(fullPath)
  })
}
