import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mockApp = {
  isPackaged: false,
  getAppPath: vi.fn(() => '/mock/app')
}

const mockIsDev = vi.fn(() => true)
const mockExistsSync = vi.fn(() => false)

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    existsSync: (...args) => mockExistsSync(...args)
  }
})

vi.mock('electron', () => ({
  app: mockApp
}))

vi.mock('electron-is', () => ({
  default: {
    dev: () => mockIsDev(),
    macOS: () => false
  }
}))

describe('main/configs/page', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    mockApp.isPackaged = false
    mockIsDev.mockReturnValue(true)
    mockExistsSync.mockReturnValue(false)
    vi.resetModules()
  })

  it('electron-vite dev 优先使用 ELECTRON_RENDERER_URL', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://127.0.0.1:5173')

    const { getRendererDevServerUrl, resolveIndexLoad } = await import('../../../src/main/configs/page.js')

    expect(getRendererDevServerUrl()).toBe('http://127.0.0.1:5173/')
    expect(resolveIndexLoad()).toEqual({ url: 'http://127.0.0.1:5173/' })
  })

  it('webpack dev-server 回退到 9080', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.ELECTRON_RENDERER_URL

    const { getRendererDevServerUrl } = await import('../../../src/main/configs/page.js')

    expect(getRendererDevServerUrl()).toBe('http://localhost:9080/index.html')
  })

  it('已打包且同目录无 index.html 时回退到 app 产物路径', async () => {
    mockApp.isPackaged = true
    mockExistsSync.mockReturnValue(false)
    vi.stubEnv('NODE_ENV', 'development')

    const { resolveIndexLoad } = await import('../../../src/main/configs/page.js')

    expect(resolveIndexLoad()).toEqual({
      htmlFile: path.join('/mock/app', 'dist', 'electron', 'index.html')
    })
  })

  it('同目录存在 index.html 时优先使用（打包后与 main.js 同目录）', async () => {
    mockApp.isPackaged = true
    mockExistsSync.mockReturnValue(true)
    vi.stubEnv('NODE_ENV', 'production')

    const { resolveIndexLoad } = await import('../../../src/main/configs/page.js')
    const htmlFile = resolveIndexLoad().htmlFile.replace(/\\/g, '/')

    expect(htmlFile).toMatch(/\/index\.html$/)
    expect(htmlFile).not.toContain('dist/electron')
  })
})
