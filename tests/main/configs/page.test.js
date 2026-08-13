import { afterEach, describe, expect, it, vi } from 'vitest'

const mockApp = {
  isPackaged: false,
  getAppPath: vi.fn(() => '/mock/app')
}

const mockIsDev = vi.fn(() => true)

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

  it('已打包应用走本地 index.html', async () => {
    mockApp.isPackaged = true
    vi.stubEnv('NODE_ENV', 'development')

    const { resolveIndexLoad } = await import('../../../src/main/configs/page.js')

    expect(resolveIndexLoad()).toEqual({
      htmlFile: '/mock/app/dist/electron/index.html'
    })
  })
})
