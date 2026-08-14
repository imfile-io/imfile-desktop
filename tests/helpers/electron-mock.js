import { vi } from 'vitest'

export const createElectronMock = (overrides = {}) => {
  const app = {
    getPath: vi.fn((name) => {
      const paths = {
        userData: '/mock/userData',
        logs: '/mock/logs',
        downloads: '/mock/downloads',
        appData: '/mock/appData',
        exe: '/mock/imFile.exe',
        temp: '/mock/temp'
      }
      return paths[name] || `/mock/${name}`
    }),
    getAppPath: vi.fn(() => '/mock/app'),
    getName: vi.fn(() => 'imFile'),
    getLocale: vi.fn(() => 'zh-CN'),
    getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
    isPackaged: false,
    setPath: vi.fn(),
    moveToApplicationsFolder: vi.fn(() => true),
    ...overrides.app
  }

  return {
    app,
    nativeTheme: {
      shouldUseDarkColors: false,
      ...overrides.nativeTheme
    },
    shell: {
      showItemInFolder: vi.fn(),
      ...overrides.shell
    }
  }
}

export const createElectronIsMock = (overrides = {}) => ({
  default: {
    dev: () => true,
    production: () => false,
    macOS: () => false,
    linux: () => process.platform === 'linux',
    windows: () => process.platform === 'win32',
    renderer: () => true,
    mas: () => false,
    ...overrides
  }
})
