import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'

export const PORTABLE_DHT_PATH_KEYS = [
  ['dht-file-path', 'dht.dat'],
  ['dht-file-path6', 'dht6.dat']
]

export function isSameFilePath (left, right) {
  if (!left || !right) {
    return false
  }
  try {
    const a = resolve(String(left))
    const b = resolve(String(right))
    if (process.platform === 'win32') {
      return a.toLowerCase() === b.toLowerCase()
    }
    return a === b
  } catch {
    return false
  }
}

export function isPathInsideDir (filePath, dir) {
  if (!filePath || !dir) {
    return false
  }
  try {
    const resolvedFile = resolve(String(filePath))
    const resolvedDir = resolve(String(dir))
    if (isSameFilePath(resolvedFile, resolvedDir)) {
      return true
    }
    const prefix = resolvedDir.endsWith(sep) ? resolvedDir : `${resolvedDir}${sep}`
    if (process.platform === 'win32') {
      return resolvedFile.toLowerCase().startsWith(prefix.toLowerCase())
    }
    return resolvedFile.startsWith(prefix)
  } catch {
    return false
  }
}

export function getPortableDhtFilePath (portableRoot, fileName) {
  return resolve(portableRoot, fileName)
}

let rememberedLegacyUserDataDir = ''

/** 记录便携重定向前的默认 userData，供 ConfigManager 与启动清理使用同一路径。 */
export function rememberLegacyUserDataDir (dir) {
  rememberedLegacyUserDataDir = typeof dir === 'string' ? dir : ''
}

export function getRememberedLegacyUserDataDir () {
  return rememberedLegacyUserDataDir
}

/**
 * 是否属于应纠正的旧 DHT 位置：空值，或落在旧 AppData userData 内。
 * 自定义外部路径（如共享盘、AppData 下其他目录）不视为残留。
 */
export function isLegacyPortableDhtLocation (filePath, options = {}) {
  if (!filePath || !String(filePath).trim()) {
    return true
  }
  return Boolean(options.legacyDir && isPathInsideDir(filePath, options.legacyDir))
}

/**
 * 计算需要改写到便携根目录的 DHT 路径。
 * 只纠正空值和旧 AppData 残留；用户自定义的外部路径保持不变。
 * electron-store 对已存在的键不会套用 defaults，迁移后的绝对路径会一直指向 AppData。
 * @returns {{ key: string, from: string, to: string }[]}
 */
export function collectPortableDhtPathFixes (currentByKey, portableRoot, options = {}) {
  if (!currentByKey || !portableRoot) {
    return []
  }

  const fixes = []
  for (const [key, fileName] of PORTABLE_DHT_PATH_KEYS) {
    const expected = getPortableDhtFilePath(portableRoot, fileName)
    const current = currentByKey[key]
    const currentStr = current == null ? '' : String(current).trim()
    if (currentStr && isSameFilePath(currentStr, expected)) {
      continue
    }
    if (currentStr && !isLegacyPortableDhtLocation(currentStr, options)) {
      continue
    }
    fixes.push({
      key,
      from: currentStr,
      to: expected
    })
  }
  return fixes
}

/**
 * 读取便携目录 system.json，将残留的 DHT 绝对路径改写为便携根目录。
 * @returns {{ changed: boolean, previousPaths: string[] }}
 */
export function rewritePortableDhtPathsInSystemJson (systemJsonPath, portableRoot, options = {}) {
  const empty = { changed: false, previousPaths: [] }
  if (!systemJsonPath || !portableRoot || !existsSync(systemJsonPath)) {
    return empty
  }

  try {
    const data = JSON.parse(readFileSync(systemJsonPath, 'utf8'))
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return empty
    }

    const fixes = collectPortableDhtPathFixes(data, portableRoot, options)
    if (fixes.length === 0) {
      return empty
    }

    const previousPaths = []
    for (const { key, from, to } of fixes) {
      data[key] = to
      if (from) {
        previousPaths.push(from)
      }
    }
    writeFileSync(systemJsonPath, `${JSON.stringify(data, null, 2)}\n`)
    return { changed: true, previousPaths }
  } catch (err) {
    console.warn('[imFile] 便携模式：重写 system.json DHT 路径失败', err)
    return empty
  }
}
