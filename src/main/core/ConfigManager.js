import { app } from 'electron'
import is from 'electron-is'
import Store from 'electron-store'

import {
  // getConfigBasePath,
  getDhtPath,
  getMaxConnectionPerServer,
  getUserDownloadsPath
} from '../utils/index'
import {
  APP_RUN_MODE,
  APP_THEME,
  EMPTY_STRING,
  ENGINE_RPC_PORT,
  IP_VERSION,
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
        'auto-check-update': is.macOS(),
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
