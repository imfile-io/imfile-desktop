import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockExistsSync = vi.fn(() => false)

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    existsSync: (...args) => mockExistsSync(...args)
  }
})

vi.mock('electron', () => ({
  app: {
    getAppPath: () => join('/pack', 'resources', 'app.asar')
  }
}))

describe('main/utils/staticPath', () => {
  afterEach(() => {
    mockExistsSync.mockReset()
    mockExistsSync.mockReturnValue(false)
    vi.resetModules()
  })

  it('toAsarUnpackedPath 将 app.asar 换成 app.asar.unpacked，且不重复替换', async () => {
    const { toAsarUnpackedPath } = await import('../../../src/main/utils/staticPath.js')
    const asarFile = join('/pack', 'resources', 'app.asar', 'dist', 'electron', 'static', 'icon.ico')
    const unpacked = toAsarUnpackedPath(asarFile)
    expect(unpacked).toBe(join('/pack', 'resources', 'app.asar.unpacked', 'dist', 'electron', 'static', 'icon.ico'))
    expect(unpacked).not.toContain('app.asar.unpacked.unpacked')
    expect(toAsarUnpackedPath(unpacked)).toBe(unpacked)
  })

  it('优先使用 asar.unpacked 下的 static（Windows ico 不能从 asar 内读取）', async () => {
    const unpackedStatic = join('/pack', 'resources', 'app.asar.unpacked', 'dist', 'electron', 'static')
    mockExistsSync.mockImplementation((p) => {
      const n = String(p).replace(/\\/g, '/')
      return n.includes('app.asar.unpacked') && n.endsWith('/icon.ico')
    })

    const { resolveStaticDir } = await import('../../../src/main/utils/staticPath.js')
    const dir = resolveStaticDir({
      mainDir: join('/pack', 'resources', 'app.asar', 'dist', 'electron'),
      appPath: join('/pack', 'resources', 'app.asar'),
      resourcesPath: join('/pack', 'resources')
    })
    expect(dir).toBe(unpackedStatic)
  })

  it('开发态回退到仓库 static 目录', async () => {
    const appPath = join('/repo')
    mockExistsSync.mockImplementation((p) => {
      const n = String(p).replace(/\\/g, '/')
      return n === join(appPath, 'static', 'icon.ico').replace(/\\/g, '/')
    })

    const { resolveStaticDir } = await import('../../../src/main/utils/staticPath.js')
    const dir = resolveStaticDir({
      mainDir: join('/repo', 'dist', 'electron'),
      appPath,
      resourcesPath: '',
      isPackaged: false
    })
    expect(dir).toBe(join(appPath, 'static'))
  })

  it('extraResources 的 resources/icon.ico 可作为回退', async () => {
    const resourcesPath = join('/pack', 'resources')
    mockExistsSync.mockImplementation((p) => {
      const n = String(p).replace(/\\/g, '/')
      return n === join(resourcesPath, 'icon.ico').replace(/\\/g, '/')
    })

    const { resolveStaticDir } = await import('../../../src/main/utils/staticPath.js')
    const dir = resolveStaticDir({
      mainDir: join('/missing', 'main'),
      appPath: join('/missing', 'app.asar'),
      resourcesPath
    })
    expect(dir).toBe(resourcesPath)
  })
})
