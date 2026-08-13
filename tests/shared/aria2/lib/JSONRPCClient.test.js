import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('JSONRPCClient', () => {
  let fetchMock
  let JSONRPCClient

  beforeEach(async () => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn()
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const mod = await import('@shared/aria2/lib/JSONRPCClient.js')
    JSONRPCClient = mod.JSONRPCClient
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('url 拼接 http/ws 地址', () => {
    const client = new JSONRPCClient({ host: '127.0.0.1', port: 16800 })
    expect(client.url('http')).toBe('http://127.0.0.1:16800/jsonrpc')
    expect(client.url('ws')).toBe('ws://127.0.0.1:16800/jsonrpc')
  })

  it('_buildMessage 非字符串 method 时抛出 TypeError', () => {
    const client = new JSONRPCClient()
    expect(() => client._buildMessage(123)).toThrow(TypeError)
  })

  it('call 创建 deferred 并在收到响应后 resolve', async () => {
    const client = new JSONRPCClient({ host: '127.0.0.1', port: 16800 })
    client._send = vi.fn().mockResolvedValue(undefined)

    const resultPromise = client.call('getVersion')
    await Promise.resolve()
    const id = Number(Object.keys(client.deferreds)[0])
    client._onresponse({ id, result: '1.36.0' })

    await expect(resultPromise).resolves.toBe('1.36.0')
  })

  it('_onmessage 处理 RPC 错误响应', async () => {
    const client = new JSONRPCClient()
    const deferred = { reject: vi.fn(), resolve: vi.fn() }
    client.deferreds[1] = deferred

    client._onmessage({ id: 1, error: { code: -32601, message: 'not found' } })
    expect(deferred.reject).toHaveBeenCalledWith(expect.objectContaining({
      code: -32601,
      message: 'not found'
    }))
    expect(client.deferreds[1]).toBeUndefined()
  })

  it('_onmessage 处理通知事件', () => {
    const client = new JSONRPCClient()
    const handler = vi.fn()
    client.on('onDownloadComplete', handler)

    client._onmessage({ method: 'onDownloadComplete', params: ['gid'] })
    expect(handler).toHaveBeenCalledWith(['gid'])
  })

  it('不静态导入 ws，避免安装包 asar 中 require(ws) 失败导致骨架屏', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../../../../src/shared/aria2/lib/JSONRPCClient.js', import.meta.url)),
      'utf8'
    )
    expect(src).not.toMatch(/from ['"]ws['"]/)
    expect(src).toMatch(/globalThis\.WebSocket/)
  })
})
