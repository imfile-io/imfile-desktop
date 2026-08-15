import { app } from 'electron'
import is from 'electron-is'
import Store from 'electron-store'
import { resolve } from 'node:path'

import {
  // getConfigBasePath,
  getDhtPath,
  getMaxConnectionPerServer,
  getUserDownloadsPath
} from '../utils/index'
import {
  collectPortableDhtPathFixes,
  isPathInsideDir
} from '../utils/portableDhtPaths'
import { reclaimLegacyDhtFiles } from '../utils/portableLegacyCleanup'
import {
  APP_RUN_MODE,
  APP_THEME,
  EMPTY_STRING,
  ENGINE_RPC_PORT,
  IP_VERSION,
  getPortableExecutableDir,
  isPortableMode,
  LOGIN_SETTING_OPTIONS,
  NGOSANG_TRACKERS_BEST_IP_URL_CDN,
  NGOSANG_TRACKERS_BEST_URL_CDN,
  PROXY_SCOPES,
  PROXY_SCOPE_OPTIONS
} from '@shared/constants'
import { CHROME_UA } from '@shared/ua'
import { separateConfig } from '@shared/utils'
import { normalizeSsapiBaseUrl } from '@shared/utils/ssapiSearch'
import { reduceTrackerString } from '@shared/utils/tracker'

export default class ConfigManager {
  constructor () {
    this.systemConfig = {}
    this.userConfig = {}

    this.init()
  }

  init () {
    this.initUserConfig()
    this.initSystemConfig()
  }

  /**
   * Aria2 Configuration Priority
   * system.json > built-in aria2.conf
   * https://aria2.github.io/manual/en/html/aria2c.html
   *
   */
  initSystemConfig () {
    this.systemConfig = new Store({
      name: 'system',
      cwd: null,

      defaults: {
        'all-proxy': EMPTY_STRING,
        'allow-overwrite': false,
        'auto-file-renaming': true,
        'bt-exclude-tracker': EMPTY_STRING,
        'bt-force-encryption': false,
        'bt-load-saved-metadata': true,
        'bt-save-metadata': true,
        'bt-tracker': EMPTY_STRING,
        continue: true,
        'dht-file-path': getDhtPath(IP_VERSION.V4),
        'dht-file-path6': getDhtPath(IP_VERSION.V6),
        'dht-listen-port': 26701,
        dir: getUserDownloadsPath(),
        'enable-dht6': true,
        'follow-metalink': true,
        'follow-torrent': true,
        'listen-port': 21301,
        'max-concurrent-downloads': 5,
        'max-connection-per-server': getMaxConnectionPerServer(),
        'max-download-limit': 0,
        'max-overall-download-limit': 0,
        'max-overall-upload-limit': 0,
        'no-proxy': EMPTY_STRING,
        'pause-metadata': false,
        pause: false,
        'rpc-listen-port': ENGINE_RPC_PORT,
        'rpc-secret': EMPTY_STRING,
        'seed-ratio': 2,
        'seed-time': 2880,
        split: getMaxConnectionPerServer(),
        'user-agent': CHROME_UA
      }

    })
    this.fixSystemConfig()
  }

  initUserConfig () {
    this.userConfig = new Store({
      name: 'user',
      cwd: null,
      // Schema need electron-store upgrade to 3.x.x,
      // but it will cause the application build to fail.
      // schema: {
      //   theme: {
      //     type: 'string',
      //     enum: ['auto', 'light', 'dark']
      //   }
      // },

      defaults: {
        'auto-check-update': is.macOS() && !isPortableMode(),
        'auto-hide-window': false,
        'auto-sync-tracker': true,
        /** 是否在「go-aria2 + aria2c」二选一弹窗中点过按钮（避免仅自动写入的配置挡住询问） */
        'download-engine-dual-prompt-done': false,
        'enable-upnp': true,
        'engine-max-connection-per-server': getMaxConnectionPerServer(),
        'favorite-directories': [],
        /** 仅 go-aria2 时用户在「导入旧会话」弹窗中选择暂不导入后为 true */
        'go-aria2-skip-legacy-import': false,
        'hide-app-menu': is.windows() || is.linux(),
        'history-directories': [],
        'keep-seeding': false,
        'keep-window-state': false,
        'last-check-update-time': 0,
        'last-sync-tracker-time': 0,
        locale: app.getLocale(),
        'log-level': 'warn',
        'new-task-show-downloading': true,
        'no-confirm-before-delete-task': false,
        'on-bt-download-complete': EMPTY_STRING,
        'on-download-complete': EMPTY_STRING,
        'open-at-login': false,
        protocols: { magnet: true, thunder: false, torrent: true, ed2k: false },
        proxy: {
          enable: false,
          server: EMPTY_STRING,
          bypass: EMPTY_STRING,
          scope: PROXY_SCOPE_OPTIONS
        },
        'resume-all-when-app-launched': true,
        'run-mode': APP_RUN_MODE.STANDARD,
        'ssapi-search-base-url': EMPTY_STRING,
        /** 方案 B：构建期默认仅首次写入；为 true 后不再根据编译值覆盖用户配置 */
        'ssapi-search-base-url-build-seeded': false,
        'show-progress-bar': true,
        'task-notification': true,
        'task-complete-sound': true,
        theme: APP_THEME.LIGHT,
        'tracker-source': [
          NGOSANG_TRACKERS_BEST_IP_URL_CDN,
          NGOSANG_TRACKERS_BEST_URL_CDN
        ],
        'tray-theme': APP_THEME.LIGHT,
        'tray-speedometer': is.macOS(),
        'update-channel': 'latest',
        'window-state': {}
      }

    })
    this.fixUserConfig()
  }

  fixSystemConfig () {
    // Remove aria2c unrecognized options
    const { others } = separateConfig(this.systemConfig.store)
    if (others && Object.keys(others).length > 0) {
      Object.keys(others).forEach(key => {
        this.systemConfig.delete(key)
      })
    }

    const proxy = this.getUserConfig('proxy', { enable: false })
    const { enable, server, bypass, scope = [] } = proxy
    if (enable && server && scope.includes(PROXY_SCOPES.DOWNLOAD)) {
      this.setSystemConfig('all-proxy', server)
      this.setSystemConfig('no-proxy', bypass)
    }

    // Fix spawn ENAMETOOLONG on Windows
    const tracker = reduceTrackerString(this.systemConfig.get('bt-tracker'))
    this.setSystemConfig('bt-tracker', tracker)

    if (isPortableMode()) {
      this.fixPortableDownloadDir()
      this.fixPortableDhtPaths()
    }
  }

  /**
   * 便携模式下将仍指向系统「下载」或 AppData 的默认目录改到程序目录下 Downloads。
   * 用户自定义的其他路径（如 D:\\MyDownloads）保持不变。
   */
  fixPortableDownloadDir () {
    const portableRoot = getPortableExecutableDir()
    if (!portableRoot) {
      return
    }

    const portableDownloads = resolve(portableRoot, 'Downloads')
    const currentDir = this.systemConfig.get('dir')
    if (!currentDir) {
      this.setSystemConfig('dir', portableDownloads)
      return
    }

    try {
      const normalizedDir = resolve(String(currentDir))
      const normalizedRoot = resolve(portableRoot)
      if (normalizedDir.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
        return
      }
      const systemDownloads = resolve(app.getPath('downloads'))
      const appDataDir = resolve(app.getPath('appData'))
      if (
        normalizedDir.toLowerCase() === systemDownloads.toLowerCase() ||
        normalizedDir.toLowerCase().startsWith(appDataDir.toLowerCase())
      ) {
        this.setSystemConfig('dir', portableDownloads)
      }
    } catch {
      // 保留用户原设置
    }
  }

  /**
   * 便携模式下将仍指向旧 AppData 的 dht-file-path / dht-file-path6 改到程序目录。
   * 从 AppData 迁移的 system.json 会带上旧绝对路径，electron-store 不会覆盖已有键，
   * 引擎会持续向 %APPDATA%\\imFile 写入 dht.dat，空目录清理因此失效。
   * 用户自定义的外部路径（如共享盘）保持不变。
   */
  fixPortableDhtPaths () {
    const portableRoot = getPortableExecutableDir()
    if (!portableRoot) {
      return
    }

    const legacyDir = this.getLegacyUserDataDir()
    const fixes = collectPortableDhtPathFixes({
      'dht-file-path': this.systemConfig.get('dht-file-path'),
      'dht-file-path6': this.systemConfig.get('dht-file-path6')
    }, portableRoot, {
      legacyDir,
      appDataDir: this.getAppDataDir()
    })

    const previousPaths = []
    for (const { key, from, to } of fixes) {
      this.setSystemConfig(key, to)
      if (from) {
        previousPaths.push(from)
      }
    }

    const overwrite = previousPaths.some((p) => isPathInsideDir(p, legacyDir))
    reclaimLegacyDhtFiles(legacyDir, portableRoot, {
      overwrite,
      extraPaths: previousPaths
    })
  }

  getLegacyUserDataDir () {
    try {
      const appName = typeof app.getName === 'function' ? app.getName() : 'imFile'
      return resolve(app.getPath('appData'), appName || 'imFile')
    } catch {
      return ''
    }
  }

  getAppDataDir () {
    try {
      return resolve(app.getPath('appData'))
    } catch {
      return ''
    }
  }

  fixUserConfig () {
    // Fix the value of open-at-login when the user delete
    // the imFile self-starting item through startup management.
    const openAtLogin = app.getLoginItemSettings(LOGIN_SETTING_OPTIONS).openAtLogin
    if (this.getUserConfig('open-at-login') !== openAtLogin) {
      this.setUserConfig('open-at-login', openAtLogin)
    }

    if (this.getUserConfig('tracker-source').length === 0) {
      this.setUserConfig('tracker-source', [
        NGOSANG_TRACKERS_BEST_IP_URL_CDN,
        NGOSANG_TRACKERS_BEST_URL_CDN
      ])
    }

    const protocols = this.getUserConfig('protocols')
    if (protocols && typeof protocols === 'object' && typeof protocols.ed2k === 'undefined') {
      this.setUserConfig('protocols', { ...protocols, ed2k: false })
    }

    this.maybeSeedSsapiSearchBaseUrlFromBuild()
  }

  /**
   * 方案 B：编译时可通过环境变量 SSAPI_BUILD_DEFAULT_BASE_URL 注入 https 根地址（Webpack 内联，不写死在仓库）。
   * 仅在用户配置中 ssapi-search-base-url 仍为空且尚未完成「构建期种子」时写入一次；之后完全以用户文件为准。
   */
  maybeSeedSsapiSearchBaseUrlFromBuild () {
    if (this.getUserConfig('ssapi-search-base-url-build-seeded')) {
      return
    }
    const rawBuild =
      typeof process.env.SSAPI_BUILD_DEFAULT_BASE_URL === 'string'
        ? process.env.SSAPI_BUILD_DEFAULT_BASE_URL
        : ''
    const buildNorm = normalizeSsapiBaseUrl(rawBuild)
    const current = this.getUserConfig('ssapi-search-base-url')
    const currentStr = typeof current === 'string' ? current.trim() : ''

    if (currentStr) {
      this.setUserConfig('ssapi-search-base-url-build-seeded', true)
      return
    }

    if (buildNorm) {
      this.setUserConfig('ssapi-search-base-url', buildNorm)
    }
    this.setUserConfig('ssapi-search-base-url-build-seeded', true)
  }

  getSystemConfig (key, defaultValue) {
    if (typeof key === 'undefined' &&
        typeof defaultValue === 'undefined') {
      return this.systemConfig.store
    }

    return this.systemConfig.get(key, defaultValue)
  }

  getUserConfig (key, defaultValue) {
    if (typeof key === 'undefined' &&
        typeof defaultValue === 'undefined') {
      return this.userConfig.store
    }

    return this.userConfig.get(key, defaultValue)
  }

  getLocale () {
    return this.getUserConfig('locale') || app.getLocale()
  }

  setSystemConfig (...args) {
    this.systemConfig.set(...args)
  }

  setUserConfig (...args) {
    this.userConfig.set(...args)
  }

  reset () {
    this.systemConfig.clear()
    this.userConfig.clear()
  }
}
