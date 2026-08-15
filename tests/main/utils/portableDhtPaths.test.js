import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectPortableDhtPathFixes,
  isLegacyPortableDhtLocation,
  isPathInsideDir,
  isSameFilePath,
  rewritePortableDhtPathsInSystemJson
} from '../../../src/main/utils/portableDhtPaths'

const tempDirs = []

function makeTempDir (prefix) {
  const dir = join(tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('isSameFilePath / isPathInsideDir', () => {
  it('识别相同路径', () => {
    expect(isSameFilePath('/portable/dht.dat', '/portable/./dht.dat')).toBe(true)
    expect(isSameFilePath('/portable/dht.dat', '/other/dht.dat')).toBe(false)
    expect(isSameFilePath('', '/portable/dht.dat')).toBe(false)
  })

  it('识别目录包含关系', () => {
    expect(isPathInsideDir('/appData/imFile/dht.dat', '/appData/imFile')).toBe(true)
    expect(isPathInsideDir('/appData/imFile', '/appData/imFile')).toBe(true)
    expect(isPathInsideDir('/portable/dht.dat', '/appData/imFile')).toBe(false)
    expect(isPathInsideDir('/appData/imFile-extra/dht.dat', '/appData/imFile')).toBe(false)
  })
})

describe('collectPortableDhtPathFixes', () => {
  const legacyOptions = {
    legacyDir: '/mock/appData/imFile',
    appDataDir: '/mock/appData'
  }

  it('将 AppData 残留路径改写到便携根目录', () => {
    const fixes = collectPortableDhtPathFixes({
      'dht-file-path': '/mock/appData/imFile/dht.dat',
      'dht-file-path6': '/mock/appData/imFile/dht6.dat'
    }, '/portable', legacyOptions)

    expect(fixes).toEqual([
      {
        key: 'dht-file-path',
        from: '/mock/appData/imFile/dht.dat',
        to: '/portable/dht.dat'
      },
      {
        key: 'dht-file-path6',
        from: '/mock/appData/imFile/dht6.dat',
        to: '/portable/dht6.dat'
      }
    ])
  })

  it('已指向便携目录时不改写', () => {
    expect(collectPortableDhtPathFixes({
      'dht-file-path': '/portable/dht.dat',
      'dht-file-path6': '/portable/dht6.dat'
    }, '/portable', legacyOptions)).toEqual([])
  })

  it('空值或缺省键也会补到便携目录', () => {
    const fixes = collectPortableDhtPathFixes({}, '/portable', legacyOptions)
    expect(fixes.map((item) => item.to)).toEqual([
      '/portable/dht.dat',
      '/portable/dht6.dat'
    ])
  })

  it('保留用户自定义的外部 DHT 路径', () => {
    expect(collectPortableDhtPathFixes({
      'dht-file-path': '/shared/dht/dht.dat',
      'dht-file-path6': '/shared/dht/dht6.dat'
    }, '/portable', legacyOptions)).toEqual([])
  })

  it('AppData 根下但不在 imFile 目录的路径仍视为残留', () => {
    const fixes = collectPortableDhtPathFixes({
      'dht-file-path': '/mock/appData/other/dht.dat',
      'dht-file-path6': '/portable/dht6.dat'
    }, '/portable', legacyOptions)
    expect(fixes).toEqual([
      {
        key: 'dht-file-path',
        from: '/mock/appData/other/dht.dat',
        to: '/portable/dht.dat'
      }
    ])
  })
})

describe('isLegacyPortableDhtLocation', () => {
  const options = {
    legacyDir: '/mock/appData/imFile',
    appDataDir: '/mock/appData'
  }

  it('空值与 AppData 残留为 true，共享盘路径为 false', () => {
    expect(isLegacyPortableDhtLocation('', options)).toBe(true)
    expect(isLegacyPortableDhtLocation('/mock/appData/imFile/dht.dat', options)).toBe(true)
    expect(isLegacyPortableDhtLocation('/mock/appData/other/dht.dat', options)).toBe(true)
    expect(isLegacyPortableDhtLocation('/shared/dht/dht.dat', options)).toBe(false)
  })
})

describe('rewritePortableDhtPathsInSystemJson', () => {
  it('重写 system.json 中的 DHT 绝对路径', () => {
    const portableRoot = makeTempDir('imfile-portable-dht')
    const systemJsonPath = join(portableRoot, 'system.json')
    writeFileSync(systemJsonPath, JSON.stringify({
      dir: '/portable/Downloads',
      'dht-file-path': '/mock/appData/imFile/dht.dat',
      'dht-file-path6': '/mock/appData/imFile/dht6.dat',
      'save-session': '/portable/session.json'
    }, null, 2))

    const result = rewritePortableDhtPathsInSystemJson(systemJsonPath, portableRoot, {
      legacyDir: '/mock/appData/imFile',
      appDataDir: '/mock/appData'
    })

    expect(result.changed).toBe(true)
    expect(result.previousPaths).toEqual([
      '/mock/appData/imFile/dht.dat',
      '/mock/appData/imFile/dht6.dat'
    ])

    const written = JSON.parse(readFileSync(systemJsonPath, 'utf8'))
    expect(written['dht-file-path']).toBe(join(portableRoot, 'dht.dat'))
    expect(written['dht-file-path6']).toBe(join(portableRoot, 'dht6.dat'))
    expect(written['save-session']).toBe('/portable/session.json')
  })

  it('路径已正确时不改写文件', () => {
    const portableRoot = makeTempDir('imfile-portable-dht-ok')
    const systemJsonPath = join(portableRoot, 'system.json')
    const payload = {
      'dht-file-path': join(portableRoot, 'dht.dat'),
      'dht-file-path6': join(portableRoot, 'dht6.dat')
    }
    writeFileSync(systemJsonPath, JSON.stringify(payload))

    const result = rewritePortableDhtPathsInSystemJson(systemJsonPath, portableRoot)
    expect(result.changed).toBe(false)
    expect(JSON.parse(readFileSync(systemJsonPath, 'utf8'))).toEqual(payload)
  })

  it('自定义外部 DHT 路径不写入 system.json', () => {
    const portableRoot = makeTempDir('imfile-portable-dht-custom')
    const systemJsonPath = join(portableRoot, 'system.json')
    const payload = {
      'dht-file-path': '/shared/dht/dht.dat',
      'dht-file-path6': '/shared/dht/dht6.dat'
    }
    writeFileSync(systemJsonPath, JSON.stringify(payload))

    const result = rewritePortableDhtPathsInSystemJson(systemJsonPath, portableRoot, {
      legacyDir: '/mock/appData/imFile',
      appDataDir: '/mock/appData'
    })

    expect(result.changed).toBe(false)
    expect(JSON.parse(readFileSync(systemJsonPath, 'utf8'))).toEqual(payload)
  })

  it('缺少 system.json 时静默跳过', () => {
    const portableRoot = makeTempDir('imfile-portable-dht-missing')
    const result = rewritePortableDhtPathsInSystemJson(
      join(portableRoot, 'system.json'),
      portableRoot
    )
    expect(result).toEqual({ changed: false, previousPaths: [] })
    expect(existsSync(join(portableRoot, 'system.json'))).toBe(false)
  })
})
