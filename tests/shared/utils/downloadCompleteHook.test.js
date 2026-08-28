import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildDownloadCompleteHookArgs } from '@shared/utils/downloadCompleteHook'

describe('buildDownloadCompleteHookArgs', () => {
  it('构造 aria2 下载完成 Hook 参数', () => {
    const task = {
      gid: 'abc123',
      dir: '/downloads',
      files: [{ path: '/downloads/file.zip', selected: 'true' }]
    }

    expect(buildDownloadCompleteHookArgs(task)).toEqual({
      gid: 'abc123',
      numFiles: '1',
      filePath: resolve('/downloads/file.zip')
    })
  })

  it('仅统计已选文件', () => {
    const task = {
      gid: 'g1',
      dir: '/downloads',
      files: [
        { path: '/downloads/a.zip', selected: 'true' },
        { path: '/downloads/b.zip', selected: 'false' }
      ]
    }

    expect(buildDownloadCompleteHookArgs(task).numFiles).toBe('1')
  })

  it('无文件时使用 fallback 路径', () => {
    const task = { gid: 'g2', dir: '/downloads', files: [] }
    expect(buildDownloadCompleteHookArgs(task, '/downloads/fallback.bin')).toEqual({
      gid: 'g2',
      numFiles: '1',
      filePath: '/downloads/fallback.bin'
    })
  })
})
