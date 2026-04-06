import { EventEmitter } from 'node:events'
import { dirname, resolve } from 'node:path'
import { app, dialog } from 'electron'
import is from 'electron-is'
import { autoUpdater } from 'electron-updater'

import { PROXY_SCOPES } from '@shared/constants'
import logger from './Logger'
import { getI18n } from '../ui/Locale'

if (is.dev()) {
  autoUpdater.updateConfigPath = resolve(__dirname, '../../../app-update.yml')
}

export default class UpdateManager extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options
    this.i18n = getI18n()
    this.isChecking = false
    this.updater = autoUpdater
    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = false
    this.updater.logger = logger
    logger.info('[imFile] setup proxy:', this.options.proxy)
    this.setupProxy(this.options.proxy)

    this.autoCheckData = {
      checkEnable: this.options.autoCheck,
      userCheck: false
    }
    this.init()
  }

  setupProxy (proxy) {
    const { enable, server, scope = [] } = proxy
    if (!enable || !server || !scope.includes(PROXY_SCOPES.UPDATE_APP)) {
      this.updater.netSession.setProxy({
        proxyRules: undefined
      })
      return
    }

    const url = new URL(server)
    const { username, password, protocol = 'http:', host, port } = url
    const proxyRules = `${protocol}//${host}`

    logger.info(`[imFile] setup proxy: ${proxyRules}`, username, password, protocol, host, port)
    this.updater.netSession.setProxy({
      proxyRules
    })

    if (server.includes('@')) {
      this.updater.signals.login((_authInfo, callback) => {
        callback(username, password)
      })
    }
  }

  init () {
    // Event: error
    // Event: checking-for-update
    // Event: update-available
    // Event: update-not-available
    // Event: download-progress
    // Event: update-downloaded

    this.updater.on('checking-for-update', this.checkingForUpdate.bind(this))
    this.updater.on('update-available', this.updateAvailable.bind(this))
    this.updater.on('update-not-available', this.updateNotAvailable.bind(this))
    this.updater.on('download-progress', this.updateDownloadProgress.bind(this))
    this.updater.on('update-downloaded', this.updateDownloaded.bind(this))
    this.updater.on('update-cancelled', this.updateCancelled.bind(this))
    this.updater.on('error', this.updateError.bind(this))

    if (this.autoCheckData.checkEnable && !this.isChecking) {
      this.autoCheckData.userCheck = false
      this.updater.checkForUpdates()
    }
  }

  check () {
    this.autoCheckData.userCheck = true
    this.updater.checkForUpdates()
  }

  checkingForUpdate () {
    this.isChecking = true
    this.emit('checking')
  }

  updateAvailable (event, info) {
    this.emit('update-available', info)
    dialog.showMessageBox({
      type: 'info',
      title: this.i18n.t('app.check-for-updates-title'),
      message: this.i18n.t('app.update-available-message'),
      buttons: [this.i18n.t('app.yes'), this.i18n.t('app.no')],
      cancelId: 1
    }).then(({ response }) => {
      if (response === 0) {
        this.updater.downloadUpdate()
      } else {
        this.emit('update-cancelled', info)
      }
    })
  }

  updateNotAvailable (event, info) {
    this.isChecking = false
    this.emit('update-not-available', info)
    if (this.autoCheckData.userCheck) {
      dialog.showMessageBox({
        title: this.i18n.t('app.check-for-updates-title'),
        message: this.i18n.t('app.update-not-available-message')
      })
    }
  }

  /**
   * autoUpdater:download-progress
   * @param {Object} event
   * progress,
   * bytesPerSecond,
   * percent,
   * total,
   * transferred
   */
  updateDownloadProgress (event) {
    this.emit('download-progress', event)
  }

  updateDownloaded (event, info) {
    this.emit('update-downloaded', info)
    this.updater.logger.log(`Update Downloaded: ${info}`)
    dialog.showMessageBox({
      title: this.i18n.t('app.check-for-updates-title'),
      message: this.i18n.t('app.update-downloaded-message')
    }).then(_ => {
      this.isChecking = false
      this.emit('will-updated')
      setTimeout(() => {
        this.applyWindowsNsisInstallArgs()
        // quitAndInstall(isSilent, isForceRunAfter)：
        // - false：非静默（不追加 NSIS /S），用户可见安装界面
        // - true：追加 --force-run，安装结束后启动应用
        // electron-updater 内部固定会传 --updated，与 NSIS 的 skipPageIfUpdated / 升级逻辑配合
        this.updater.quitAndInstall(false, true)
      }, 200)
    })
  }

  /**
   * Windows NSIS：在 quitAndInstall 前设置 installDirectory，electron-updater 会追加 `/D=路径`，
   * 使覆盖安装落到当前运行中的安装目录（与手动下载安装包后加 `/D=...` 效果一致）。
   * 其余参数由 electron-updater 组装：--updated、[--force-run]、[/S]、（Web 安装包时）--package-file=...
   */
  applyWindowsNsisInstallArgs () {
    if (process.platform !== 'win32') {
      return
    }
    try {
      const dir = dirname(app.getPath('exe'))
      this.updater.installDirectory = dir
      logger.info('[imFile] NSIS upgrade argv includes /D=' + dir)
    } catch (e) {
      logger.warn('[imFile] applyWindowsNsisInstallArgs:', e)
    }
  }

  updateCancelled () {
    this.isChecking = false
  }

  updateError (event, error) {
    this.isChecking = false
    this.emit('update-error', error)
    const msg = (error == null)
      ? this.i18n.t('app.update-error-message')
      : (error.stack || error).toString()

    this.updater.logger.warn(`[imFile] update-error: ${msg}`)
    dialog.showErrorBox('Error', msg)
  }
}
