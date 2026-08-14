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
 * 回收 AppData 中残留的 dht.dat / dht6.dat。
 * 迁移后若 system.json 仍指向旧绝对路径，引擎会持续写入这些文件，
 * 导致目录非空、空目录清理永远不触发。
 *
 * overwrite=true 时用残留文件覆盖便携目录副本（引擎此前一直在往 AppData 写，残留文件更新）。
 */
export function reclaimLegacyDhtFiles (legacyDir, portableRoot, options = {}) {
  const { overwrite = false, extraPaths = [] } = options
  if (!portableRoot) {
    return
  }
  if (legacyDir && isSameFilePath(legacyDir, portableRoot)) {
    return
  }

  const targets = []
  if (legacyDir) {
    for (const name of LEGACY_DHT_FILE_NAMES) {
      targets.push(join(legacyDir, name))
    }
  }
  for (const extra of extraPaths) {
    if (typeof extra === 'string' && extra) {
      targets.push(extra)
    }
  }

  const seen = new Set()
  for (const src of targets) {
    let normalized
    try {
      normalized = resolve(src)
    } catch {
      continue
    }
    if (seen.has(normalized)) {
      continue
    }
    seen.add(normalized)

    const name = basename(normalized)
    if (!LEGACY_DHT_FILE_NAMES.has(name)) {
      continue
    }
    if (!existsSync(normalized)) {
      continue
    }
    if (isPathInsideDir(normalized, portableRoot)) {
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
