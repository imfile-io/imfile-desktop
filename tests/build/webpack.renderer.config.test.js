import { afterEach, describe, expect, it, vi } from 'vitest'

describe('webpack.renderer.config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('生产构建使用经典脚本与相对 publicPath，避免安装包 file:// 白屏', { timeout: 20000 }, async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()

    const { default: config } = await import('../../.electron-vue/webpack.renderer.config.mjs')

    expect(config.experiments?.outputModule).toBeFalsy()
    expect(config.output.module).toBeFalsy()
    expect(config.output.libraryTarget).toBe('commonjs2')
    expect(config.output.publicPath).toBe('./')
    expect(config.externals).toEqual([])

    const htmlPlugin = config.plugins.find((plugin) => plugin.constructor?.name === 'HtmlWebpackPlugin')
    expect(htmlPlugin).toBeTruthy()
    const htmlOpts = htmlPlugin.userOptions || htmlPlugin.options
    expect(htmlOpts.scriptLoading).toBe('defer')
  })

  it('开发构建保持 dev-server 所需的绝对 publicPath', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.resetModules()

    const { default: config } = await import('../../.electron-vue/webpack.renderer.config.mjs')

    expect(config.output.publicPath).toBe('/')
    expect(config.output.libraryTarget).toBe('commonjs2')
  })
})
