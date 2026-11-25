/**
 * macOS 发布构建入口：
 * - 配置了 CSC_LINK 时：Developer ID 签名 + hardened runtime + afterSign 公证
 * - 未配置证书时：显式关闭签名，避免 arm64 上 ad-hoc + hardenedRuntime 组合导致启动异常
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baseConfigPath = join(root, 'electron-builder.json')
const runtimeConfigPath = join(root, 'build', '.electron-builder.mac.runtime.json')

const hasCert = Boolean(process.env.CSC_LINK?.trim() || process.env.CSC_NAME?.trim())
const config = JSON.parse(readFileSync(baseConfigPath, 'utf8'))

if (!hasCert) {
  console.warn('[mac] 未检测到 CSC_LINK/CSC_NAME，将构建未签名包（用户需按 macOS安装说明 去除隔离属性）')
  config.mac = {
    ...config.mac,
    identity: null,
    hardenedRuntime: false,
    notarize: false
  }
  process.env.SKIP_NOTARIZE = 'true'
  process.env.CSC_IDENTITY_AUTO_DISCOVERY = 'false'
} else {
  console.log('[mac] 检测到签名证书，将进行 Developer ID 签名与公证')
  if (process.env.SKIP_NOTARIZE == null) {
    process.env.SKIP_NOTARIZE = 'false'
  }
}

writeFileSync(runtimeConfigPath, `${JSON.stringify(config, null, 2)}\n`)

const result = spawnSync(
  'npx',
  ['electron-builder', '--mac', '--publish=never', '--config', runtimeConfigPath],
  {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: process.env
  }
)

try {
  unlinkSync(runtimeConfigPath)
} catch {
  // ignore
}

process.exit(result.status ?? 1)
