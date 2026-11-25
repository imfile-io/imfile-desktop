# macOS 签名与公证

解决 Gatekeeper 提示「已损坏，无法打开」（[#508](https://github.com/imfile-io/imfile-desktop/issues/508)）的根本办法，是使用 **Developer ID Application** 证书签名，并通过 Apple Notary Service 公证。

## 需要的 GitHub Secrets

在仓库或 `release` Environment 中配置（`MACOS_CSC_LINK` 存在时 CI 才会签名）：

| Secret | 说明 |
|--------|------|
| `MACOS_CSC_LINK` | Developer ID Application 的 `.p12`（base64，或 electron-builder 支持的链接） |
| `MACOS_CSC_KEY_PASSWORD` | p12 密码 |
| `APPLE_ID` | Apple ID（邮箱） |
| `APPLE_APP_SPECIFIC_PASSWORD` | [App 专用密码](https://appleid.apple.com/) |
| `APPLE_TEAM_ID` | 团队 ID（10 位） |

也可改用 App Store Connect API Key（与上方密码方式二选一）：

| Secret | 说明 |
|--------|------|
| `APPLE_API_KEY` | `.p8` 私钥内容或路径 |
| `APPLE_API_KEY_ID` | Key ID |
| `APPLE_API_ISSUER` | Issuer ID |

## 本地发布构建

```bash
export CSC_LINK=...
export CSC_KEY_PASSWORD=...
export APPLE_ID=...
export APPLE_APP_SPECIFIC_PASSWORD=...
export TEAM_ID=...
pnpm run build:macos:release
```

未设置 `CSC_LINK` 时，脚本会打**未签名**包，并跳过公证；请引导用户阅读 `build/macOS安装说明.txt`。

## 相关配置

- `electron-builder.json` → `mac.hardenedRuntime` / `entitlements`
- `build/entitlements.mac.plist`
- `build/afterSignHook.js`（`@electron/notarize` + notarytool）
- `scripts/build-macos-release.mjs`
- `.github/workflows/release.yml` 中的 `release-macos` job
