# imFile

<p>
  <a href="https://imfile.org/">
    <img src="./static/512x512.png" width="256" alt="Motrix App Icon" />
  </a>
</p>

## 一款全能的下载工具

[![GitHub release](https://img.shields.io/github/v/release/imfile-io/imfile-desktop.svg)](https://github.com/imfile-io/imfile-desktop/releases) ![Build/release](https://github.com/agalwood/Motrix/workflows/Build/release/badge.svg) ![Total Downloads](https://img.shields.io/github/downloads/imfile-io/imfile-desktop/total.svg) ![Support Platforms](https://camo.githubusercontent.com/a50c47295f350646d08f2e1ccd797ceca3840e52/68747470733a2f2f696d672e736869656c64732e696f2f62616467652f706c6174666f726d2d6d61634f5325323025374325323057696e646f77732532302537432532304c696e75782d6c69676874677265792e737667)

[English](./README.md) | 简体中文

[Motrix](https://github.com/agalwood/Motrix/) 已经很长时间没有更新，同时积累了大量issues，本项目基于[Motrix](https://github.com/agalwood/Motrix/) 的fork并长期维护更新。

imFile 是一款全能的下载工具，支持下载 HTTP、FTP、BT、磁力链、ed2k等资源。它的界面简洁易用，希望大家喜欢 👻。



## 💽 安装稳定版

[GitHub](https://github.com/imfile-io/imfile-desktop/releases) 和 [官网](https://imfile.org/) 提供了已经编译好的稳定版安装包，当然你也可以自己克隆代码编译打包。

### Windows

建议使用安装包（imFile-Setup-x.y.z.exe）安装 imFile 以确保完整的体验，例如关联 torrent 文件，捕获磁力链等。

注意win7操作系统需要下载文件名带win7的版本。

## ✨ 特性

- 🕹 简洁明了的图形操作界面
- 🦄 支持BT和磁力链任务
- ☑️ 支持选择性下载BT部分文件
- 📡 每天自动更新 Tracker 服务器列表
- 🔌 UPnP & NAT-PMP 端口映射
- 🎛 最高支持 10 个任务同时下载
- 🚀 单任务最高支持 64 线程下载
- 🚥 设置上传/下载限速
- 🕶 模拟用户代理UA
- 🔔 下载完成后通知
- 💻 支持触控栏快捷键 (Mac 专享)
- 🤖 常驻系统托盘，操作更加便捷
- 📟 系统托盘速度仪表显示实时速度 (Mac 专享)
- 🗑 移除任务时可同时删除相关文件
- 🌍 国际化，[查看已可选的语言](#-国际化)
- 支持使用doh，解决部分trackers被dns劫持的问题
- 支持直接下载哈希
- 自动保存任务，重启不丢失任务
- 定期更新维护，更新各种依赖和内核
- 🛠 更多特性开发中

## 🖥 应用界面

![motrix-screenshot-task-cn.png](https://raw.githubusercontent.com/imfile-io/imfile-desktop/master/screenshots/userInterface_img.png)

## ⌨️ 本地开发

### 克隆代码

```bash
git clone git@github.com:imfile-io/imfile-desktop.git
```

### 安装依赖

需安装 [pnpm](https://pnpm.io/)（Node 24+ 可用 `corepack enable` 启用）。

```bash
cd imfile-desktop
pnpm install
```

天朝大陆用户建议使用镜像源

```bash
pnpm config set registry 'https://registry.npmmirror.com'
npm config set registry 'https://registry.npmmirror.com'
export ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
export SASS_BINARY_SITE='https://npmmirror.com/mirrors/node-sass'
```

> Error: Electron failed to install correctly, please delete node_modules/electron and try installing again

`Electron` 下载安装失败的问题，解决方式请参考 https://github.com/electron/electron/issues/8466#issuecomment-571425574

### 开发模式

```bash
pnpm run dev
```

### 编译打包

```bash
pnpm run build
```
#### 编译 Apple Silicon 版本

```bash
pnpm run build:applesilicon
```
完成之后可以在项目的 `release` 目录看到编译打包好的应用文件

## 🛠 技术栈

- [Electron](https://electronjs.org/)
- [Vue](https://vuejs.org/) + [VueX](https://vuex.vuejs.org/) + [Element](https://element.eleme.io)
- [Aria2](https://aria2.github.io/)

## 🌍 国际化

欢迎大家将 imFile 翻译成更多的语言版本 🧐

| Key   | Name                | Status       |
|-------|:--------------------|:-------------|
| ar    | Arabic              | ✔️ [@hadialqattan](https://github.com/hadialqattan), [@AhmedElTabarani](https://github.com/AhmedElTabarani) |
| bg    | Българският език    | ✔️ [@null-none](https://github.com/null-none) |
| ca    | Català              | ✔️ [@marcizhu](https://github.com/marcizhu) |
| de    | Deutsch             | ✔️ [@Schloemicher](https://github.com/Schloemicher) |
| el    | Ελληνικά            | ✔️ [@Likecinema](https://github.com/Likecinema) |
| en-US | English             | ✔️           |
| es    | Español             | ✔️ [@Chofito](https://github.com/Chofito)|
| fa    | فارسی               | ✔️ [@Nima-Ra](https://github.com/Nima-Ra) |
| fr    | Français            | ✔️ [@gpatarin](https://github.com/gpatarin) |
| hu    | Hungarian           | ✔️ [@zalnaRs](https://github.com/zalnaRs) |
| id    | Indonesia           | ✔️ [@aarestu](https://github.com/aarestu) |
| it    | Italiano            | ✔️ [@blackcat-917](https://github.com/blackcat-917) |
| ja    | 日本語               | ✔️ [@hbkrkzk](https://github.com/hbkrkzk) |
| ko    | 한국어                | ✔️ [@KOZ39](https://github.com/KOZ39) |
| nb    | Norsk Bokmål        | ✔️ [@rubjo](https://github.com/rubjo) |
| nl    | Nederlands          | ✔️ [@nickbouwhuis](https://github.com/nickbouwhuis) |
| pl    | Polski              | ✔️ [@KanarekLife](https://github.com/KanarekLife) |
| pt-BR | Portuguese (Brazil) | ✔️ [@andrenoberto](https://github.com/andrenoberto) |
| ro    | Română              | ✔️ [@alyn3d](https://github.com/alyn3d) |
| ru    | Русский             | ✔️ [@bladeaweb](https://github.com/bladeaweb) |
| th    | แบบไทย              | ✔️ [@nxanywhere](https://github.com/nxanywhere) |
| tr    | Türkçe              | ✔️ [@abdullah](https://github.com/abdullah) |
| uk    | Українська          | ✔️ [@bladeaweb](https://github.com/bladeaweb) |
| vi    | Tiếng Việt          | ✔️ [@duythanhvn](https://github.com/duythanhvn) |
| zh-CN | 简体中文             | ✔️           |
| zh-TW | 繁體中文             | ✔️ [@Yukaii](https://github.com/Yukaii) [@5idereal](https://github.com/5idereal) |

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=imfile-io/imfile-desktop&type=Timeline)](https://star-history.com/#imfile-io/imfile-desktop&Timeline)

## 📜 开源许可

基于 [MIT license](https://opensource.org/licenses/MIT) 许可进行开源。
