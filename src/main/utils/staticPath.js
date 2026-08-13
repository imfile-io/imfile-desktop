import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { app } from 'electron'

/**
 * 把 asar 内路径改成 asar.unpacked 对应路径，且不会重复替换。
 */
export function toAsarUnpackedPath (filePath) {
  if (!filePath) {
    return filePath
  }
  if (filePath.includes('app.asar.unpacked')) {
    return filePath
  }
  return filePath.replace(/app\.asar(?!\.unpacked)/, 'app.asar.unpacked')
}

function collectCandidateDirs (options = {}) {
  const mainDir = options.mainDir ?? dirname(fileURLToPath(import.meta.url))
  const appPath = options.appPath ?? (typeof app?.getAppPath === 'function' ? app.getAppPath() : '')
  const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? ''
  const isPackaged = options.isPackaged ?? app?.isPackaged

  const raw = [
    join(mainDir, 'static'),
    appPath ? join(appPath, 'dist', 'electron', 'static') : '',
    resourcesPath ? join(resourcesPath, 'static') : '',
    resourcesPath ? join(resourcesPath, 'app.asar.unpacked', 'dist', 'electron', 'static') : ''
  ]

  // 开发态 app.getAppPath() 为仓库根目录
  if (isPackaged === false && appPath) {
    raw.push(join(appPath, 'static'))
  }

  const ordered = []
  for (const item of raw.filter(Boolean)) {
    ordered.push(toAsarUnpackedPath(item))
    ordered.push(item)
  }
  return [...new Set(ordered)]
}

function dirLooksLikeStatic (dir) {
  return existsSync(join(dir, 'icon.ico')) || existsSync(join(dir, '512x512.png'))
}

/**
 * 解析打包后的 static 目录。
 * Windows 上 asar 内的 .ico 无法被 nativeImage.createFromPath 读取，须优先 asar.unpacked。
 */
export function resolveStaticDir (options = {}) {
  const candidates = collectCandidateDirs(options)
  for (const dir of candidates) {
    if (dirLooksLikeStatic(dir)) {
      return dir
    }
  }

  const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? ''
  if (resourcesPath && existsSync(join(resourcesPath, 'icon.ico'))) {
    return resourcesPath
  }

  return candidates[0] || ''
}

export function resolveStaticFile (...segments) {
  return join(resolveStaticDir(), ...segments)
}
