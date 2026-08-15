import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, expect, it } from 'vitest'
import {
  reclaimLegacyDhtFiles,
  reclaimRewrittenLegacyDhtFiles,
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
  it('只回收 extraPaths 中且位于 legacyDir 内的 DHT 文件', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'legacy-v4')
    writeFileSync(join(legacyDir, 'dht6.dat'), 'legacy-v6')
    writeFileSync(join(portableRoot, 'dht.dat'), 'stale-v4')

    reclaimLegacyDhtFiles(legacyDir, portableRoot, {
      overwrite: true,
      extraPaths: [join(legacyDir, 'dht.dat'), join(legacyDir, 'dht6.dat')]
    })

    expect(existsSync(join(legacyDir, 'dht.dat'))).toBe(false)
    expect(existsSync(join(legacyDir, 'dht6.dat'))).toBe(false)
    expect(readFileSync(join(portableRoot, 'dht.dat'), 'utf8')).toBe('legacy-v4')
    expect(readFileSync(join(portableRoot, 'dht6.dat'), 'utf8')).toBe('legacy-v6')
    expect(existsSync(legacyDir)).toBe(false)
    rmSync(portableRoot, { recursive: true, force: true })
  })

  it('没有 extraPaths 时不扫删 AppData 中的 DHT 文件', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-keepall-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-keepall-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'install-live')

    reclaimLegacyDhtFiles(legacyDir, portableRoot, { overwrite: true })

    expect(readFileSync(join(legacyDir, 'dht.dat'), 'utf8')).toBe('install-live')
    expect(existsSync(join(portableRoot, 'dht.dat'))).toBe(false)
    rmSync(legacyDir, { recursive: true, force: true })
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

    reclaimLegacyDhtFiles(legacyDir, portableRoot, {
      overwrite: false,
      extraPaths: [join(legacyDir, 'dht.dat')]
    })

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

    reclaimLegacyDhtFiles(legacyDir, portableRoot, {
      overwrite: true,
      extraPaths: [join(legacyDir, 'dht.dat')]
    })

    expect(existsSync(join(legacyDir, 'dht.dat'))).toBe(false)
    expect(existsSync(join(legacyDir, 'user.json'))).toBe(true)
    rmSync(legacyDir, { recursive: true, force: true })
    rmSync(portableRoot, { recursive: true, force: true })
  })
})

describe('reclaimRewrittenLegacyDhtFiles', () => {
  it('未改写时不删除 AppData DHT，只清理空目录', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-norewrite-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-norewrite-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'install-live')

    reclaimRewrittenLegacyDhtFiles(legacyDir, portableRoot, [])

    expect(readFileSync(join(legacyDir, 'dht.dat'), 'utf8')).toBe('install-live')
    rmSync(legacyDir, { recursive: true, force: true })
    rmSync(portableRoot, { recursive: true, force: true })
  })

  it('改写自 AppData 的路径会覆盖便携副本并删除旧文件', () => {
    const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const legacyDir = join(tmpdir(), `imfile-legacy-dht-rewrite-${stamp}`)
    const portableRoot = join(tmpdir(), `imfile-portable-dht-rewrite-${stamp}`)
    mkdirSync(legacyDir, { recursive: true })
    mkdirSync(portableRoot, { recursive: true })
    writeFileSync(join(legacyDir, 'dht.dat'), 'legacy-live')
    writeFileSync(join(portableRoot, 'dht.dat'), 'stale-copy')

    reclaimRewrittenLegacyDhtFiles(legacyDir, portableRoot, [join(legacyDir, 'dht.dat')])

    expect(existsSync(join(legacyDir, 'dht.dat'))).toBe(false)
    expect(readFileSync(join(portableRoot, 'dht.dat'), 'utf8')).toBe('legacy-live')
    rmSync(portableRoot, { recursive: true, force: true })
    rmSync(legacyDir, { recursive: true, force: true })
  })
})
