import path from 'node:path'
import { pathToFileURL } from 'node:url'

import is from 'electron-is'

export default {
  index: {
    attrs: {
      title: 'imFile',
      width: 1024,
      height: 768,
      minWidth: 478,
      minHeight: 420,
      transparent: is.macOS()
    },
    bindCloseToHide: true,
    openDevTools: is.dev(),
    // 必须用 pathToFileURL：path.join('file://', __dirname, '/index.html') 在 Windows 上会得到非法 URL，导致白屏
    url: is.dev() ? 'http://localhost:9080/index.html' : pathToFileURL(path.join(__dirname, 'index.html')).href
  }
}
