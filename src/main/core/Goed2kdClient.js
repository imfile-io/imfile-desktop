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

  pauseTransfer (hash) {
    return this.request(`/transfers/${hash}/pause`, { method: 'POST' })
  }

  resumeTransfer (hash) {
    return this.request(`/transfers/${hash}/resume`, { method: 'POST' })
  }

  removeTransfer (hash) {
    return this.request(`/transfers/${hash}`, { method: 'DELETE' })
  }
}
