# imFile 下载引擎与 Aria2 集成详解

## 概述

imFile 使用 Aria2 作为核心下载引擎，通过 JSON-RPC 协议进行通信。Aria2 是一个轻量级的多协议命令行下载工具，支持 HTTP/HTTPS、FTP、SFTP、BitTorrent 和 Metalink 等多种协议。

## Aria2 引擎架构

### 进程模型

```
imFile 主进程
    ↓ (spawn)
Aria2 子进程 (独立运行)
    ↑ (JSON-RPC)
引擎客户端 (主进程/渲染进程)
```

Aria2 作为独立的子进程运行，与 imFile 主进程和渲染进程通过 JSON-RPC 协议通信。

## Engine 类 - 引擎进程管理

### 核心功能

`src/main/core/Engine.js` 负责管理 Aria2 进程的生命周期：

```javascript
export default class Engine {
  static instance = null

  constructor(options = {}) {
    this.options = options
    this.systemConfig = options.systemConfig
    this.userConfig = options.userConfig
  }

  start() {
    const binPath = this.getEngineBinPath()    // 获取二进制文件路径
    const args = this.getStartArgs()           // 构建启动参数
    
    this.instance = spawn(binPath, args, {
      windowsHide: false,
      stdio: is.dev() ? 'pipe' : 'ignore'
    })
    
    this.writePidFile(pidPath, pid)           // 写入进程 ID 文件
    this.setupEventHandlers()                // 设置事件处理
  }
}
```

### 跨平台二进制文件管理

#### 二进制文件路径映射

```javascript
// src/main/configs/engine.js
export const engineBinMap = {
  darwin: 'aria2c',        // macOS
  win32: 'aria2c.exe',     // Windows
  linux: 'aria2c'         // Linux
}

export const engineArchMap = {
  darwin: {
    x64: 'x64',
    arm64: 'arm64'         // Apple Silicon
  },
  win32: {
    ia32: 'ia32',
    x64: 'x64',
    arm64: 'x64'           // ARM64 使用 x64 二进制
  },
  linux: {
    x64: 'x64',
    arm: 'armv7l',
    arm64: 'arm64'
  }
}
```

#### 二进制文件目录结构

```
extra/
├── darwin/                # macOS
│   ├── arm64/engine/
│   │   ├── aria2c         # Apple Silicon 二进制
│   │   └── aria2.conf     # 配置文件
│   └── x64/engine/
│       ├── aria2c         # Intel 二进制
│       └── aria2.conf
├── win32/                 # Windows
│   ├── ia32/engine/
│   │   ├── aria2c.exe     # 32位二进制
│   │   └── aria2.conf
│   └── x64/engine/
│       ├── aria2c.exe     # 64位二进制
│       └── aria2.conf
└── linux/                 # Linux
    ├── arm64/engine/
    ├── armv7l/engine/
    └── x64/engine/
```

### 启动参数配置

```javascript
getStartArgs() {
  const config = this.userConfig
  const args = [
    `--conf-path=${getAria2ConfPath()}`,      // 配置文件路径
    `--input-file=${getSessionPath()}`,       // 会话文件路径
    `--save-session=${getSessionPath()}`,     // 保存会话路径
    '--enable-rpc=true',                      // 启用 RPC
    `--rpc-listen-port=${config.rpcListenPort}`,
    '--rpc-allow-origin-all=true',
    `--rpc-secret=${config.rpcSecret}`,       // RPC 密钥
    '--continue=true',                        // 断点续传
    '--auto-file-renaming=false',             // 自动重命名
    `--max-concurrent-downloads=${config.maxConcurrentDownloads}`,
    `--max-connection-per-server=${config.maxConnectionPerServer}`,
    `--split=${config.split}`,
    `--min-split-size=${config.minSplitSize}`
  ]
  
  return args
}
```

## JSON-RPC 通信架构

### 通信协议栈

```
应用层：Aria2 方法调用
    ↓
RPC 层：JSON-RPC 2.0 协议
    ↓
传输层：WebSocket (实时) / HTTP (请求响应)
    ↓
网络层：TCP/IP
```

### Aria2 类 - RPC 客户端

`src/shared/aria2/lib/Aria2.js` 实现了 Aria2 特定的 JSON-RPC 客户端：

```javascript
export class Aria2 extends JSONRPCClient {
  // 添加方法前缀
  prefix(str) {
    if (!str.startsWith('system.') && !str.startsWith('aria2.')) {
      str = 'aria2.' + str
    }
    return str
  }

  // 添加认证密钥
  addSecret(parameters) {
    let params = this.secret ? ['token:' + this.secret] : []
    if (Array.isArray(parameters)) {
      params = params.concat(parameters)
    }
    return params
  }

  // 调用 RPC 方法
  async call(method, ...params) {
    return super.call(this.prefix(method), this.addSecret(params))
  }

  // 批量调用
  async multicall(calls) {
    const multi = [
      calls.map(([method, ...params]) => {
        return { 
          methodName: this.prefix(method), 
          params: this.addSecret(params) 
        }
      })
    ]
    return super.call('system.multicall', multi)
  }
}
```

### JSONRPCClient - 底层通信

`src/shared/aria2/lib/JSONRPCClient.js` 实现了 JSON-RPC 2.0 协议：

#### WebSocket 通信（实时）
```javascript
websocket(message) {
  return new Promise((resolve, reject) => {
    const cb = (err) => {
      if (err) reject(err)
      else resolve()
    }
    this.socket.send(JSON.stringify(message), cb)
  })
}
```

#### HTTP 通信（请求-响应）
```javascript
async http(message) {
  const response = await fetch(this.url('http'), {
    method: 'POST',
    body: JSON.stringify(message),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  })

  response.json()
    .then(this._onmessage)
    .catch(err => this.emit('error', err))

  return response
}
```

## 双端通信模式

### 主进程 EngineClient

`src/main/core/EngineClient.js` - 主进程中的引擎客户端：

```javascript
export default class EngineClient {
  constructor(options = {}) {
    this.options = {
      host: ENGINE_RPC_HOST,    // localhost
      port: ENGINE_RPC_PORT,    // 16800
      secret: EMPTY_STRING,
      ...options
    }
    this.init()
  }

  connect() {
    const { host, port, secret } = this.options
    this.client = new Aria2({ host, port, secret })
  }

  async call(method, ...args) {
    return this.client.call(method, ...args).catch(err => {
      logger.warn('[imFile] call client fail:', err.message)
    })
  }

  // 更改全局选项
  async changeGlobalOption(options) {
    const args = formatOptionsForEngine(options)
    return this.call('changeGlobalOption', args)
  }

  // 关闭引擎
  async shutdown(options = {}) {
    const { force = false } = options
    const method = force ? 'forceShutdown' : 'shutdown'
    return this.call(method)
  }
}
```

### 渲染进程 API 客户端

`src/renderer/api/Api.js` - 渲染进程中的 API 客户端：

```javascript
export default class Api {
  async init() {
    this.config = await this.loadConfig()     // 从主进程加载配置
    this.client = this.initClient()           // 初始化 Aria2 客户端
    this.client.open()                        // 建立 WebSocket 连接
  }

  initClient() {
    const { rpcListenPort: port, rpcSecret: secret } = this.config
    return new Aria2({
      host: ENGINE_RPC_HOST,
      port,
      secret
    })
  }

  // 任务管理方法
  async addUri(uris, options = {}) {
    return this.client.call('addUri', uris, options)
  }

  async addTorrent(torrent, uris = [], options = {}) {
    return this.client.call('addTorrent', torrent, uris, options)
  }

  async pause(gid) {
    return this.client.call('pause', gid)
  }

  async unpause(gid) {
    return this.client.call('unpause', gid)
  }

  async remove(gid) {
    return this.client.call('remove', gid)
  }
}
```

## 实时事件通知

### WebSocket 事件监听

Aria2 通过 WebSocket 发送实时事件通知：

```javascript
// EngineClient.vue (渲染进程组件)
export default {
  methods: {
    startPolling() {
      this.timer = setInterval(() => {
        this.fetchGlobalStat()
        if (this.enabledFetchPeers) {
          this.fetchPeers()
        }
      }, this.interval)

      // 监听 WebSocket 事件
      this.client.on('onDownloadStart', this.onDownloadStart)
      this.client.on('onDownloadPause', this.onDownloadPause)
      this.client.on('onDownloadStop', this.onDownloadStop)
      this.client.on('onDownloadComplete', this.onDownloadComplete)
      this.client.on('onDownloadError', this.onDownloadError)
      this.client.on('onBtDownloadComplete', this.onBtDownloadComplete)
    },

    onDownloadStart(params) {
      const [{ gid }] = params
      console.log(`[imFile] download start: ${gid}`)
      this.fetchAllList()
    },

    onDownloadComplete(params) {
      const [{ gid }] = params
      console.log(`[imFile] download complete: ${gid}`)
      this.fetchAllList()
      // 显示下载完成通知
    }
  }
}
```

### 事件类型

Aria2 支持的主要事件：
- `onDownloadStart` - 下载开始
- `onDownloadPause` - 下载暂停
- `onDownloadStop` - 下载停止
- `onDownloadComplete` - 下载完成
- `onDownloadError` - 下载错误
- `onBtDownloadComplete` - BT 下载完成

## 配置管理

### 配置文件层次

```
1. 内置默认配置 (aria2.conf)
2. 系统配置 (system.json)
3. 用户配置 (通过 UI 设置)
```

### 主要配置项

```javascript
// 默认配置示例
const defaultConfig = {
  // 下载设置
  'max-concurrent-downloads': 5,        // 最大并发下载数
  'max-connection-per-server': 16,      // 每服务器最大连接数
  'split': 16,                          // 单文件最大线程数
  'min-split-size': '1M',              // 最小分片大小
  
  // 网络设置
  'rpc-listen-port': 16800,            // RPC 监听端口
  'enable-rpc': true,                  // 启用 RPC
  'rpc-allow-origin-all': true,        // 允许所有来源
  'rpc-secret': '',                    // RPC 密钥
  
  // 文件设置
  'dir': '/Users/username/Downloads',   // 下载目录
  'continue': true,                    // 断点续传
  'auto-file-renaming': false,         // 自动重命名
  
  // BitTorrent 设置
  'bt-tracker-timeout': 60,            // Tracker 超时
  'bt-tracker-connect-timeout': 10,    // Tracker 连接超时
  'dht-listen-port': '6881-6999',      // DHT 监听端口
  'enable-dht': true,                  // 启用 DHT
  'enable-peer-exchange': true,        // 启用 PEX
  'seed-ratio': 1.0,                   // 种子分享率
  'seed-time': 60                      // 种子时间（分钟）
}
```

## 下载流程

### 1. 添加下载任务

```javascript
// 添加 HTTP/FTP 下载
await api.addUri(['http://example.com/file.zip'], {
  dir: '/path/to/download',
  'max-connection-per-server': 16,
  split: 16
})

// 添加 BT 下载
const torrentData = fs.readFileSync('file.torrent')
await api.addTorrent(torrentData, [], {
  dir: '/path/to/download',
  'seed-ratio': 1.5
})
```

### 2. 监控下载进度

```javascript
// 获取活动任务列表
const activeList = await api.tellActive()

// 获取任务详细信息
const taskInfo = await api.tellStatus(gid, [
  'gid', 'status', 'totalLength', 'completedLength',
  'downloadSpeed', 'files', 'dir'
])
```

### 3. 任务控制

```javascript
// 暂停任务
await api.pause(gid)

// 恢复任务
await api.unpause(gid)

// 删除任务
await api.remove(gid)

// 强制删除任务
await api.forceRemove(gid)
```

## 错误处理与重连机制

### 连接错误处理

```javascript
// 连接失败时的重试机制
connect() {
  const maxRetries = 5
  let retryCount = 0

  const attemptConnect = () => {
    this.client.open().catch(err => {
      if (retryCount < maxRetries) {
        retryCount++
        setTimeout(attemptConnect, 2000 * retryCount)
      } else {
        this.emit('connect-failed', err)
      }
    })
  }

  attemptConnect()
}
```

### 引擎状态监控

```javascript
// 定期检查引擎状态
checkEngineHealth() {
  setInterval(async () => {
    try {
      await this.client.call('getVersion')
    } catch (err) {
      // 引擎不响应，尝试重启
      this.restartEngine()
    }
  }, 30000)
}
```

这种架构设计使得 imFile 能够充分利用 Aria2 的强大功能，同时保持良好的可靠性和用户体验。通过 JSON-RPC 协议的双向通信，实现了实时的下载状态更新和精确的任务控制。