import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { isPathInsideDir, isSameFilePath } from './portableDhtPaths'

const LEGACY_DHT_FILE_NAMES = new Set(['dht.dat', 'dht6.dat'])

/**
 * 便携模式重定向 userData 后，移除 Electron 在 app.getPath('userData') 时
 * 预先创建、但已不再使用的空 AppData 目录（如 %APPDATA%\\imFile）。
 */
export function removeEmptyLegacyUserDataDir (legacyDir) {
  if (!legacyDir) {
    return
  }

  try {
    if (!existsSync(legacyDir)) {
      return
    }
    if (readdirSync(legacyDir).length === 0) {
      rmSync(legacyDir, { recursive: true, force: true })
    }
  } catch (err) {
    console.warn('[imFile] 便携模式：清理 AppData 空目录失败', err)
  }
}

/**
 * 仅回收「本次刚从配置里改走」的旧 AppData DHT 文件。
 * 不会在每次便携启动时扫删 legacyDir 下所有 dht.dat，避免安装版与便携版并存时毁掉安装版 DHT 表。
 *
 * overwrite=true 时用残留文件覆盖便携目录副本（引擎此前一直在往 AppData 写，残留文件更新）。
 */
export function reclaimLegacyDhtFiles (legacyDir, portableRoot, options = {}) {
  const { overwrite = false, extraPaths = [] } = options
  if (!portableRoot || !legacyDir) {
    return
  }
  if (isSameFilePath(legacyDir, portableRoot)) {
    return
  }

  const seen = new Set()
  for (const extra of extraPaths) {
    if (typeof extra !== 'string' || !extra) {
      continue
    }

    let normalized
    try {
      normalized = resolve(extra)
    } catch {
      continue
    }
    const seenKey = process.platform === 'win32' ? normalized.toLowerCase() : normalized
    if (seen.has(seenKey)) {
      continue
    }
    seen.add(seenKey)

    const name = basename(normalized).toLowerCase()
    if (!LEGACY_DHT_FILE_NAMES.has(name)) {
      continue
    }
    if (!existsSync(normalized)) {
      continue
    }
    if (isPathInsideDir(normalized, portableRoot)) {
      continue
    }
    if (!isPathInsideDir(normalized, legacyDir)) {
      continue
    }

    const dest = join(portableRoot, name)
    try {
      if (overwrite || !existsSync(dest)) {
        cpSync(normalized, dest)
      }
      rmSync(normalized, { force: true })
    } catch (err) {
      console.warn('[imFile] 便携模式：回收 AppData DHT 文件失败', err)
    }
  }

  removeEmptyLegacyUserDataDir(legacyDir)
}

/**
 * 对本次改写出的旧路径做回收；没有改写时只尝试删除空的 AppData 目录。
 */
export function reclaimRewrittenLegacyDhtFiles (legacyDir, portableRoot, previousPaths = []) {
  const extraPaths = (previousPaths || []).filter((p) => (
    typeof p === 'string' && p && isPathInsideDir(p, legacyDir)
  ))
  if (extraPaths.length === 0) {
    removeEmptyLegacyUserDataDir(legacyDir)
    return
  }
  reclaimLegacyDhtFiles(legacyDir, portableRoot, {
    overwrite: true,
    extraPaths
  })
}
