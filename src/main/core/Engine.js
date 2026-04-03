import { spawn, spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlink,
  writeFileSync,
  writeFile
} from 'node:fs'
import is from 'electron-is'

import logger from './Logger'
import { getI18n } from '../ui/Locale'
import {
  ENGINE_BACKEND,
  getEnginePidPath,
  getEngineBinPathByBackend,
  getAria2ConfPath,
  getSessionPath,
  getUserDownloadsPath,
  getGoAria2DataDir,
  getGoAria2SessionJsonPath,
  getGoAria2MigrationConfPath,
  isGoAria2EngineBin,
  transformConfig
} from '../utils/index'

const { platform, arch } = process

function toConfPathValue (p) {
  return String(p || '').replace(/\\/g, '/')
}

export default class Engine {
  // ChildProcess | null
  static instance = null

  constructor (options = {}) {
    this.options = options

    this.i18n = getI18n()
    this.systemConfig = options.systemConfig
    this.userConfig = options.userConfig
    this.engineBackend =
      options.engineBackend === ENGINE_BACKEND.ARIA2
        ? ENGINE_BACKEND.ARIA2
        : ENGINE_BACKEND.GO_ARIA2
  }

  start () {
    const pidPath = getEnginePidPath()
    logger.info('[imFile] Engie pid path:', pidPath)

    if (this.instance) {
      return
    }

    const binPath = this.getEngineBinPath()

    const args = this.getStartArgs(binPath)
    this.instance = spawn(binPath, args, {
      windowsHide: false,
      stdio: is.dev() ? 'pipe' : 'ignore'
    })
    const pid = this.instance.pid.toString()
    this.writePidFile(pidPath, pid)

    this.instance.once('close', () => {
      try {
        unlink(pidPath, (err) => {
          if (err) {
            logger.warn(`[imFile] Unlink engine process pid file failed: ${err}`)
          }
        })
      } catch (err) {
        logger.warn(`[imFile] Unlink engine process pid file failed: ${err}`)
      }
    })

    if (is.dev()) {
      this.instance.stdout.on('data', (data) => {
        logger.log('[imFile] engine stdout===>', data.toString())
      })

      this.instance.stderr.on('data', (data) => {
        logger.log('[imFile] engine stderr===>', data.toString())
      })
    }
  }

  /**
   * 参考 go-aria2 migrate-from-aria2：将旧 aria2 文本 save-session 导入为 session.json。
   * 仅在用户确认升级后由 Application 调用。
   * @see https://github.com/chenjia404/go-aria2/blob/master/docs/migrate-from-aria2.md
   */
  static runMigrateFromAria2Session (binPath, systemConfig) {
    const legacySession = getSessionPath()
    const goSessionJson = getGoAria2SessionJsonPath()

    if (!existsSync(legacySession)) {
      return
    }
    let legacySize = 0
    try {
      legacySize = statSync(legacySession).size
    } catch {
      return
    }
    if (legacySize === 0) {
      return
    }

    if (existsSync(goSessionJson)) {
      try {
        if (statSync(goSessionJson).size > 0) {
          return
        }
      } catch {
        return
      }
    }

    const confPath = getAria2ConfPath(platform, arch)
    const migConfPath = getGoAria2MigrationConfPath()
    const dataDir = getGoAria2DataDir()
    mkdirSync(dataDir, { recursive: true })

    try {
      const base = readFileSync(confPath, 'utf8')
      const dir = systemConfig.dir || getUserDownloadsPath()
      const overlay = `
# --- imFile: go-aria2 迁移覆盖（自动生成，勿手改）---
dir=${toConfPathValue(dir)}
data-dir=${toConfPathValue(dataDir)}
save-session=${toConfPathValue(goSessionJson)}
`
      writeFileSync(migConfPath, base + '\n' + overlay, 'utf8')
    } catch (err) {
      logger.error('[imFile] write go-aria2 migration conf failed:', err.message)
      return
    }

    const migrateArgs = [
      'migrate-from-aria2',
      '--conf',
      migConfPath,
      '--session',
      legacySession
    ]
    if (process.env.IMFILE_GO_ARIA2_MIGRATE_STRICT === '1') {
      migrateArgs.push('--strict')
    }

    logger.info('[imFile] go-aria2 migrate-from-aria2:', migrateArgs.join(' '))
    const r = spawnSync(binPath, migrateArgs, {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    })
    if (is.dev() && r.stdout) {
      logger.log('[imFile] migrate stdout:', r.stdout)
    }
    if (r.stderr) {
      logger.log('[imFile] migrate stderr:', r.stderr)
    }
    if (r.error) {
      logger.warn('[imFile] migrate-from-aria2 spawn error:', r.error.message)
      return
    }
    if (r.status !== 0) {
      logger.warn(
        '[imFile] migrate-from-aria2 exited with code',
        r.status,
        '- 仍将尝试启动引擎'
      )
      return
    }
    logger.info('[imFile] migrate-from-aria2 finished successfully')
  }

  /** @returns {boolean} 是否需要执行 migrate-from-aria2 */
  static shouldRunMigrateFromAria2 () {
    const legacySession = getSessionPath()
    if (!existsSync(legacySession)) {
      return false
    }
    let legacySize = 0
    try {
      legacySize = statSync(legacySession).size
    } catch {
      return false
    }
    if (legacySize === 0) {
      return false
    }
    const goSessionJson = getGoAria2SessionJsonPath()
    if (!existsSync(goSessionJson)) {
      return true
    }
    try {
      return statSync(goSessionJson).size === 0
    } catch {
      return false
    }
  }

  stop () {
    logger.info('[imFile] engine.stop.instance')
    if (this.instance) {
      this.instance.kill()
      this.instance = null
    }
  }

  writePidFile (pidPath, pid) {
    writeFile(pidPath, pid, (err) => {
      if (err) {
        logger.error(`[imFile] Write engine process pid failed: ${err}`)
      }
    })
  }

  getEngineBinPath () {
    const result = getEngineBinPathByBackend(
      platform,
      arch,
      this.engineBackend
    )
    const binIsExist = existsSync(result)
    if (!binIsExist) {
      logger.error('[imFile] engine bin is not exist:', result)
      throw new Error(this.i18n.t('app.engine-missing-message'))
    }

    return result
  }

  getStartArgs (binPath) {
    const confPath = getAria2ConfPath(platform, arch)
    const resolvedBin = binPath || this.getEngineBinPath()

    let result
    if (isGoAria2EngineBin(resolvedBin)) {
      const goSession = getGoAria2SessionJsonPath()
      const dataDir = getGoAria2DataDir()
      mkdirSync(dataDir, { recursive: true })
      result = [
        `--conf-path=${confPath}`,
        `--save-session=${goSession}`,
        `--data-dir=${dataDir}`
      ]
      if (existsSync(goSession) && statSync(goSession).size > 0) {
        result = [...result, `--input-file=${goSession}`]
      }
    } else {
      const sessionPath = getSessionPath()
      const sessionIsExist = existsSync(sessionPath)
      result = [`--conf-path=${confPath}`, `--save-session=${sessionPath}`]
      if (sessionIsExist) {
        result = [...result, `--input-file=${sessionPath}`]
      }
    }

    const extraConfig = {
      ...this.systemConfig
    }
    const keepSeeding = this.userConfig['keep-seeding']
    const seedRatio = this.systemConfig['seed-ratio']
    if (keepSeeding || seedRatio === 0) {
      extraConfig['seed-ratio'] = 0
      delete extraConfig['seed-time']
    }

    const extra = transformConfig(extraConfig)
    result = [...result, ...extra]

    return result
  }

  isRunning (pid) {
    try {
      return process.kill(pid, 0)
    } catch (e) {
      return e.code === 'EPERM'
    }
  }

  restart () {
    this.stop()
    this.start()
  }
}
