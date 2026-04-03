import fetch from 'node-fetch'

export default class Goed2kdClient {
  constructor (options = {}) {
    this.options = options
    this.getRuntimeOptions = options.getRuntimeOptions
  }

  getBaseUrl () {
    const runtime = this.getRuntimeOptions ? this.getRuntimeOptions() : {}
    const host = runtime.host || '127.0.0.1'
    const port = runtime.port || 18080
    return `http://${host}:${port}/api/v1`
  }

  getAuthHeader () {
    const runtime = this.getRuntimeOptions ? this.getRuntimeOptions() : {}
    const token = runtime.token || ''
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async request (path, options = {}) {
    const url = `${this.getBaseUrl()}${path}`
    const headers = {
      'Content-Type': 'application/json',
      ...this.getAuthHeader(),
      ...(options.headers || {})
    }

    const response = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    let payload = null
    try {
      payload = await response.json()
    } catch (err) {
      payload = { code: 'BAD_RESPONSE', message: err.message }
    }

    if (!response.ok || (payload && payload.code && payload.code !== 'OK')) {
      const message = payload?.message || payload?.code || `HTTP_${response.status}`
      throw new Error(message)
    }

    return payload?.data
  }

  addEd2k (ed2kLink) {
    return this.request('/transfers', {
      method: 'POST',
      body: { ed2k_link: ed2kLink }
    })
  }

  listTransfers () {
    return this.request('/transfers')
  }

  getNetworkDht () {
    return this.request('/network/dht')
  }

  pauseTransfer (hash) {
    return this.request(`/transfers/${hash}/pause`, { method: 'POST' })
  }

  resumeTransfer (hash) {
    return this.request(`/transfers/${hash}/resume`, { method: 'POST' })
  }

  removeTransfer (hash) {
    return this.request(`/transfers/${hash}`, { method: 'DELETE' })
  }

  startSearch (body = {}) {
    return this.request('/searches', {
      method: 'POST',
      body: {
        query: body.query || '',
        scope: body.scope || 'all',
        min_size: body.min_size ?? 0,
        max_size: body.max_size ?? 0,
        min_sources: body.min_sources ?? 0,
        min_complete_sources: body.min_complete_sources ?? 0,
        file_type: body.file_type || '',
        extension: body.extension || ''
      }
    })
  }

  getCurrentSearch () {
    return this.request('/searches/current')
  }

  stopSearch () {
    return this.request('/searches/current/stop', { method: 'POST' })
  }

  downloadSearchResult (hash, body = {}) {
    const h = encodeURIComponent(String(hash || '').trim())
    const payload = {}
    if (body.target_dir) payload.target_dir = body.target_dir
    if (body.target_name) payload.target_name = body.target_name
    if (body.paused !== undefined) payload.paused = body.paused
    return this.request(`/searches/current/results/${h}/download`, {
      method: 'POST',
      body: payload
    })
  }
}
