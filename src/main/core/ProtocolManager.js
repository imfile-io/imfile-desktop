import { EventEmitter } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { app } from 'electron'
import is from 'electron-is'
import { parse } from 'querystring'

import logger from './Logger'
import protocolMap from '../configs/protocol'
import { ADD_TASK_TYPE } from '@shared/constants'

const execFileAsync = promisify(execFile)
const WINDOWS_CLASSES_ROOT = 'HKCU\\Software\\Classes'
const TORRENT_PROG_ID = 'imFile.torrent'

export default class ProtocolManager extends EventEmitter {
  constructor (options = {}) {
    super()
    this.options = options

    // package.json:build.protocols[].schemes[]
    // options.protocols: { 'magnet': true, 'thunder': false, 'torrent': true, 'ed2k': false }
    this.protocols = {
      mo: true,
      imfile: true,
      ...options.protocols
    }

    this.init()
  }

  init () {
    const { protocols } = this
    this.setup(protocols).catch((err) => {
      logger.warn('[imFile] protocol setup failed:', err?.message ?? err)
    })
  }

  async setup (protocols = {}) {
    if (is.dev() || is.mas()) {
      return
    }

    for (const protocol of Object.keys(protocols)) {
      const enabled = protocols[protocol]
      if (protocol === 'torrent') {
        await this.setupTorrentFileAssociation(Boolean(enabled))
        continue
      }

      if (enabled) {
        if (!app.isDefaultProtocolClient(protocol)) {
          app.setAsDefaultProtocolClient(protocol)
        }
      } else {
        app.removeAsDefaultProtocolClient(protocol)
      }
    }
  }

  async runReg (args = []) {
    const { stdout = '' } = await execFileAsync('reg', args, {
      windowsHide: true
    })
    return stdout
  }

  async queryRegDefaultValue (key) {
    try {
      const stdout = await this.runReg(['query', key, '/ve'])
      return stdout.includes(TORRENT_PROG_ID)
    } catch {
      return false
    }
  }

  async setupTorrentFileAssociation (enabled) {
    if (!is.windows()) {
      return
    }

    try {
      if (enabled) {
        await this.registerTorrentFileAssociation()
      } else {
        await this.unregisterTorrentFileAssociation()
      }
    } catch (err) {
      logger.warn('[imFile] torrent file association setup failed:', err?.message ?? err)
    }
  }

  async registerTorrentFileAssociation () {
    const exePath = process.execPath
    const openCommand = `"${exePath}" "%1"`
    const iconRef = `"${exePath}",0`

    await this.runReg([
      'add',
      `${WINDOWS_CLASSES_ROOT}\\${TORRENT_PROG_ID}`,
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      'imFile Torrent File',
      '/f'
    ])
    await this.runReg([
      'add',
      `${WINDOWS_CLASSES_ROOT}\\${TORRENT_PROG_ID}\\DefaultIcon`,
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      iconRef,
      '/f'
    ])
    await this.runReg([
      'add',
      `${WINDOWS_CLASSES_ROOT}\\${TORRENT_PROG_ID}\\shell\\open\\command`,
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      openCommand,
      '/f'
    ])
    await this.runReg([
      'add',
      `${WINDOWS_CLASSES_ROOT}\\.torrent\\OpenWithProgids`,
      '/v',
      TORRENT_PROG_ID,
      '/t',
      'REG_NONE',
      '/d',
      '',
      '/f'
    ])
    await this.runReg([
      'add',
      `${WINDOWS_CLASSES_ROOT}\\.torrent`,
      '/ve',
      '/t',
      'REG_SZ',
      '/d',
      TORRENT_PROG_ID,
      '/f'
    ])
  }

  async unregisterTorrentFileAssociation () {
    const torrentExtKey = `${WINDOWS_CLASSES_ROOT}\\.torrent`
    const isCurrentDefault = await this.queryRegDefaultValue(torrentExtKey)

    if (isCurrentDefault) {
      await this.runReg([
        'delete',
        torrentExtKey,
        '/ve',
        '/f'
      ]).catch(() => {})
    }

    await this.runReg([
      'delete',
      `${torrentExtKey}\\OpenWithProgids`,
      '/v',
      TORRENT_PROG_ID,
      '/f'
    ]).catch(() => {})

    await this.runReg([
      'delete',
      `${WINDOWS_CLASSES_ROOT}\\${TORRENT_PROG_ID}`,
      '/f'
    ]).catch(() => {})
  }

  handle (url) {
    logger.info(`[imFile] protocol url: ${url}`)

    if (
      url.toLowerCase().startsWith('ftp:') ||
      url.toLowerCase().startsWith('http:') ||
      url.toLowerCase().startsWith('https:') ||
      url.toLowerCase().startsWith('magnet:') ||
      url.toLowerCase().startsWith('thunder:') ||
      url.toLowerCase().startsWith('ed2k:')
    ) {
      return this.handleResourceProtocol(url)
    }

    if (
      url.toLowerCase().startsWith('mo:') ||
      url.toLowerCase().startsWith('imFile:')
    ) {
      return this.handleMoProtocol(url)
    }
  }

  handleResourceProtocol (url) {
    if (!url) {
      return
    }

    global.application.sendCommandToAll('application:new-task', {
      type: ADD_TASK_TYPE.URI,
      uri: url
    })
  }

  handleMoProtocol (url) {
    const parsed = new URL(url)
    const { host, search } = parsed
    logger.info('[imFile] protocol parsed:', parsed, host)

    const command = protocolMap[host]
    if (!command) {
      return
    }

    const query = search.startsWith('?') ? search.replace('?', '') : search
    const args = parse(query)
    global.application.sendCommandToAll(command, args)
  }
}
