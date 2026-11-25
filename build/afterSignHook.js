const { join } = require('node:path')
const { existsSync } = require('node:fs')
const { notarize } = require('@electron/notarize')
const { appId } = require('../electron-builder.json')

function hasNotarizeCredentials () {
  const hasPasswordAuth = Boolean(
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.TEAM_ID
  )
  const hasApiKeyAuth = Boolean(
    process.env.APPLE_API_KEY &&
    process.env.APPLE_API_KEY_ID
  )
  return hasPasswordAuth || hasApiKeyAuth
}

exports.default = async function (context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') {
    return
  }

  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('[notarize] SKIP_NOTARIZE=true，跳过公证')
    return
  }

  if (!hasNotarizeCredentials()) {
    console.warn(
      '[notarize] 未配置 APPLE_ID/TEAM_ID（或 APPLE_API_KEY*）凭证，跳过公证。' +
      '未公证的 macOS 包会被 Gatekeeper 提示「已损坏」，请参阅 build/macOS安装说明.txt'
    )
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = join(appOutDir, `${appName}.app`)
  if (!existsSync(appPath)) {
    throw new Error(`[notarize] 找不到待公证应用：${appPath}`)
  }

  console.log(`[notarize] 开始公证 ${appPath}`)

  /** @type {import('@electron/notarize').NotarizeOptions} */
  const options = { appPath }

  if (process.env.APPLE_API_KEY) {
    options.appleApiKey = process.env.APPLE_API_KEY
    options.appleApiKeyId = process.env.APPLE_API_KEY_ID
    if (process.env.APPLE_API_ISSUER) {
      options.appleApiIssuer = process.env.APPLE_API_ISSUER
    }
  } else {
    options.appleId = process.env.APPLE_ID
    options.appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
    options.teamId = process.env.TEAM_ID
  }

  await notarize(options)
  console.log(`[notarize] 完成公证 ${appId}`)
}
