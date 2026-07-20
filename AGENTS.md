# AGENTS.md

## Cursor Cloud specific instructions

### 项目概述

imFile 是一个基于 Electron + Vue 3 的全功能桌面下载管理器（Motrix 的 fork），支持 HTTP/FTP/BitTorrent/Magnet/ED2K 协议。

### 开发环境要求

- Node.js >= 24（通过 nvm 安装：`nvm install 24`）
- pnpm（版本由 `package.json` 中 `packageManager` 字段指定，通过 corepack 自动管理）
- 显示服务器（Xvfb 已预装在 Cloud Agent VM，DISPLAY=:1）

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm install` | 安装依赖（postinstall 会自动运行 `electron-builder install-app-deps` 和 `lint:fix`） |
| `pnpm run dev` | 启动开发模式（webpack dev server + Electron） |
| `pnpm run lint` | 运行 ESLint 检查 |
| `pnpm run lint:fix` | ESLint 自动修复 |

### 运行注意事项

1. **PATH 优先级**：Cloud Agent VM 中 `/exec-daemon/node` 可能指向旧版 Node。启动 dev 时需确保 nvm 的 Node 24 在 PATH 前面：`export PATH="$HOME/.nvm/versions/node/v24.*/bin:$PATH"`（update script 已处理）。
2. **`pnpm run dev` 启动流程**：dev-runner.js 同时编译 renderer（端口 9080）和 main 进程，编译完成后自动启动 Electron（带 `--inspect=5858` 调试端口）。
3. **aria2c 引擎**：Electron 主进程启动时会自动从 `extra/linux/x64/engine/aria2c` 生成子进程，通过 JSON-RPC（127.0.0.1:16800）通信。
4. **goed2kd 引擎**：ED2K 下载引擎从 `extra/linux/x64/goed2kd` 启动，HTTP RPC 监听 127.0.0.1:18080。
5. **D-Bus 错误**：容器环境中会出现 `Failed to connect to the bus` 错误，这是预期行为，不影响应用功能。
6. **UPnP 错误**：Cloud Agent 环境中 UPnP/NAT-PMP 端口映射不可用，不影响基本下载功能。
7. **`pnpm run pack` 不可用**：webpack-cli v7 移除了 `--node-env` 参数，pack 脚本存在兼容问题。开发中使用 `pnpm run dev` 即可。
8. **无自动化测试**：项目未配置测试框架，验证通过 lint + 手动测试完成。
