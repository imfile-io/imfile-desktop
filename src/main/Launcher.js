import { EventEmitter } from 'node:events'
import { app } from 'electron'
import is from 'electron-is'

import { enable } from '@electron/remote/main'

import ExceptionHandler from './core/ExceptionHandler'
import logger from './core/Logger'
import Application from './Application'
import {
  splitArgv,
  parseArgvAsUrl,
  parseArgvAsFile
} from './utils'
import { EMPTY_STRING } from '@shared/constants'

export default class Launcher extends EventEmitter {
  constructor () {
    super()
    this.url = EMPTY_STRING
    this.file = EMPTY_STRING

    this.makeSingleInstance(() => {
      this.init()
    })
  }

  makeSingleInstance (callback) {
    // Mac App Store Sandboxed App not support requestSingleInstanceLock
    if (is.mas()) {
      callback && callback()
      return
    }

    const gotSingleLock = app.requestSingleInstanceLock()

    if (!gotSingleLock) {
      app.quit()
    } else {
      app.on('second-instance', (event, argv, workingDirectory) => {
        global.application.showPage('index')
        if (!is.macOS() && argv.length > 1) {
          this.handleAppLaunchArgv(argv)
        }
      })

      callback && callback()
    }
  }

  init () {
    this.exceptionHandler = new ExceptionHandler()

    this.openedAtLogin = is.macOS()
      ? app.getLoginItemSettings().wasOpenedAtLogin
      : false

    if (process.argv.length > 1) {
      this.handleAppLaunchArgv(process.argv)
    }

    logger.info('[imFile] openedAtLogin:', this.openedAtLogin)

    this.installDevToolsIfNeeded()
    this.handleAppEvents()
  }

  installDevToolsIfNeeded () {
    if (!process.env.ELECTRON_RENDERER_URL) {
      return
    }
    app.whenReady().then(async () => {
      try {
        const { default: installExtension, VUEJS_DEVTOOLS } = await import('electron-devtools-installer')
        await installExtension(VUEJS_DEVTOOLS)
      } catch (err) {
        logger.warn('[imFile] vue-devtools install failed:', err)
      }
    })
  }

  handleAppEvents () {
    this.handleRendererRemote()
    this.handleOpenUrl()
    this.handleOpenFile()

    this.handelAppReady()
    this.handleAppWillQuit()
  }

  handleRendererRemote () {
    app.on('browser-window-created', (_, window) => {
      enable(window.webContents)
    })
  }

  /**
   * handleOpenUrl
   * Event 'open-url' macOS only
   * "name": "imFile Protocol",
   * "schemes": ["mo", "imfile"]
   */
  handleOpenUrl () {
    if (is.mas() || !is.macOS()) {
      return
    }
    app.on('open-url', (event, url) => {
      logger.info(`[imFile] open-url: ${url}`)
      event.preventDefault()
      this.url = url
      this.sendUrlToApplication()
    })
  }

  /**
   * handleOpenFile
   * Event 'open-file' macOS only
   * handle open torrent file
   */
  handleOpenFile () {
    if (!is.macOS()) {
      return
    }
    app.on('open-file', (event, path) => {
      logger.info(`[imFile] open-file: ${path}`)
      event.preventDefault()
      this.file = path
      this.sendFileToApplication()
    })
  }

  /**
   * handleAppLaunchArgv
   * For Windows, Linux
   * @param {array} argv
   */
  handleAppLaunchArgv (argv) {
    logger.info('[imFile] handleAppLaunchArgv:', argv)

    // args: array, extra: map
    const { args, extra } = splitArgv(argv)
    logger.info('[imFile] split argv args:', args)
    logger.info('[imFile] split argv extra:', extra)
    if (extra['--opened-at-login'] === '1') {
      this.openedAtLogin = true
    }

    const file = parseArgvAsFile(args)
    if (file) {
      this.file = file
      this.sendFileToApplication()
    }

    const url = parseArgvAsUrl(args)
    if (url) {
      this.url = url
      this.sendUrlToApplication()
    }
  }

  sendUrlToApplication () {
    if (this.url && global.application && global.application.isReady) {
      global.application.handleProtocol(this.url)
      this.url = EMPTY_STRING
    }
  }

  sendFileToApplication () {
    if (this.file && global.application && global.application.isReady) {
      global.application.handleFile(this.file)
      this.file = EMPTY_STRING
    }
  }

  handelAppReady () {
    app.on('ready', () => {
      global.application = new Application()

      app.configureHostResolver({
        secureDnsMode: 'secure',
        secureDnsServers: [
          'https://1.1.1.1/dns-query'
        ]
      })

      const { openedAtLogin } = this
      global.application.start('index', {
        openedAtLogin
      })

      global.application.on('ready', () => {
        this.sendUrlToApplication()

        this.sendFileToApplication()
      })
    })

    app.on('activate', () => {
      if (global.application) {
        logger.info('[imFile] activate')
        global.application.showPage('index')
      }
    })
  }

  handleAppWillQuit () {
    app.on('will-quit', () => {
      logger.info('[imFile] will-quit')
      if (global.application) {
        logger.info('[imFile] will-quit.application.stop')
        global.application.stop()
      }
    })
  }
}
