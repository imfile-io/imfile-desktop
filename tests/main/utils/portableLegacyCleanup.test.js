import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  reclaimLegacyDhtFiles,
  removeEmptyLegacyUserDataDir
} from '../../../src/main/utils/portableLegacyCleanup'

describe('removeEmptyLegacyUserDataDir', () => {
  it('移除空目录', () => {
    const legacyDir = join(tmpdir(), `imfile-empty-legacy-${Date.now()}`)
    mkdirSync(legacyDir, { recursive: true })

    removeEmptyLegacyUserDataDir(legacyDir)

    expect(existsSync(legacyDir)).toBe(false)
  })

  it('保留非空目录', () => {
    const legacyDir = join(tmpdir(), `imfile-nonempty-legacy-${Date.now()}`)
    mkdirSync(legacyDir, { recursive: true })
    writeFileSync(join(legacyDir, 'user.json'), '{}')

    removeEmptyLegacyUserDataDir(legacyDir)

    expect(existsSync(legacyDir)).toBe(true)
    rmSync(legacyDir, { recursive: true, force: true })
  })

  it('忽略不存在的目录', () => {
    const legacyDir = join(tmpdir(), `imfile-missing-legacy-${Date.now()}`)

    expect(() => removeEmptyLegacyUserDataDir(legacyDir)).not.toThrow()
  })

  it('忽略空路径', () => {
    expect(() => removeEmptyLegacyUserDataDir('')).not.toThrow()
    expect(() => removeEmptyLegacyUserDataDir(null)).not.toThrow()
  })
})

describe('reclaimLegacyDhtFiles', () => {
  it('overwrite 时把 AppData 残留 DHT 文件迁到便携目录并删除旧文件', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'legacy-v4')
    writeFileSync(join(legacyDir, 'dht6.dat'), 'legacy-v6')
    writeFileSync(join(portableRoot, 'dht.dat'), 'stale-v4')

    reclaimLegacyDhtFiles(legacyDir, portableRoot, { overwrite: true })

    expect(existsSync(join(legacyDir, 'dht.dat'))).toBe(false)
    expect(existsSync(join(legacyDir, 'dht6.dat'))).toBe(false)
    expect(readFileSync(join(portableRoot, 'dht.dat'), 'utf8')).toBe('legacy-v4')
    expect(readFileSync(join(portableRoot, 'dht6.dat'), 'utf8')).toBe('legacy-v6')
    expect(existsSync(legacyDir)).toBe(false)
    rmSync(portableRoot, { recursive: true, force: true })
  })

  it('不覆盖便携目录中已有的 DHT 文件', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-keep-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-keep-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'legacy-v4')
    writeFileSync(join(portableRoot, 'dht.dat'), 'portable-live')

    reclaimLegacyDhtFiles(legacyDir, portableRoot, { overwrite: false })

    expect(existsSync(join(legacyDir, 'dht.dat'))).toBe(false)
    expect(readFileSync(join(portableRoot, 'dht.dat'), 'utf8')).toBe('portable-live')
    rmSync(portableRoot, { recursive: true, force: true })
    rmSync(legacyDir, { recursive: true, force: true })
  })

  it('不删除 legacyDir 之外的自定义 DHT 文件', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-skip-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-skip-${stamp}`)
    const customDir = join(tmpdir(), `imfile-custom-dht-skip-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    mkdirSync(customDir, { recursive: true })
    const customFile = join(customDir, 'dht.dat')
    writeFileSync(customFile, 'custom-live')

    reclaimLegacyDhtFiles(legacyDir, portableRoot, {
      overwrite: true,
      extraPaths: [customFile]
    })

    expect(existsSync(customFile)).toBe(true)
    expect(readFileSync(customFile, 'utf8')).toBe('custom-live')
    expect(existsSync(join(portableRoot, 'dht.dat'))).toBe(false)
    rmSync(legacyDir, { recursive: true, force: true })
    rmSync(portableRoot, { recursive: true, force: true })
    rmSync(customDir, { recursive: true, force: true })
  })

  it('回收后若仍有其他文件则保留 AppData 目录', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-keepdir-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-keepdir-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'legacy-v4')
    writeFileSync(join(legacyDir, 'user.json'), '{}')

    reclaimLegacyDhtFiles(legacyDir, portableRoot, { overwrite: true })

    expect(existsSync(join(legacyDir, 'dht.dat'))).toBe(false)
    expect(existsSync(join(legacyDir, 'user.json'))).toBe(true)
    rmSync(legacyDir, { recursive: true, force: true })
    rmSync(portableRoot, { recursive: true, force: true })
  })
})
