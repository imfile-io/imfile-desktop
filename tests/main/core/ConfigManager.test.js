import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MemoryStore } from '../../helpers/electron-store-mock.js'
import { createElectronIsMock, createElectronMock } from '../../helpers/electron-mock.js'
import {
  APP_THEME,
  NGOSANG_TRACKERS_BEST_IP_URL_CDN,
  NGOSANG_TRACKERS_BEST_URL_CDN,
  PROXY_SCOPES
} from '@shared/constants'

vi.mock('electron-store', () => ({
  default: MemoryStore
}))

vi.mock('electron', () => createElectronMock())
vi.mock('electron-is', () => createElectronIsMock())
vi.mock('electron-log', () => ({
  default: {
    transports: { file: { level: 'info' } },
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn()
  }
}))

const { default: ConfigManager } = await import('../../../src/main/core/ConfigManager.js')

describe('ConfigManager', () => {
  let manager

  beforeEach(() => {
    delete process.env.PORTABLE_EXECUTABLE_DIR
    delete process.env.SSAPI_BUILD_DEFAULT_BASE_URL
    manager = new ConfigManager()
  })

  afterEach(() => {
    delete process.env.PORTABLE_EXECUTABLE_DIR
    delete process.env.SSAPI_BUILD_DEFAULT_BASE_URL
  })

  it('初始化用户与系统默认配置', () => {
    expect(manager.getUserConfig('theme')).toBe(APP_THEME.LIGHT)
    expect(manager.getSystemConfig('max-concurrent-downloads')).toBe(5)
    expect(manager.getSystemConfig('dir')).toBeTruthy()
  })

  it('读写用户与系统配置', () => {
    manager.setUserConfig('theme', APP_THEME.DARK)
    manager.setSystemConfig('max-concurrent-downloads', 8)

    expect(manager.getUserConfig('theme')).toBe(APP_THEME.DARK)
    expect(manager.getSystemConfig('max-concurrent-downloads')).toBe(8)
  })

  it('getLocale 优先返回用户配置', () => {
    manager.setUserConfig('locale', 'en-US')
    expect(manager.getLocale()).toBe('en-US')
  })

  it('tracker-source 为空时自动补全默认值', () => {
    manager.setUserConfig('tracker-source', [])
    manager.fixUserConfig()

    expect(manager.getUserConfig('tracker-source')).toEqual([
      NGOSANG_TRACKERS_BEST_IP_URL_CDN,
      NGOSANG_TRACKERS_BEST_URL_CDN
    ])
  })

  it('protocols 缺少 ed2k 时自动补全为 false', () => {
    manager.setUserConfig('protocols', { magnet: true, thunder: false })
    manager.fixUserConfig()

    expect(manager.getUserConfig('protocols')).toMatchObject({ ed2k: false })
  })

  it('启用下载代理时同步到系统 all-proxy', () => {
    manager.setUserConfig('proxy', {
      enable: true,
      server: 'http://127.0.0.1:7890',
      bypass: 'localhost',
      scope: [PROXY_SCOPES.DOWNLOAD]
    })
    manager.fixSystemConfig()

    expect(manager.getSystemConfig('all-proxy')).toBe('http://127.0.0.1:7890')
    expect(manager.getSystemConfig('no-proxy')).toBe('localhost')
  })

  it('构建期 SSAPI 地址仅种子写入一次', () => {
    process.env.SSAPI_BUILD_DEFAULT_BASE_URL = 'https://search.example.com/'
    manager = new ConfigManager()

    expect(manager.getUserConfig('ssapi-search-base-url')).toBe('https://search.example.com')
    expect(manager.getUserConfig('ssapi-search-base-url-build-seeded')).toBe(true)

    process.env.SSAPI_BUILD_DEFAULT_BASE_URL = 'https://other.example.com/'
    manager.maybeSeedSsapiSearchBaseUrlFromBuild()
    expect(manager.getUserConfig('ssapi-search-base-url')).toBe('https://search.example.com')
  })

  it('便携模式下将系统下载目录迁移到程序目录', () => {
    process.env.PORTABLE_EXECUTABLE_DIR = '/portable'
    manager.setSystemConfig('dir', '/mock/downloads')
    manager.fixPortableDownloadDir()

    expect(manager.getSystemConfig('dir')).toBe('/portable/Downloads')
  })

  it('便携模式下将残留的 AppData DHT 路径改写到程序目录', () => {
    process.env.PORTABLE_EXECUTABLE_DIR = '/portable'
    manager.setSystemConfig('dht-file-path', '/mock/appData/imFile/dht.dat')
    manager.setSystemConfig('dht-file-path6', '/mock/appData/imFile/dht6.dat')
    manager.fixPortableDhtPaths()

    expect(manager.getSystemConfig('dht-file-path')).toBe('/portable/dht.dat')
    expect(manager.getSystemConfig('dht-file-path6')).toBe('/portable/dht6.dat')
  })

  it('便携模式下已指向程序目录的 DHT 路径保持不变', () => {
    process.env.PORTABLE_EXECUTABLE_DIR = '/portable'
    manager.setSystemConfig('dht-file-path', '/portable/dht.dat')
    manager.setSystemConfig('dht-file-path6', '/portable/dht6.dat')
    manager.fixPortableDhtPaths()

    expect(manager.getSystemConfig('dht-file-path')).toBe('/portable/dht.dat')
    expect(manager.getSystemConfig('dht-file-path6')).toBe('/portable/dht6.dat')
  })

  it('fixSystemConfig 在便携模式下同步纠正 DHT 路径', () => {
    process.env.PORTABLE_EXECUTABLE_DIR = '/portable'
    manager.setSystemConfig('dht-file-path', '/mock/appData/imFile/dht.dat')
    manager.setSystemConfig('dht-file-path6', '/mock/appData/imFile/dht6.dat')
    manager.fixSystemConfig()

    expect(manager.getSystemConfig('dht-file-path')).toBe('/portable/dht.dat')
    expect(manager.getSystemConfig('dht-file-path6')).toBe('/portable/dht6.dat')
  })

  it('reset 清空用户与系统配置', () => {
    manager.setUserConfig('theme', APP_THEME.DARK)
    manager.setSystemConfig('pause', true)
    manager.reset()

    expect(manager.getUserConfig()).toEqual({})
    expect(manager.getSystemConfig()).toEqual({})
  })
})
