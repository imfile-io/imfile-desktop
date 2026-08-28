import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { getTaskFullPath } from '@shared/utils/taskPath'

describe('getTaskFullPath', () => {
  it('空任务返回空字符串', () => {
    expect(getTaskFullPath(null)).toBe('')
    expect(getTaskFullPath(undefined)).toBe('')
  })

  it('BT 任务使用种子名称拼接目录', () => {
    const task = {
      dir: '/downloads',
      bittorrent: { info: { name: 'My Torrent' } },
      files: []
    }
    expect(getTaskFullPath(task)).toBe(resolve('/downloads', 'My Torrent'))
  })

  it('磁力任务仅返回目录', () => {
    const task = {
      dir: '/downloads',
      bittorrent: {},
      files: [{ path: '/downloads/file.bin' }]
    }
    expect(getTaskFullPath(task)).toBe(resolve('/downloads'))
  })

  it('单文件 HTTP 任务解析完整路径', () => {
    const task = {
      dir: '/downloads',
      files: [{ path: '/downloads/single.zip' }]
    }
    expect(getTaskFullPath(task)).toBe(resolve('/downloads/single.zip'))
  })

  it('通过 URI 推导单文件路径', () => {
    const task = {
      dir: '/downloads',
      files: [{ uris: [{ uri: 'https://example.com/hello%20world.zip' }] }]
    }
    expect(getTaskFullPath(task)).toBe(resolve('/downloads', 'hello world.zip'))
  })
})
