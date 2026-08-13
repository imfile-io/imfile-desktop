import { describe, expect, it, vi } from 'vitest'

vi.mock('@electron/remote', () => ({
  shell: {
    showItemInFolder: vi.fn(),
    openPath: vi.fn(),
    trashItem: vi.fn()
  },
  nativeTheme: {
    shouldUseDarkColors: false
  }
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn() }
}))

describe('renderer/utils/native getSystemTheme', () => {
  it('读取 nativeTheme 成功时返回 light/dark', async () => {
    const { nativeTheme } = await import('@electron/remote')
    const { APP_THEME } = await import('@shared/constants')
    const { getSystemTheme } = await import('@/utils/native')

    nativeTheme.shouldUseDarkColors = false
    expect(getSystemTheme()).toBe(APP_THEME.LIGHT)

    nativeTheme.shouldUseDarkColors = true
    expect(getSystemTheme()).toBe(APP_THEME.DARK)
  })

  it('nativeTheme 抛错时回退为 light，不阻断 Vue 挂载', async () => {
    const { nativeTheme } = await import('@electron/remote')
    const { APP_THEME } = await import('@shared/constants')
    const { getSystemTheme } = await import('@/utils/native')

    Object.defineProperty(nativeTheme, 'shouldUseDarkColors', {
      get () {
        throw new Error('remote unavailable')
      },
      configurable: true
    })

    expect(getSystemTheme()).toBe(APP_THEME.LIGHT)
  })
})
