import os from 'node:os'

import logger from './Logger'

/**
 * UPnP 端口映射：@achingbrain/nat-port-mapper。
 * 原 @motrix/nat-api 在未指定 protocol 时对同一端口映射 TCP+UDP，此处保持一致。
 */

let upnpNatLoader = null
let client = null
let gateway = null
let discoverPromise = null
const mappingStatus = {}

async function loadUpnpNat () {
  if (!upnpNatLoader) {
    upnpNatLoader = import('@achingbrain/nat-port-mapper').then((mod) => mod.upnpNat)
  }
  return upnpNatLoader
}

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
    const upnpNat = await loadUpnpNat()
    client = upnpNat({
      description: 'imFile',
      ttl: 7_200_000,
      autoRefresh: true,
      refreshThreshold: 60_000
    })
  }

  async ensureGateway () {
    await this.init()
    if (gateway) {
      return gateway
    }
    if (!discoverPromise) {
      discoverPromise = (async () => {
        const signal = AbortSignal.timeout(15_000)
        for await (const gw of client.findGateways({ signal })) {
          if (gw.family === 'IPv4') {
            gateway = gw
            return
          }
        }
        throw new Error('[imFile] UPnP gateway not found')
      })().finally(() => {
        discoverPromise = null
      })
    }
    await discoverPromise
    return gateway
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
      const host = getLanIPv4()
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
}
