#!/usr/bin/env node
/**
 * 将 electron-builder --linux dir 产物复制到 flatpak/stage/imfile-app，供 flatpak-builder 使用。
 * 需在 Linux 上先执行：pnpm run sync-go-aria2 && pnpm run build:linux:dir
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const releaseDir = path.join(ROOT, 'release')
const stageDir = path.join(ROOT, 'flatpak', 'stage', 'imfile-app')

function log (...args) {
  console.log('[prepare-flatpak-stage]', ...args)
}

function logErr (...args) {
  console.error('[prepare-flatpak-stage]', ...args)
}

if (!fs.existsSync(releaseDir)) {
  logErr('缺少 release/，请先执行: pnpm run build:linux:dir（在 Linux 上）')
  process.exit(1)
}

const candidates = fs
  .readdirSync(releaseDir)
  .filter((name) => /^linux.*-unpacked$/.test(name))
  .map((name) => path.join(releaseDir, name))
  .filter((p) => {
    try {
      return fs.statSync(p).isDirectory()
    } catch {
      return false
    }
  })

if (!candidates.length) {
  logErr('未找到 release/linux*-unpacked，请先执行: pnpm run build:linux:dir')
  process.exit(1)
}

function pickUnpacked (list) {
  const arch = process.arch
  if (list.length === 1) {
    return list[0]
  }
  if (arch === 'arm64') {
    return (
      list.find((p) => p.includes('arm64')) ||
      list.find((p) => p.includes('armv7l')) ||
      list[0]
    )
  }
  return (
    list.find((p) => p.includes('x64')) ||
    list.find((p) => /linux-unpacked$/.test(p)) ||
    list[0]
  )
}

const unpacked = pickUnpacked(candidates)
if (candidates.length > 1) {
  log('多个 linux*-unpacked，选用:', path.basename(unpacked))
}

fs.rmSync(stageDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(stageDir), { recursive: true })
fs.cpSync(unpacked, stageDir, { recursive: true })
log('已同步到', path.relative(ROOT, stageDir))
