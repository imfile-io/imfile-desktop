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
  GOED2KD_DEFAULT_RPC_PORT,
  GOED2KD_DEFAULT_LISTEN_TCP_PORT,
  GOED2KD_DEFAULT_LISTEN_UDP_PORT
} from '@shared/constants'

const { platform, arch } = process

/**
 * 从已解析的 goed2kd config 对象读取 engine 监听端口（供 getRuntimeOptions 与 UPnP 共用）
 */
export function parseEnginePortsFromConfig (config) {
  let listenPort = GOED2KD_DEFAULT_LISTEN_TCP_PORT
  let udpPort = GOED2KD_DEFAULT_LISTEN_UDP_PORT
  if (!config || typeof config !== 'object') {
    return { listenPort, udpPort }
  }
  const tcp = config.engine?.listen_port ?? config.engine?.listenPort
  const udp = config.engine?.udp_port ?? config.engine?.udpPort
  if (tcp != null && !Number.isNaN(Number(tcp))) {
    listenPort = Number(tcp)
  }
  if (udp != null && !Number.isNaN(Number(udp))) {
    udpPort = Number(udp)
  }
  return { listenPort, udpPort }
}

/**
 * 未启动引擎时从配置文件读取 eD2k TCP/UDP 端口（用于 UPnP 等）
 */
export function readGoed2kdEnginePortsFromConfigSync (configPath = getGoed2kdConfigPath()) {
  try {
    if (!existsSync(configPath)) {
      return {
        listenPort: GOED2KD_DEFAULT_LISTEN_TCP_PORT,
        udpPort: GOED2KD_DEFAULT_LISTEN_UDP_PORT
      }
    }
    const raw = readFileSync(configPath, 'utf8')
    const config = JSON.parse(raw)
    return parseEnginePortsFromConfig(config)
  } catch (err) {
    logger.warn('[imFile] read goed2kd engine ports from config failed:', err.message)
    return {
      listenPort: GOED2KD_DEFAULT_LISTEN_TCP_PORT,
      udpPort: GOED2KD_DEFAULT_LISTEN_UDP_PORT
    }
  }
}

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
    /** eD2k 协议 TCP / UDP 监听端口（与 HTTP RPC 端口 port 不同） */
    let listenPort = GOED2KD_DEFAULT_LISTEN_TCP_PORT
    let udpPort = GOED2KD_DEFAULT_LISTEN_UDP_PORT

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

      const ep = parseEnginePortsFromConfig(config)
      listenPort = ep.listenPort
      udpPort = ep.udpPort
    } catch (err) {
      logger.warn('[imFile] parse goed2kd config failed:', err.message)
    }

    return {
      host,
      port,
      token,
      configPath,
      listenPort,
      udpPort
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
    const { host, port, token } = this.getRuntimeOptions()
    const headers = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    return new Promise((resolve) => {
      const req = httpRequest({
        method: 'GET',
        host: host || GOED2KD_DEFAULT_RPC_HOST,
        port: port || GOED2KD_DEFAULT_RPC_PORT,
        path,
        headers
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
