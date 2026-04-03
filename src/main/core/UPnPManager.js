import os from 'node:os'

import { gateway4sync } from 'default-gateway'
import { pmpNat, upnpNat } from '@achingbrain/nat-port-mapper'

import logger from './Logger'

/**
 * UPnP 端口映射：@achingbrain/nat-port-mapper。
 * 原 @motrix/nat-api 在未指定 protocol 时对同一端口映射 TCP+UDP，此处保持一致。
 */

const SSDP_TIMEOUT_MS = 35_000
const SSDP_SEARCH_INTERVAL_MS = 1_500

let client = null
let gateway = null
let discoverPromise = null
const mappingStatus = {}

function getLanIPv4 () {
  const nets = os.networkInterfaces()
  for (const key of Object.keys(nets)) {
    for (const net of nets[key] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

function getLanIPv6GlobalUla () {
  const nets = os.networkInterfaces()
  for (const key of Object.keys(nets)) {
    for (const net of nets[key] ?? []) {
      if (net.family !== 'IPv6' || net.internal) {
        continue
      }
      const a = net.address
      if (a.startsWith('fe80')) {
        continue
      }
      return a
    }
  }
  return '::1'
}

export default class UPnPManager {
  constructor (options = {}) {
    this.options = {
      ...options
    }
  }

  async init () {
    if (client) {
      return
    }
    client = upnpNat({
      description: 'imFile',
      ttl: 7_200_000,
      autoRefresh: true,
      refreshThreshold: 60_000
    })
  }

  getLocalHostForMap () {
    if (!gateway) {
      return getLanIPv4()
    }
    if (gateway.family === 'IPv6') {
      return getLanIPv6GlobalUla()
    }
    return getLanIPv4()
  }

  async ensureGateway () {
    await this.init()
    if (gateway) {
      return gateway
    }
    if (!discoverPromise) {
      discoverPromise = this._discoverGateway().finally(() => {
        discoverPromise = null
      })
    }
    await discoverPromise
    return gateway
  }

  async _discoverGateway () {
    const findOpts = {
      signal: AbortSignal.timeout(SSDP_TIMEOUT_MS),
      searchInterval: SSDP_SEARCH_INTERVAL_MS
    }

    let firstNonV4 = null
    try {
      for await (const gw of client.findGateways(findOpts)) {
        if (gw.family === 'IPv4') {
          gateway = gw
          logger.info('[imFile] UPnPManager SSDP 发现 IPv4 网关')
          return
        }
        if (!firstNonV4) {
          firstNonV4 = gw
        }
      }
    } catch (err) {
      logger.warn('[imFile] UPnPManager SSDP 搜索结束:', err?.message ?? err)
    }

    if (firstNonV4) {
      gateway = firstNonV4
      logger.info('[imFile] UPnPManager SSDP 使用非 IPv4 网关')
      return
    }

    logger.warn('[imFile] UPnPManager SSDP 未发现网关，尝试 NAT-PMP')
    try {
      const { gateway: gwIp } = gateway4sync()
      gateway = pmpNat(gwIp, {
        description: 'imFile',
        ttl: 7_200_000,
        autoRefresh: true,
        refreshThreshold: 60_000
      })
      logger.info('[imFile] UPnPManager 使用 NAT-PMP，网关', gwIp)
    } catch (err) {
      const msg = err?.message ?? String(err)
      logger.warn('[imFile] UPnPManager NAT-PMP 不可用:', msg)
      throw new Error(
        '[imFile] 未发现 UPnP 网关（请确认路由器已开启 UPnP，且本机防火墙未拦截 SSDP 组播 239.255.255.250:1900；部分网络仅支持 NAT-PMP）'
      )
    }
  }

  map (port) {
    return this._map(port)
  }

  async _map (port) {
    logger.info('[imFile] UPnPManager port mapping: ', port)
    if (!port) {
      throw new Error('[imFile] port was not specified')
    }

    const p = Number(port)
    try {
      const gw = await this.ensureGateway()
      const host = this.getLocalHostForMap()
      const opts = {
        ttl: 7_200_000,
        description: 'imFile'
      }
      await gw.map(p, host, { ...opts, protocol: 'tcp' })
      await gw.map(p, host, { ...opts, protocol: 'udp' })
      mappingStatus[port] = true
      logger.info(`[imFile] UPnPManager port ${port} mapping succeeded`)
    } catch (err) {
      const msg = err?.message ?? String(err)
      logger.warn(`[imFile] UPnPManager map ${port} failed, error: `, msg)
      throw msg
    }
  }

  unmap (port) {
    return this._unmap(port)
  }

  async _unmap (port) {
    logger.info('[imFile] UPnPManager port unmapping: ', port)
    if (!port) {
      throw new Error('[imFile] port was not specified')
    }

    if (!mappingStatus[port]) {
      return
    }

    const p = Number(port)
    try {
      const gw = await this.ensureGateway()
      await gw.unmap(p)
      mappingStatus[port] = false
      logger.info(`[imFile] UPnPManager port ${port} unmapping succeeded`)
    } catch (err) {
      const msg = err?.message ?? String(err)
      logger.warn(`[imFile] UPnPManager unmap ${port} failed, error: `, msg)
      throw msg
    }
  }

  async closeClient () {
    if (!gateway && !client) {
      return
    }

    try {
      if (gateway) {
        await gateway.stop()
      }
    } catch (err) {
      logger.warn('[imFile] close UPnP client fail', err)
    }

    gateway = null
    client = null
    discoverPromise = null
    Object.keys(mappingStatus).forEach((k) => {
      mappingStatus[k] = false
    })
  }

  /**
   * @param {string|number} listenPort BT 监听端口
   * @param {string|number} dhtListenPort DHT 端口
   * @param {string|number} [ed2kTcpPort] goed2k engine.listen_port
   * @param {string|number} [ed2kUdpPort] goed2k engine.udp_port
   */
  getPortMappingStatus (listenPort, dhtListenPort, ed2kTcpPort, ed2kUdpPort) {
    const bt = Number(listenPort)
    const dht = Number(dhtListenPort)
    const e2kT = Number(ed2kTcpPort)
    const e2kU = Number(ed2kUdpPort)
    return {
      btMapped: !!mappingStatus[bt],
      dhtMapped: !!mappingStatus[dht],
      ed2kTcpMapped: Number.isFinite(e2kT) ? !!mappingStatus[e2kT] : false,
      ed2kUdpMapped: Number.isFinite(e2kU) ? !!mappingStatus[e2kU] : false
    }
  }
}
