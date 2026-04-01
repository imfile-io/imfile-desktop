import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { dirname } from 'node:path'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import is from 'electron-is'

import logger from './Logger'
import {
  getGoed2kdBinPath,
  getGoed2kdConfigPath
} from '../utils'
import {
  GOED2KD_HEALTH_MAX_RETRIES,
  GOED2KD_HEALTH_RETRY_INTERVAL_MS,
  GOED2KD_DEFAULT_RPC_HOST,
  GOED2KD_DEFAULT_RPC_PORT
} from '@shared/constants'

const { platform, arch } = process

export default class Goed2kdEngine {
  static instance = null

  constructor () {
    this.instance = null
    this.healthy = false
  }

  start () {
    if (this.instance) {
      return Promise.resolve(this.healthy)
    }

    const binPath = this.getEngineBinPath()
    const configPath = this.getConfigPath()
    const args = ['-config', configPath]

    this.instance = spawn(binPath, args, {
      windowsHide: false,
      stdio: is.dev() ? 'pipe' : 'ignore'
    })

    if (is.dev()) {
      this.instance.stdout.on('data', (data) => {
        logger.log('[imFile] goed2kd stdout===>', data.toString())
      })
      this.instance.stderr.on('data', (data) => {
        logger.log('[imFile] goed2kd stderr===>', data.toString())
      })
    }

    this.instance.once('close', () => {
      this.instance = null
      this.healthy = false
    })

    logger.info('[imFile] goed2kd started:', {
      binPath,
      configPath,
      pid: this.instance.pid
    })

    return this.waitForHealth()
  }

  stop () {
    if (!this.instance) {
      return
    }

    try {
      this.instance.kill('SIGTERM')
    } catch (err) {
      logger.warn('[imFile] goed2kd stop failed:', err.message)
    } finally {
      this.instance = null
      this.healthy = false
    }
  }

  getEngineBinPath () {
    const result = getGoed2kdBinPath(platform, arch)
    const binIsExist = existsSync(result)
    if (!binIsExist) {
      logger.error('[imFile] goed2kd bin is not exist:', result)
      throw new Error(`goed2kd binary missing: ${result}`)
    }
    return result
  }

  getConfigPath () {
    const configPath = getGoed2kdConfigPath()
    const configDir = dirname(configPath)
    mkdirSync(configDir, { recursive: true })
    return configPath
  }

  getRuntimeOptions () {
    const configPath = this.getConfigPath()
    let host = GOED2KD_DEFAULT_RPC_HOST
    let port = GOED2KD_DEFAULT_RPC_PORT
    let token = ''

    try {
      const raw = readFileSync(configPath, 'utf8')
      const config = JSON.parse(raw)
      const listen = config?.rpc?.listen || `${GOED2KD_DEFAULT_RPC_HOST}:${GOED2KD_DEFAULT_RPC_PORT}`
      const parts = String(listen).split(':')
      const parsedPort = Number(parts[parts.length - 1])
      if (!Number.isNaN(parsedPort)) {
        port = parsedPort
      }
      if (parts.length > 1) {
        host = parts.slice(0, -1).join(':') || GOED2KD_DEFAULT_RPC_HOST
      }
      token = config?.rpc?.auth_token || ''
    } catch (err) {
      logger.warn('[imFile] parse goed2kd config failed:', err.message)
    }

    return {
      host,
      port,
      token,
      configPath
    }
  }

  waitForHealth () {
    let retries = 0
    return new Promise((resolve) => {
      const check = () => {
        if (!this.instance) {
          this.healthy = false
          resolve(false)
          return
        }

        this.checkHealth().then((ok) => {
          if (ok) {
            this.healthy = true
            resolve(true)
            return
          }

          retries += 1
          if (retries >= GOED2KD_HEALTH_MAX_RETRIES) {
            this.healthy = false
            resolve(false)
            return
          }

          setTimeout(check, GOED2KD_HEALTH_RETRY_INTERVAL_MS)
        })
      }

      check()
    })
  }

  checkHealth () {
    const path = '/api/v1/system/health'
    return new Promise((resolve) => {
      const req = httpRequest({
        method: 'GET',
        host: GOED2KD_DEFAULT_RPC_HOST,
        port: GOED2KD_DEFAULT_RPC_PORT,
        path
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 300)
      })

      req.on('error', () => {
        resolve(false)
      })
      req.end()
    })
  }
}
