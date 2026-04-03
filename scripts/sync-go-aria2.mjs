#!/usr/bin/env node
/**
 * 开发维护用：从 GitHub Release 同步 chenjia404/go-aria2 可执行文件到 extra/<平台>/<架构>/engine/（手动运行）。
 * 用法：pnpm run sync-go-aria2
 * 可选环境变量：GITHUB_TOKEN（降低 API 限流）
 */

import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  copyFileSync,
  chmodSync,
  mkdtempSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(__dirname, '..')
const EXTRA = join(REPO_ROOT, 'extra')

const PLATFORMS = ['darwin', 'win32', 'linux']

/** extra 目录名（与 engineArchMap 一致）→ GitHub goos_goarch */
const FOLDER_TO_GO = {
  darwin: {
    x64: { goos: 'darwin', goarch: 'amd64' },
    arm64: { goos: 'darwin', goarch: 'arm64' }
  },
  win32: {
    x64: { goos: 'windows', goarch: 'amd64' },
    ia32: { goos: 'windows', goarch: '386' },
    arm64: { goos: 'windows', goarch: 'arm64' }
  },
  linux: {
    x64: { goos: 'linux', goarch: 'amd64' },
    ia32: { goos: 'linux', goarch: '386' },
    arm64: { goos: 'linux', goarch: 'arm64' },
    armv7l: { goos: 'linux', goarch: 'arm' }
  }
}

const API_LATEST = 'https://api.github.com/repos/chenjia404/go-aria2/releases/latest'

function log (...args) {
  console.log('[sync-go-aria2]', ...args)
}

function logWarn (...args) {
  console.warn('[sync-go-aria2]', ...args)
}

function discoverTargets () {
  const targets = []
  for (const platform of PLATFORMS) {
    const base = join(EXTRA, platform)
    if (!existsSync(base) || !statSync(base).isDirectory()) {
      continue
    }
    for (const folderArch of readdirSync(base)) {
      const engineDir = join(base, folderArch, 'engine')
      if (existsSync(engineDir) && statSync(engineDir).isDirectory()) {
        const go = FOLDER_TO_GO[platform]?.[folderArch]
        if (!go) {
          logWarn(
            `跳过未知架构目录: ${platform}/${folderArch}/engine（请在脚本中补充 FOLDER_TO_GO 映射）`
          )
          continue
        }
        targets.push({
          platform,
          folderArch,
          destDir: engineDir,
          ...go
        })
      }
    }
  }
  return targets
}

/** Release 内二进制名（当前为 go-aria2c）；也兼容若上游改为 go-aria2 */
function candidateNamesInArchive (platform) {
  if (platform === 'win32') {
    return ['go-aria2c.exe', 'go-aria2.exe']
  }
  return ['go-aria2c', 'go-aria2']
}

/** 写入引擎目录时的标准名（与 src/main/configs/engine.js 中 engineGoAria2BinMap 一致） */
function finalBinName (platform) {
  return platform === 'win32' ? 'go-aria2.exe' : 'go-aria2'
}

function assetRegex (goos, goarch) {
  // 例：go-aria2c_0.0.2_darwin_amd64.tar.gz
  return new RegExp(`^go-aria2c_.+_${goos}_${goarch}\\.(tar\\.gz|zip)$`)
}

async function fetchJson (url) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'imfile-desktop-sync-go-aria2/1.0'
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }
  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status} ${url}\n${text}`)
  }
  return res.json()
}

async function downloadFile (url, destPath) {
  const headers = {
    'User-Agent': 'imfile-desktop-sync-go-aria2/1.0',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {})
  }
  const res = await fetch(url, { headers, redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${res.status}`)
  }
  const buf = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buf)
}

function extractArchive (archivePath, outDir) {
  const lower = archivePath.toLowerCase()
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) {
    const r = spawnSync('tar', ['-xzf', archivePath, '-C', outDir], { stdio: 'inherit' })
    if (r.error) throw r.error
    if (r.status !== 0) throw new Error(`tar exited ${r.status}`)
    return
  }
  if (lower.endsWith('.zip')) {
    const r = spawnSync('tar', ['-xf', archivePath, '-C', outDir], { stdio: 'inherit' })
    if (r.error) throw r.error
    if (r.status !== 0) {
      const r2 = spawnSync('unzip', ['-o', archivePath, '-d', outDir], { stdio: 'inherit' })
      if (r2.error) throw r2.error
      if (r2.status !== 0) throw new Error('解压 zip 失败（需要 tar 或 unzip）')
    }
    return
  }
  throw new Error(`不支持的压缩格式: ${archivePath}`)
}

function findBinaryRecursive (dir, names, depth = 0) {
  if (depth > 4) return null
  const nameSet = new Set(names)
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isFile() && nameSet.has(e.name)) {
      return p
    }
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const found = findBinaryRecursive(join(dir, e.name), names, depth + 1)
      if (found) return found
    }
  }
  return null
}

async function syncOne (target, release) {
  const { goos, goarch, destDir, platform, folderArch } = target
  const re = assetRegex(goos, goarch)
  const asset = release.assets.find((a) => re.test(a.name))
  if (!asset) {
    logWarn(
      `Release ${release.tag_name} 中无匹配资源: ${goos}_${goarch}（跳过 ${platform}/${folderArch}）`
    )
    return
  }

  const tmpRoot = mkdtempSync(join(REPO_ROOT, '.tmp-go-aria2-'))
  const archivePath = join(tmpRoot, asset.name)
  try {
    log(`下载 ${release.tag_name}: ${asset.name}`)
    await downloadFile(asset.browser_download_url, archivePath)

    const extractDir = join(tmpRoot, 'out')
    mkdirSync(extractDir, { recursive: true })
    extractArchive(archivePath, extractDir)

    const wantNames = candidateNamesInArchive(platform)
    const found = findBinaryRecursive(extractDir, wantNames)
    if (!found) {
      throw new Error(`解压后未找到 ${wantNames.join(' 或 ')}`)
    }

    const finalPath = join(destDir, finalBinName(platform))
    copyFileSync(found, finalPath)
    if (platform !== 'win32') {
      chmodSync(finalPath, 0o755)
    }
    log(`已写入 ${finalPath}`)
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true })
  }
}

async function main () {
  const targets = discoverTargets()
  if (targets.length === 0) {
    log('未在 extra/ 下发现任何 extra/<platform>/<arch>/engine 目录，退出。')
    process.exit(0)
  }

  log(`发现 ${targets.length} 个目标:`, targets.map((t) => `${t.platform}/${t.folderArch}`).join(', '))

  const release = await fetchJson(API_LATEST)
  log(`最新 Release: ${release.tag_name}`)

  for (const t of targets) {
    await syncOne(t, release)
  }

  log('完成。')
}

main().catch((err) => {
  console.error('[sync-go-aria2] 失败:', err)
  process.exit(1)
})
