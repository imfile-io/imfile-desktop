import { EventEmitter } from 'node:events'
import { existsSync, readFile, statSync, unlink } from 'node:fs'
import { extname, basename } from 'node:path'
import { spawn } from 'node:child_process'
import { app, shell, dialog, ipcMain, BrowserWindow } from 'electron'
import is from 'electron-is'
import { isEmpty, isEqual } from 'lodash'

import {
  APP_RUN_MODE,
  AUTO_SYNC_TRACKER_INTERVAL,
  AUTO_CHECK_UPDATE_INTERVAL,
  POST_DOWNLOAD_ACTION,
  PROXY_SCOPES
} from '@shared/constants'
import { checkIsNeedRun } from '@shared/utils'
import {
  convertTrackerDataToComma,
  fetchBtTrackerFromSource,
  reduceTrackerString
} from '@shared/utils/tracker'
import {
  ENGINE_BACKEND,
  getEngineBinPathByBackend,
  getGoAria2SessionJsonPath,
  getSessionPath,
  showItemInFolder
} from './utils'
import logger from './core/Logger'
import Context from './core/Context'
import ConfigManager from './core/ConfigManager'
import { setupLocaleManager } from './ui/Locale'
import Engine from './core/Engine'
import EngineClient from './core/EngineClient'
import Goed2kdEngine, {
  readGoed2kdEnginePortsFromConfigSync
} from './core/Goed2kdEngine'
import Goed2kdClient from './core/Goed2kdClient'
import UPnPManager from './core/UPnPManager'
import AutoLaunchManager from './core/AutoLaunchManager'
import UpdateManager from './core/UpdateManager'
import EnergyManager from './core/EnergyManager'
import ProtocolManager from './core/ProtocolManager'
import WindowManager from './ui/WindowManager'
import MenuManager from './ui/MenuManager'
import TouchBarManager from './ui/TouchBarManager'
import TrayManager from './ui/TrayManager'
import DockManager from './ui/DockManager'
import ThemeManager from './ui/ThemeManager'
import {
  closeEngineBootstrapOverlay,
  showEngineBootstrapOverlay
} from './ui/EngineBootstrapOverlay'

export default class Application extends EventEmitter {
  constructor () {
    super()
    this.isReady = false
    /**
     * 用户确认执行 migrate-from-aria2 时为 true，用于显示迁移加载动画。
     */
    this._pendingLegacySessionMigrate = false
    this.init()
  }

  init () {
    this.initConfigManager()

    this.initContext()

    this.setupLogger()

    this.initLocaleManager()

    this.setupApplicationMenu()

    this.initWindowManager()

    this.initUPnPManager()

    this.startGoed2kd()

    this.initEngineClient()

    this.initThemeManager()

    this.initTrayManager()

    this.initTouchBarManager()

    this.initDockManager()

    this.initAutoLaunchManager()

    this.initEnergyManager()

    this.initProtocolManager()

    this.initUpdaterManager()

    this.handleCommands()

    this.handleEvents()

    this.handleIpcMessages()

    this.handleIpcInvokes()

    this.emit('application:initialized')
  }

  initContext () {
    this.context = new Context(this.configManager)
  }

  initConfigManager () {
    this.configListeners = {}
    this.configManager = new ConfigManager()
  }

  offConfigListeners () {
    try {
      Object.keys(this.configListeners).forEach((key) => {
        this.configListeners[key]()
      })
    } catch (e) {
      logger.warn('[imFile] offConfigListeners===>', e)
    }
    this.configListeners = {}
  }

  setupLogger () {
    const { userConfig } = this.configManager
    const key = 'log-level'
    const logLevel = userConfig.get(key)
    logger.transports.file.level = logLevel

    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      logger.transports.file.level = newValue
    })
  }

  initLocaleManager () {
    this.locale = this.configManager.getLocale()
    this.localeManager = setupLocaleManager(this.locale)
    this.i18n = this.localeManager.getI18n()
  }

  setupApplicationMenu () {
    this.menuManager = new MenuManager()
    this.menuManager.setup(this.locale)
  }

  adjustMenu () {
    if (is.mas()) {
      const visibleStates = {
        'app.check-for-updates': false,
        'task.new-bt-task': false
      }
      this.menuManager.updateMenuStates(visibleStates, null, null)
      this.trayManager.updateMenuStates(visibleStates, null, null)
    }
  }

  /**
   * 解析下载引擎并在需要时迁移会话后启动进程。
   * 双引擎：旧会话未迁移时询问升级或保留经典内核；仅 go-aria2：询问是否导入旧会话。
   * 在首屏窗口创建后调用，以便对话框可挂到主窗口。
   */
  async bootstrapDownloadEngine (browserWindow) {
    const self = this
    try {
      const backend = await this.resolveDownloadEngineBackend(browserWindow)

      if (
        backend === ENGINE_BACKEND.GO_ARIA2 &&
        Engine.shouldRunMigrateFromAria2() &&
        !this.configManager.getUserConfig('go-aria2-skip-legacy-import')
      ) {
        const { platform, arch } = process
        const goBin = getEngineBinPathByBackend(
          platform,
          arch,
          ENGINE_BACKEND.GO_ARIA2
        )
        let overlayWin = null
        try {
          if (this._pendingLegacySessionMigrate) {
            overlayWin = await showEngineBootstrapOverlay(
              browserWindow,
              this.i18n.t('app.engine-migrating-message')
            )
            await new Promise((resolve) => setImmediate(resolve))
          }
          Engine.runMigrateFromAria2Session(
            goBin,
            this.configManager.getSystemConfig()
          )
        } finally {
          closeEngineBootstrapOverlay(overlayWin)
        }
      }
      this._pendingLegacySessionMigrate = false

      this.engine = new Engine({
        systemConfig: this.configManager.getSystemConfig(),
        userConfig: this.configManager.getUserConfig(),
        engineBackend: backend
      })
      const binPath = this.engine.getEngineBinPath()
      this.context.set('engine-bin-path', binPath)
      this.context.set('aria2-bin-path', binPath)
      this.engine.start()
    } catch (err) {
      const { message } = err
      dialog.showMessageBox({
        type: 'error',
        title: this.i18n.t('app.system-error-title'),
        message: this.i18n.t('app.system-error-message', { message })
      }).then(_ => {
        setTimeout(() => {
          self.quit()
        }, 100)
      })
    }
  }

  async resolveDownloadEngineBackend (browserWindow) {
    const parent =
      browserWindow && !browserWindow.isDestroyed()
        ? browserWindow
        : undefined

    const { platform, arch } = process
    const goBin = getEngineBinPathByBackend(
      platform,
      arch,
      ENGINE_BACKEND.GO_ARIA2
    )
    const ariaBin = getEngineBinPathByBackend(
      platform,
      arch,
      ENGINE_BACKEND.ARIA2
    )
    const hasGo = existsSync(goBin)
    const hasAria = existsSync(ariaBin)

    if (!hasGo && !hasAria) {
      throw new Error(this.i18n.t('app.engine-missing-message'))
    }

    const legacySession = getSessionPath()
    let legacyHasData = false
    if (existsSync(legacySession)) {
      try {
        legacyHasData = statSync(legacySession).size > 0
      } catch {
        legacyHasData = false
      }
    }
    const goSessionJson = getGoAria2SessionJsonPath()
    let goSessionEmpty = true
    if (existsSync(goSessionJson)) {
      try {
        goSessionEmpty = statSync(goSessionJson).size === 0
      } catch {
        goSessionEmpty = false
      }
    }

    const needDualPrompt =
      legacyHasData && goSessionEmpty && hasGo && hasAria
    const needMigrateOnlyPrompt =
      legacyHasData && goSessionEmpty && hasGo && !hasAria

    let stored = this.configManager.getUserConfig('download-engine')
    const dualPromptDone = this.configManager.getUserConfig(
      'download-engine-dual-prompt-done'
    )
    const skipLegacyImport = this.configManager.getUserConfig(
      'go-aria2-skip-legacy-import'
    )

    if (stored === ENGINE_BACKEND.GO_ARIA2 || stored === ENGINE_BACKEND.ARIA2) {
      if (stored === ENGINE_BACKEND.GO_ARIA2 && !hasGo) {
        if (!hasAria) {
          throw new Error(this.i18n.t('app.engine-missing-message'))
        }
        this.configManager.setUserConfig('download-engine', ENGINE_BACKEND.ARIA2)
        stored = ENGINE_BACKEND.ARIA2
      } else if (stored === ENGINE_BACKEND.ARIA2 && !hasAria) {
        if (!hasGo) {
          throw new Error(this.i18n.t('app.engine-missing-message'))
        }
        this.configManager.setUserConfig('download-engine', ENGINE_BACKEND.GO_ARIA2)
        stored = ENGINE_BACKEND.GO_ARIA2
      }
    }

    const needUserMigrationPrompt =
      (needDualPrompt && !dualPromptDone) ||
      (needMigrateOnlyPrompt && !skipLegacyImport)

    if (
      (stored === ENGINE_BACKEND.GO_ARIA2 || stored === ENGINE_BACKEND.ARIA2) &&
      !needUserMigrationPrompt
    ) {
      logger.info(
        '[imFile] 使用已保存 download-engine=%s（无待处理迁移询问）',
        stored
      )
      return stored
    }

    logger.info('[imFile] 引擎迁移弹窗条件', {
      goBin,
      ariaBin,
      hasGo,
      hasAria,
      legacyHasData,
      goSessionEmpty,
      'download-engine(已存)': stored,
      needDualPrompt,
      needMigrateOnlyPrompt,
      dualPromptDone,
      skipLegacyImport,
      needUserMigrationPrompt
    })

    if (needDualPrompt && !dualPromptDone) {
      const { response } = await dialog.showMessageBox(parent, {
        type: 'question',
        buttons: [
          this.i18n.t('app.engine-upgrade-confirm'),
          this.i18n.t('app.engine-upgrade-use-legacy')
        ],
        defaultId: 0,
        cancelId: 1,
        title: this.i18n.t('app.engine-upgrade-title'),
        message: this.i18n.t('app.engine-upgrade-message'),
        detail: this.i18n.t('app.engine-upgrade-detail')
      })
      const choice =
        response === 0 ? ENGINE_BACKEND.GO_ARIA2 : ENGINE_BACKEND.ARIA2
      this.configManager.setUserConfig('download-engine', choice)
      this.configManager.setUserConfig('download-engine-dual-prompt-done', true)
      if (response === 0) {
        this.configManager.setUserConfig('go-aria2-skip-legacy-import', false)
        this._pendingLegacySessionMigrate = true
      } else {
        this._pendingLegacySessionMigrate = false
      }
      return choice
    }

    if (needMigrateOnlyPrompt && !skipLegacyImport) {
      const { response } = await dialog.showMessageBox(parent, {
        type: 'question',
        buttons: [
          this.i18n.t('app.engine-migrate-import-confirm'),
          this.i18n.t('app.engine-migrate-import-skip')
        ],
        defaultId: 0,
        cancelId: 1,
        title: this.i18n.t('app.engine-migrate-import-title'),
        message: this.i18n.t('app.engine-migrate-import-message'),
        detail: this.i18n.t('app.engine-migrate-import-detail')
      })
      this.configManager.setUserConfig('download-engine', ENGINE_BACKEND.GO_ARIA2)
      if (response === 0) {
        this.configManager.setUserConfig('go-aria2-skip-legacy-import', false)
        this._pendingLegacySessionMigrate = true
      } else {
        this.configManager.setUserConfig('go-aria2-skip-legacy-import', true)
        this._pendingLegacySessionMigrate = false
      }
      return ENGINE_BACKEND.GO_ARIA2
    }

    const choice = hasGo ? ENGINE_BACKEND.GO_ARIA2 : ENGINE_BACKEND.ARIA2
    this.configManager.setUserConfig('download-engine', choice)
    return choice
  }

  /**
   * 停止当前引擎进程（切换前使用，确保 kill 与 RPC 关闭完成后再起新进程）。
   */
  async hardStopEngineForSwitch () {
    if (!this.engine) {
      return
    }
    try {
      await this.engineClient.shutdown({ force: true })
    } catch (err) {
      logger.warn('[imFile] hardStopEngineForSwitch shutdown:', err.message)
    }
    if (this.engine) {
      this.engine.stop()
      this.engine = null
    }
    await new Promise((resolve) => setTimeout(resolve, 450))
  }

  /**
   * 偏好设置中切换下载引擎：停旧进程 → 按需迁移 → 启动新进程。
   * @param {'go-aria2'|'aria2'} backend
   * @param {import('electron').BrowserWindow | null} browserWindow
   */
  async switchDownloadEngine (backend, browserWindow = null) {
    if (
      backend !== ENGINE_BACKEND.GO_ARIA2 &&
      backend !== ENGINE_BACKEND.ARIA2
    ) {
      return { ok: false, error: this.i18n.t('app.engine-switch-invalid') }
    }

    const { platform, arch } = process
    const goBin = getEngineBinPathByBackend(
      platform,
      arch,
      ENGINE_BACKEND.GO_ARIA2
    )
    const ariaBin = getEngineBinPathByBackend(
      platform,
      arch,
      ENGINE_BACKEND.ARIA2
    )
    const hasGo = existsSync(goBin)
    const hasAria = existsSync(ariaBin)

    if (backend === ENGINE_BACKEND.GO_ARIA2 && !hasGo) {
      return {
        ok: false,
        error: this.i18n.t('app.engine-switch-missing-go-aria2')
      }
    }
    if (backend === ENGINE_BACKEND.ARIA2 && !hasAria) {
      return {
        ok: false,
        error: this.i18n.t('app.engine-switch-missing-aria2c')
      }
    }

    const current = this.configManager.getUserConfig('download-engine')
    if (current === backend) {
      return { ok: true, noop: true }
    }

    const parent =
      browserWindow && !browserWindow.isDestroyed()
        ? browserWindow
        : this.windowManager.getWindow('index')

    await this.hardStopEngineForSwitch()

    this.configManager.setUserConfig('download-engine', backend)
    this.configManager.setUserConfig('download-engine-dual-prompt-done', true)
    this.configManager.setUserConfig('go-aria2-skip-legacy-import', false)

    if (
      backend === ENGINE_BACKEND.GO_ARIA2 &&
      Engine.shouldRunMigrateFromAria2()
    ) {
      let overlayWin = null
      try {
        overlayWin = await showEngineBootstrapOverlay(
          parent,
          this.i18n.t('app.engine-migrating-message')
        )
        await new Promise((resolve) => setImmediate(resolve))
        Engine.runMigrateFromAria2Session(
          goBin,
          this.configManager.getSystemConfig()
        )
      } finally {
        closeEngineBootstrapOverlay(overlayWin)
      }
    }

    this.engine = new Engine({
      systemConfig: this.configManager.getSystemConfig(),
      userConfig: this.configManager.getUserConfig(),
      engineBackend: backend
    })
    const binPath = this.engine.getEngineBinPath()
    this.context.set('engine-bin-path', binPath)
    this.context.set('aria2-bin-path', binPath)
    this.engine.start()
    return { ok: true }
  }

  async stopEngine () {
    logger.info('[imFile] stopEngine===>')
    if (!this.engine) {
      return
    }
    try {
      await this.engineClient.shutdown({ force: true })
      logger.info('[imFile] stopEngine.setImmediate===>')
      setImmediate(() => {
        this.engine.stop()
      })
    } catch (err) {
      logger.warn('[imFile] shutdown engine fail: ', err.message)
    } finally {
      // no finally
    }
  }

  startGoed2kd () {
    this.updateGoed2kdStatus({
      started: false,
      healthy: false,
      pid: null,
      lastError: '',
      updatedAt: Date.now()
    })

    try {
      this.goed2kdEngine = new Goed2kdEngine()
      this.goed2kdClient = new Goed2kdClient({
        getRuntimeOptions: () => this.goed2kdEngine.getRuntimeOptions()
      })
      this.updateGoed2kdStatus({
        started: true,
        healthy: false,
        pid: this.goed2kdEngine.instance ? this.goed2kdEngine.instance.pid : null,
        lastError: '',
        updatedAt: Date.now()
      })
      this.goed2kdEngine.start().then((healthy) => {
        this.updateGoed2kdStatus({
          started: Boolean(this.goed2kdEngine && this.goed2kdEngine.instance),
          healthy,
          pid: this.goed2kdEngine && this.goed2kdEngine.instance
            ? this.goed2kdEngine.instance.pid
            : null,
          lastError: healthy ? '' : 'health check failed',
          updatedAt: Date.now()
        })
        logger.info('[imFile] goed2kd health status:', healthy)
        if (healthy && this.configManager.getUserConfig('enable-upnp')) {
          this.startGoed2kdUpnpMapping().catch((e) => {
            logger.warn('[imFile] goed2kd UPnP mapping:', e?.message ?? e)
          })
        }
      }).catch((err) => {
        this.updateGoed2kdStatus({
          started: false,
          healthy: false,
          pid: null,
          lastError: err.message,
          updatedAt: Date.now()
        })
        logger.warn('[imFile] start goed2kd failed:', err.message)
      })
    } catch (err) {
      this.updateGoed2kdStatus({
        started: false,
        healthy: false,
        pid: null,
        lastError: err.message,
        updatedAt: Date.now()
      })
      logger.warn('[imFile] init goed2kd failed:', err.message)
    }
  }

  async stopGoed2kd () {
    try {
      if (this.goed2kdEngine) {
        this.goed2kdEngine.stop()
      }
      this.updateGoed2kdStatus({
        started: false,
        healthy: false,
        pid: null,
        updatedAt: Date.now()
      })
    } catch (err) {
      this.updateGoed2kdStatus({
        started: false,
        healthy: false,
        pid: null,
        lastError: err.message,
        updatedAt: Date.now()
      })
      logger.warn('[imFile] stop goed2kd fail:', err.message)
    }
  }

  updateGoed2kdStatus (patch = {}) {
    this.goed2kdStatus = {
      started: false,
      healthy: false,
      pid: null,
      lastError: '',
      updatedAt: 0,
      ...(this.goed2kdStatus || {}),
      ...patch
    }
    this.broadcastGoed2kdStatus()
  }

  broadcastGoed2kdStatus () {
    const win = this.windowManager.getWindow('index')
    if (!win || win.isDestroyed()) {
      return
    }
    this.windowManager.sendMessageTo(win, 'goed2kd-status-changed')
  }

  initEngineClient () {
    const port = this.configManager.getSystemConfig('rpc-listen-port')
    const secret = this.configManager.getSystemConfig('rpc-secret')
    this.engineClient = new EngineClient({
      port,
      secret
    })
  }

  initAutoLaunchManager () {
    this.autoLaunchManager = new AutoLaunchManager()
  }

  initEnergyManager () {
    this.energyManager = new EnergyManager()
  }

  initTrayManager () {
    this.trayManager = new TrayManager({
      theme: this.configManager.getUserConfig('tray-theme'),
      systemTheme: this.themeManager.getSystemTheme(),
      speedometer: this.configManager.getUserConfig('tray-speedometer'),
      runMode: this.configManager.getUserConfig('run-mode')
    })

    this.watchTraySpeedometerEnabledChange()

    this.trayManager.on('mouse-down', ({ focused }) => {
      this.sendCommandToAll('application:update-tray-focused', { focused })
    })

    this.trayManager.on('mouse-up', ({ focused }) => {
      this.sendCommandToAll('application:update-tray-focused', { focused })
    })

    this.trayManager.on('drop-files', (files = []) => {
      this.handleFile(files[0])
    })

    this.trayManager.on('drop-text', (text) => {
      this.handleProtocol(text)
    })
  }

  watchTraySpeedometerEnabledChange () {
    const { userConfig } = this.configManager
    const key = 'tray-speedometer'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      this.trayManager.handleSpeedometerEnableChange(newValue)
    })
  }

  initDockManager () {
    this.dockManager = new DockManager({
      runMode: this.configManager.getUserConfig('run-mode')
    })
  }

  watchOpenAtLoginChange () {
    const { userConfig } = this.configManager
    const key = 'open-at-login'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      if (is.linux()) {
        return
      }

      if (newValue) {
        this.autoLaunchManager.enable()
      } else {
        this.autoLaunchManager.disable()
      }
    })
  }

  watchProtocolsChange () {
    const { userConfig } = this.configManager
    const key = 'protocols'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)

      if (!newValue || isEqual(newValue, oldValue)) {
        return
      }

      logger.info('[imFile] setup protocols client:', newValue)
      this.protocolManager.setup(newValue)
    })
  }

  watchRunModeChange () {
    const { userConfig } = this.configManager
    const key = 'run-mode'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      this.trayManager.handleRunModeChange(newValue)

      if (newValue !== APP_RUN_MODE.TRAY) {
        this.dockManager.show()
      } else {
        this.dockManager.hide()
        // Hiding the dock icon will trigger the entire app to hide.
        this.show()
      }
    })
  }

  watchProxyChange () {
    const { userConfig } = this.configManager
    const key = 'proxy'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      // this.updateManager.setupProxy(newValue)

      const { enable, server, bypass, scope = [] } = newValue
      const system = enable && server && scope.includes(PROXY_SCOPES.DOWNLOAD)
        ? {
            'all-proxy': server,
            'no-proxy': bypass
          }
        : {}
      this.configManager.setSystemConfig(system)
      this.engineClient.call('changeGlobalOption', system)
    })
  }

  watchLocaleChange () {
    const { userConfig } = this.configManager
    const key = 'locale'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      this.localeManager.changeLanguageByLocale(newValue)
        .then(() => {
          this.menuManager.handleLocaleChange(newValue)
          this.trayManager.handleLocaleChange(newValue)
        })
      this.sendCommandToAll('application:update-locale', { locale: newValue })
    })
  }

  watchThemeChange () {
    const { userConfig } = this.configManager
    const key = 'theme'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)
      this.themeManager.updateSystemTheme(newValue)
      this.sendCommandToAll('application:update-theme', { theme: newValue })
    })
  }

  watchShowProgressBarChange () {
    const { userConfig } = this.configManager
    const key = 'show-progress-bar'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info(`[imFile] detected ${key} value change event:`, newValue, oldValue)

      if (newValue) {
        this.bindProgressChange()
      } else {
        this.unbindProgressChange()
      }
    })
  }

  initUPnPManager () {
    this.upnp = new UPnPManager()

    this.watchUPnPEnabledChange()

    this.watchUPnPPortsChange()

    const enabled = this.configManager.getUserConfig('enable-upnp')
    if (!enabled) {
      this.broadcastUpnpStatus()
      return
    }

    /** aria2 的 BT/DHT 端口映射：与原先一致，在 init 阶段即尝试映射 */
    this.startAria2UpnpMapping().catch((e) => {
      logger.warn('[imFile] start aria2 UPnP mapping fail:', e?.message ?? e)
    })
  }

  getGoed2kdPortsForUpnp () {
    try {
      if (this.goed2kdEngine) {
        const o = this.goed2kdEngine.getRuntimeOptions()
        return { listenPort: o.listenPort, udpPort: o.udpPort }
      }
    } catch (err) {
      logger.warn('[imFile] getGoed2kdPortsForUpnp:', err.message)
    }
    return readGoed2kdEnginePortsFromConfigSync()
  }

  collectAria2UpnpPorts () {
    const btPort = this.configManager.getSystemConfig('listen-port')
    const dhtPort = this.configManager.getSystemConfig('dht-listen-port')
    return [...new Set(
      [btPort, dhtPort]
        .filter((p) => p != null && p !== '' && !Number.isNaN(Number(p)))
        .map((p) => Number(p))
    )]
  }

  collectGoed2kdUpnpPorts () {
    const { listenPort: ed2kTcp, udpPort: ed2kUdp } = this.getGoed2kdPortsForUpnp()
    return [...new Set(
      [ed2kTcp, ed2kUdp]
        .filter((p) => p != null && p !== '' && !Number.isNaN(Number(p)))
        .map((p) => Number(p))
    )]
  }

  /** 关闭 UPnP 或退出时，解除 aria2 + goed2k 相关端口映射 */
  collectUpnpPorts () {
    return [...new Set([
      ...this.collectAria2UpnpPorts(),
      ...this.collectGoed2kdUpnpPorts()
    ])]
  }

  async startAria2UpnpMapping () {
    const ports = this.collectAria2UpnpPorts()
    const promises = ports.map((p) => this.upnp.map(p))
    try {
      await Promise.allSettled(promises)
    } catch (e) {
      logger.warn('[imFile] start aria2 UPnP mapping fail', e.message)
    } finally {
      this.broadcastUpnpStatus()
    }
  }

  /** 仅在 goed2kd 进程已启动且健康检查通过后调用 */
  async startGoed2kdUpnpMapping () {
    const ports = this.collectGoed2kdUpnpPorts()
    const promises = ports.map((p) => this.upnp.map(p))
    try {
      await Promise.allSettled(promises)
    } catch (e) {
      logger.warn('[imFile] start goed2kd UPnP mapping fail', e.message)
    } finally {
      this.broadcastUpnpStatus()
    }
  }

  async stopUPnPMapping () {
    const ports = this.collectUpnpPorts()
    const promises = ports.map((p) => this.upnp.unmap(p))
    try {
      await Promise.allSettled(promises)
    } catch (e) {
      logger.warn('[imFile] stop UPnP mapping fail', e)
    } finally {
      this.broadcastUpnpStatus()
    }
  }

  watchUPnPPortsChange () {
    const { systemConfig } = this.configManager
    const watchKeys = ['listen-port', 'dht-listen-port']

    watchKeys.forEach((key) => {
      this.configListeners[key] = systemConfig.onDidChange(key, async (newValue, oldValue) => {
        logger.info('[imFile] detected port change event:', key, newValue, oldValue)
        const enable = this.configManager.getUserConfig('enable-upnp')
        if (!enable) {
          return
        }

        const promises = [
          this.upnp.unmap(oldValue),
          this.upnp.map(newValue)
        ]
        try {
          await Promise.allSettled(promises)
        } catch (e) {
          logger.info('[imFile] change UPnP port mapping failed:', e)
        } finally {
          this.broadcastUpnpStatus()
        }
      })
    })
  }

  watchUPnPEnabledChange () {
    const { userConfig } = this.configManager
    const key = 'enable-upnp'
    this.configListeners[key] = userConfig.onDidChange(key, async (newValue, oldValue) => {
      logger.info('[imFile] detected enable-upnp value change event:', newValue, oldValue)
      if (newValue) {
        await this.startAria2UpnpMapping()
        if (this.goed2kdEngine && this.goed2kdEngine.healthy) {
          await this.startGoed2kdUpnpMapping()
        }
      } else {
        await this.stopUPnPMapping()
        await this.upnp.closeClient()
        this.broadcastUpnpStatus()
      }
    })
  }

  getUpnpStatus () {
    const enabled = !!this.configManager.getUserConfig('enable-upnp')
    const btPort = this.configManager.getSystemConfig('listen-port')
    const dhtPort = this.configManager.getSystemConfig('dht-listen-port')
    const { listenPort: ed2kTcpPort, udpPort: ed2kUdpPort } =
      this.getGoed2kdPortsForUpnp()
    if (!this.upnp) {
      return {
        enabled,
        btPort,
        dhtPort,
        btMapped: false,
        dhtMapped: false,
        ed2kTcpPort,
        ed2kUdpPort,
        ed2kTcpMapped: false,
        ed2kUdpMapped: false
      }
    }
    const {
      btMapped,
      dhtMapped,
      ed2kTcpMapped,
      ed2kUdpMapped
    } = this.upnp.getPortMappingStatus(
      btPort,
      dhtPort,
      ed2kTcpPort,
      ed2kUdpPort
    )
    return {
      enabled,
      btPort,
      dhtPort,
      btMapped,
      dhtMapped,
      ed2kTcpPort,
      ed2kUdpPort,
      ed2kTcpMapped,
      ed2kUdpMapped
    }
  }

  broadcastUpnpStatus () {
    const win = this.windowManager.getWindow('index')
    if (!win || win.isDestroyed()) {
      return
    }
    this.windowManager.sendMessageTo(win, 'upnp-status-changed')
  }

  async shutdownUPnPManager () {
    const enable = this.configManager.getUserConfig('enable-upnp')
    if (enable) {
      await this.stopUPnPMapping()
    }

    await this.upnp.closeClient()
  }

  syncTrackers (source, proxy) {
    if (isEmpty(source)) {
      return
    }

    setTimeout(() => {
      fetchBtTrackerFromSource(source, proxy).then((data) => {
        logger.warn('[imFile] auto sync tracker data:', data)
        if (!data || data.length === 0) {
          return
        }

        let tracker = convertTrackerDataToComma(data)
        tracker = reduceTrackerString(tracker)
        this.savePreference({
          system: {
            'bt-tracker': tracker
          },
          user: {
            'last-sync-tracker-time': Date.now()
          }
        })
      }).catch((err) => {
        logger.warn('[imFile] auto sync tracker failed:', err.message)
      })
    }, 500)
  }

  autoSyncTrackers () {
    const enable = this.configManager.getUserConfig('auto-sync-tracker')
    const lastTime = this.configManager.getUserConfig('last-sync-tracker-time')
    const result = checkIsNeedRun(enable, lastTime, AUTO_SYNC_TRACKER_INTERVAL)
    logger.info('[imFile] auto sync tracker checkIsNeedRun:', result)
    if (!result) {
      return
    }

    const source = this.configManager.getUserConfig('tracker-source')
    const proxy = this.configManager.getUserConfig('proxy', { enable: false })

    this.syncTrackers(source, proxy)
  }

  autoResumeTask () {
    const enabled = this.configManager.getUserConfig('resume-all-when-app-launched')
    if (!enabled) {
      return
    }

    this.engineClient.call('unpauseAll')
  }

  initWindowManager () {
    this.windowManager = new WindowManager({
      userConfig: this.configManager.getUserConfig()
    })

    this.windowManager.on('window-resized', (data) => {
      this.storeWindowState(data)
    })

    this.windowManager.on('window-moved', (data) => {
      this.storeWindowState(data)
    })

    this.windowManager.on('window-closed', (data) => {
      this.storeWindowState(data)
    })

    this.windowManager.on('enter-full-screen', (window) => {
      this.dockManager.show()
    })

    this.windowManager.on('leave-full-screen', (window) => {
      const mode = this.configManager.getUserConfig('run-mode')
      if (mode === APP_RUN_MODE.TRAY) {
        this.dockManager.hide()
      }
    })
  }

  storeWindowState (data = {}) {
    const enabled = this.configManager.getUserConfig('keep-window-state')
    if (!enabled) {
      return
    }

    const state = this.configManager.getUserConfig('window-state', {})
    const { page, bounds } = data
    const newState = {
      ...state,
      [page]: bounds
    }
    this.configManager.setUserConfig('window-state', newState)
  }

  start (page, options = {}) {
    const win = this.showPage(page, options)

    this.bootstrapDownloadEngine(win).catch((err) => {
      logger.warn(
        '[imFile] bootstrapDownloadEngine unexpected:',
        err?.message ?? err
      )
    })

    win.once('ready-to-show', () => {
      this.isReady = true
      this.emit('ready')
    })

    if (is.macOS()) {
      this.touchBarManager.setup(page, win)
    }
  }

  showPage (page, options = {}) {
    const { openedAtLogin } = options
    const autoHideWindow = this.configManager.getUserConfig('auto-hide-window')
    return this.windowManager.openWindow(page, {
      hidden: openedAtLogin || autoHideWindow
    })
  }

  show (page = 'index') {
    this.windowManager.showWindow(page)
  }

  hide (page) {
    if (page) {
      this.windowManager.hideWindow(page)
    } else {
      this.windowManager.hideAllWindow()
    }
  }

  toggle (page = 'index') {
    this.windowManager.toggleWindow(page)
  }

  closePage (page) {
    this.windowManager.destroyWindow(page)
  }

  stop () {
    try {
      const promises = [
        this.stopEngine(),
        this.stopGoed2kd(),
        this.shutdownUPnPManager(),
        this.energyManager.stopPowerSaveBlocker(),
        this.trayManager.destroy()
      ]

      return promises
    } catch (err) {
      logger.warn('[imFile] stop error: ', err.message)
    }
  }

  async stopAllSettled () {
    await Promise.allSettled(this.stop())
  }

  async quit () {
    await this.stopAllSettled()
    app.exit()
  }

  /**
   * 全部下载完成后的会话动作（关机 / 睡眠 / 退出）。
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async handlePostDownloadAction (action) {
    if (!action || action === POST_DOWNLOAD_ACTION.NONE) {
      return { ok: true }
    }

    logger.log('[imFile] post-download action:', action)

    if (action === POST_DOWNLOAD_ACTION.QUIT) {
      try {
        await this.quit()
        return { ok: true }
      } catch (err) {
        logger.warn('[imFile] post-download quit failed:', err?.message ?? err)
        return { ok: false, error: err?.message || String(err) }
      }
    }

    const spawnOpts = { detached: true, stdio: 'ignore' }
    if (is.windows()) {
      spawnOpts.windowsHide = true
    }

    let cmd
    let args

    if (action === POST_DOWNLOAD_ACTION.SLEEP) {
      if (is.macos()) {
        cmd = 'pmset'
        args = ['sleepnow']
      } else if (is.windows()) {
        cmd = 'cmd.exe'
        args = ['/c', 'rundll32 powrprof.dll,SetSuspendState 0,1,0']
      } else {
        cmd = 'systemctl'
        args = ['suspend']
      }
    } else if (action === POST_DOWNLOAD_ACTION.SHUTDOWN) {
      if (is.macos()) {
        cmd = 'osascript'
        args = ['-e', 'tell application "System Events" to shut down']
      } else if (is.windows()) {
        cmd = 'shutdown.exe'
        args = ['/s', '/t', '0']
      } else {
        cmd = 'systemctl'
        args = ['poweroff']
      }
    } else {
      return { ok: true }
    }

    return await new Promise((resolve) => {
      let settled = false
      let timer

      const finish = (ok, err) => {
        if (settled) {
          return
        }
        settled = true
        if (timer) {
          clearTimeout(timer)
        }
        if (ok) {
          resolve({ ok: true })
        } else {
          resolve({ ok: false, error: err })
        }
      }

      try {
        const child = spawn(cmd, args, spawnOpts)
        child.on('error', (err) => {
          logger.warn('[imFile] post-download spawn error:', err)
          finish(false, err.message)
        })
        child.on('exit', (code) => {
          if (code === 0 || code === null) {
            finish(true)
          } else {
            logger.warn('[imFile] post-download exit code:', code)
            finish(false, `exit ${code}`)
          }
        })
        child.unref()
        timer = setTimeout(() => finish(true), 2000)
      } catch (err) {
        finish(false, err.message)
      }
    })
  }

  sendCommand (command, ...args) {
    if (!this.emit(command, ...args)) {
      const window = this.windowManager.getFocusedWindow()
      if (window) {
        this.windowManager.sendCommandTo(window, command, ...args)
      }
    }
  }

  sendCommandToAll (command, ...args) {
    if (!this.emit(command, ...args)) {
      this.windowManager.getWindowList().forEach(window => {
        this.windowManager.sendCommandTo(window, command, ...args)
      })
    }
  }

  sendMessageToAll (channel, ...args) {
    this.windowManager.getWindowList().forEach(window => {
      this.windowManager.sendMessageTo(window, channel, ...args)
    })
  }

  initThemeManager () {
    this.themeManager = new ThemeManager()
    this.themeManager.on('system-theme-change', (theme) => {
      this.trayManager.handleSystemThemeChange(theme)
      this.sendCommandToAll('application:update-system-theme', { theme })
    })
  }

  initTouchBarManager () {
    if (!is.macOS()) {
      return
    }

    this.touchBarManager = new TouchBarManager()
  }

  initProtocolManager () {
    const protocols = this.configManager.getUserConfig('protocols', {})
    this.protocolManager = new ProtocolManager({
      protocols
    })
  }

  handleProtocol (url) {
    this.show()

    this.protocolManager.handle(url)
  }

  handleFile (filePath) {
    if (!filePath) {
      return
    }

    if (extname(filePath).toLowerCase() !== '.torrent') {
      return
    }

    this.show()

    const name = basename(filePath)
    readFile(filePath, (err, data) => {
      if (err) {
        logger.warn(`[imFile] read file error: ${filePath}`, err.message)
        return
      }
      const dataURL = Buffer.from(data).toString('base64')
      this.sendCommandToAll('application:new-bt-task-with-file', {
        name,
        dataURL
      })
    })
  }

  initUpdaterManager () {
    if (is.mas()) {
      return
    }
    const enabled = this.configManager.getUserConfig('auto-check-update')
    const proxy = this.configManager.getSystemConfig('all-proxy')
    const lastTime = this.configManager.getUserConfig('last-check-update-time')
    const autoCheck = checkIsNeedRun(enabled, lastTime, AUTO_CHECK_UPDATE_INTERVAL)
    this.updateManager = new UpdateManager({
      autoCheck,
      proxy
    })
    this.handleUpdaterEvents()
  }

  handleUpdaterEvents () {
    this.updateManager.on('checking', (event) => {
      this.menuManager.updateMenuItemEnabledState('app.check-for-updates', false)
      this.trayManager.updateMenuItemEnabledState('app.check-for-updates', false)
      this.configManager.setUserConfig('last-check-update-time', Date.now())
    })

    this.updateManager.on('download-progress', (event) => {
      const win = this.windowManager.getWindow('index')
      win.setProgressBar(event.percent / 100)
    })

    this.updateManager.on('update-not-available', (event) => {
      this.menuManager.updateMenuItemEnabledState('app.check-for-updates', true)
      this.trayManager.updateMenuItemEnabledState('app.check-for-updates', true)
    })

    this.updateManager.on('update-downloaded', (event) => {
      this.menuManager.updateMenuItemEnabledState('app.check-for-updates', true)
      this.trayManager.updateMenuItemEnabledState('app.check-for-updates', true)
      const win = this.windowManager.getWindow('index')
      win.setProgressBar(1)
    })

    this.updateManager.on('update-cancelled', (event) => {
      this.menuManager.updateMenuItemEnabledState('app.check-for-updates', true)
      this.trayManager.updateMenuItemEnabledState('app.check-for-updates', true)
      const win = this.windowManager.getWindow('index')
      win.setProgressBar(-1)
    })

    this.updateManager.on('will-updated', async (event) => {
      this.windowManager.setWillQuit(true)
      await this.stopAllSettled()
    })

    this.updateManager.on('update-error', (event) => {
      this.menuManager.updateMenuItemEnabledState('app.check-for-updates', true)
      this.trayManager.updateMenuItemEnabledState('app.check-for-updates', true)
    })
  }

  async relaunch () {
    await this.stopAllSettled()
    app.relaunch()
    app.exit()
  }

  async resetSession () {
    await this.stopEngine()

    app.clearRecentDocuments()

    const sessionPath = this.context.get('session-path')
    const goAria2SessionPath = this.context.get('go-aria2-session-path')
    setTimeout(() => {
      unlink(sessionPath, (err) => {
        logger.info('[imFile] Removed the download seesion file:', err)
      })
      if (goAria2SessionPath) {
        unlink(goAria2SessionPath, (err) => {
          logger.info('[imFile] Removed go-aria2 session file:', err)
        })
      }

      if (this.engine) {
        this.engine.start()
      }
    }, 3000)
  }

  savePreference (config = {}) {
    logger.info('[imFile] save preference:', config)
    const { system, user } = config
    if (!isEmpty(system)) {
      console.info('[imFile] main save system config: ', system)
      this.configManager.setSystemConfig(system)
      this.engineClient.changeGlobalOption(system)
    }

    if (!isEmpty(user)) {
      console.info('[imFile] main save user config: ', user)
      this.configManager.setUserConfig(user)
    }
  }

  handleCommands () {
    this.on('application:save-preference', this.savePreference)

    this.on('application:update-tray', (tray) => {
      this.trayManager.updateTrayByImage(tray)
    })

    this.on('application:relaunch', () => {
      this.relaunch()
    })

    this.on('application:quit', () => {
      this.quit()
    })

    this.on('application:show', ({ page }) => {
      this.show(page)
    })

    this.on('application:hide', ({ page }) => {
      this.hide(page)
    })

    this.on('application:reset-session', () => this.resetSession())

    this.on('application:factory-reset', () => {
      this.offConfigListeners()
      this.configManager.reset()
      this.relaunch()
    })

    this.on('application:check-for-updates', () => {
      if (!this.updateManager) {
        return
      }
      this.updateManager.check()
    })

    this.on('application:change-theme', (theme) => {
      this.themeManager.updateSystemTheme(theme)
      this.sendCommandToAll('application:update-theme', { theme })
    })

    this.on('application:change-locale', (locale) => {
      this.localeManager.changeLanguageByLocale(locale)
        .then(() => {
          this.menuManager.handleLocaleChange(locale)
          this.trayManager.handleLocaleChange(locale)
        })
    })

    this.on('application:toggle-dock', (visible) => {
      if (visible) {
        this.dockManager.show()
      } else {
        this.dockManager.hide()
        // Hiding the dock icon will trigger the entire app to hide.
        this.show()
      }
    })

    this.on('application:auto-hide-window', (hide) => {
      if (hide) {
        this.windowManager.handleWindowBlur()
      } else {
        this.windowManager.unbindWindowBlur()
      }
    })

    this.on('application:change-menu-states', (visibleStates, enabledStates, checkedStates) => {
      this.menuManager.updateMenuStates(visibleStates, enabledStates, checkedStates)
      this.trayManager.updateMenuStates(visibleStates, enabledStates, checkedStates)
    })

    this.on('application:open-file', (event) => {
      dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          {
            name: 'Torrent',
            extensions: ['torrent']
          }
        ]
      }).then(({ canceled, filePaths }) => {
        if (canceled || filePaths.length === 0) {
          return
        }

        const [filePath] = filePaths
        this.handleFile(filePath)
      })
    })

    this.on('application:clear-recent-tasks', () => {
      app.clearRecentDocuments()
    })

    this.on('application:setup-protocols-client', (protocols) => {
      if (is.dev() || is.mas() || !protocols) {
        return
      }
      logger.info('[imFile] setup protocols client:', protocols)
      this.protocolManager.setup(protocols)
    })

    this.on('application:open-external', (url) => {
      this.openExternal(url)
    })

    this.on('application:reveal-in-folder', (data) => {
      const { gid, path } = data
      logger.info('[imFile] application:reveal-in-folder===>', path)
      if (path) {
        showItemInFolder(path)
      }
      if (gid) {
        this.sendCommandToAll('application:show-task-detail', { gid })
      }
    })

    this.on('help:official-website', () => {
      const url = 'https://imfile.org/'
      this.openExternal(url)
    })

    // this.on('help:manual', () => {
    //   const url = 'https://imfile.org/manual'
    //   this.openExternal(url)
    // })

    // this.on('help:release-notes', () => {
    //   const url = 'https://imfile.org/release'
    //   this.openExternal(url)
    // })

    // this.on('help:report-problem', () => {
    //   const url = 'https://imfile.org/report'
    //   this.openExternal(url)
    // })
  }

  openExternal (url) {
    if (!url) {
      return
    }

    shell.openExternal(url)
  }

  handleConfigChange (configName) {
    this.sendCommandToAll('application:update-preference-config', { configName })
  }

  handleEvents () {
    this.once('application:initialized', () => {
      this.autoSyncTrackers()

      this.autoResumeTask()

      this.adjustMenu()
    })

    this.configManager.userConfig.onDidAnyChange(() => this.handleConfigChange('user'))
    this.configManager.systemConfig.onDidAnyChange(() => this.handleConfigChange('system'))

    this.watchOpenAtLoginChange()
    this.watchProtocolsChange()
    this.watchRunModeChange()
    this.watchShowProgressBarChange()
    this.watchProxyChange()
    this.watchLocaleChange()
    this.watchThemeChange()

    this.on('download-status-change', (downloading) => {
      this.trayManager.handleDownloadStatusChange(downloading)
      if (downloading) {
        this.energyManager.startPowerSaveBlocker()
      } else {
        this.energyManager.stopPowerSaveBlocker()
      }
    })

    this.on('speed-change', (speed) => {
      this.dockManager.handleSpeedChange(speed)
      this.trayManager.handleSpeedChange(speed)
    })

    this.on('task-download-complete', (task, path) => {
      this.dockManager.openDock(path)

      if (is.linux()) {
        return
      }
      app.addRecentDocument(path)
    })

    if (this.configManager.userConfig.get('show-progress-bar')) {
      this.bindProgressChange()
    }
  }

  handleProgressChange (progress) {
    // if (this.updateManager.isChecking) {
    //   return
    // }
    if (!is.windows() && progress === 2) {
      progress = 0
    }
    this.windowManager.getWindow('index').setProgressBar(progress)
  }

  bindProgressChange () {
    if (this.listeners('progress-change').length > 0) {
      return
    }

    this.on('progress-change', this.handleProgressChange)
  }

  unbindProgressChange () {
    if (this.listeners('progress-change').length === 0) {
      return
    }

    this.off('progress-change', this.handleProgressChange)
    this.windowManager.getWindow('index').setProgressBar(-1)
  }

  handleIpcMessages () {
    ipcMain.on('command', (event, command, ...args) => {
      logger.log('[imFile] ipc receive command', command, ...args)
      this.emit(command, ...args)
    })

    ipcMain.on('event', (event, eventName, ...args) => {
      logger.log('[imFile] ipc receive event', eventName, ...args)
      this.emit(eventName, ...args)
    })
  }

  handleIpcInvokes () {
    ipcMain.handle('application:post-download-action', async (event, action) => {
      return this.handlePostDownloadAction(action)
    })

    ipcMain.handle('get-app-config', async () => {
      const systemConfig = this.configManager.getSystemConfig()
      const userConfig = this.configManager.getUserConfig()
      const context = this.context.get()

      const result = {
        ...systemConfig,
        ...userConfig,
        ...context
      }
      return result
    })

    ipcMain.handle('application:get-download-engine-info', async () => {
      const { platform, arch } = process
      const goBin = getEngineBinPathByBackend(
        platform,
        arch,
        ENGINE_BACKEND.GO_ARIA2
      )
      const ariaBin = getEngineBinPathByBackend(
        platform,
        arch,
        ENGINE_BACKEND.ARIA2
      )
      const canUseGoAria2 = existsSync(goBin)
      const canUseAria2c = existsSync(ariaBin)
      const current = this.configManager.getUserConfig('download-engine')
      const effective =
        current === ENGINE_BACKEND.GO_ARIA2 || current === ENGINE_BACKEND.ARIA2
          ? current
          : canUseGoAria2
            ? ENGINE_BACKEND.GO_ARIA2
            : ENGINE_BACKEND.ARIA2
      return {
        canUseGoAria2,
        canUseAria2c,
        current,
        effective
      }
    })

    ipcMain.handle('application:switch-download-engine', async (event, payload = {}) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      return this.switchDownloadEngine(payload.backend, win)
    })

    ipcMain.handle('get-goed2kd-status', async () => {
      const merged = {
        started: false,
        healthy: false,
        pid: null,
        lastError: '',
        updatedAt: 0,
        rpcPort: null,
        ed2kTcpPort: null,
        ed2kUdpPort: null,
        kadLiveNodes: null,
        ...(this.goed2kdStatus || {})
      }
      try {
        if (this.goed2kdEngine) {
          const o = this.goed2kdEngine.getRuntimeOptions()
          merged.rpcPort = o.port
          merged.ed2kTcpPort = o.listenPort
          merged.ed2kUdpPort = o.udpPort
        }
      } catch (err) {
        // ignore
      }
      try {
        if (
          this.goed2kdClient &&
          this.goed2kdEngine &&
          this.goed2kdEngine.healthy
        ) {
          const dht = await this.goed2kdClient.getNetworkDht()
          const n = dht && dht.live_nodes
          if (n != null && !Number.isNaN(Number(n))) {
            merged.kadLiveNodes = Number(n)
          }
        }
      } catch (err) {
        // ignore
      }
      return merged
    })

    ipcMain.handle('get-upnp-status', async () => {
      return this.getUpnpStatus()
    })

    ipcMain.handle('goed2kd:add-ed2k', async (event, payload = {}) => {
      try {
        const link = payload.ed2k || payload.link || ''
        const data = await this.goed2kdClient.addEd2k(link)
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd add failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:list-downloads', async () => {
      try {
        const data = await this.goed2kdClient.listTransfers()
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd list failed:', err.message)
        return { ok: false, message: err.message, data: [] }
      }
    })

    ipcMain.handle('goed2kd:pause-download', async (event, payload = {}) => {
      try {
        const data = await this.goed2kdClient.pauseTransfer(payload.hash)
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd pause failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:resume-download', async (event, payload = {}) => {
      try {
        const data = await this.goed2kdClient.resumeTransfer(payload.hash)
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd resume failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:remove-download', async (event, payload = {}) => {
      try {
        const data = await this.goed2kdClient.removeTransfer(payload.hash)
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd remove failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:search-start', async (event, payload = {}) => {
      try {
        const data = await this.goed2kdClient.startSearch(payload || {})
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd search start failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:search-current', async () => {
      try {
        const data = await this.goed2kdClient.getCurrentSearch()
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd search current failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:search-stop', async () => {
      try {
        const data = await this.goed2kdClient.stopSearch()
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd search stop failed:', err.message)
        return { ok: false, message: err.message }
      }
    })

    ipcMain.handle('goed2kd:search-download', async (event, payload = {}) => {
      try {
        const hash = payload.hash || ''
        const data = await this.goed2kdClient.downloadSearchResult(hash, payload.options || {})
        return { ok: true, data }
      } catch (err) {
        logger.warn('[imFile] goed2kd search download failed:', err.message)
        return { ok: false, message: err.message }
      }
    })
  }
}
