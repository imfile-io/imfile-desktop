'use strict'

import { BrowserWindow } from 'electron'

function escapeHtml (s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 迁移 / 引擎准备时的轻量加载窗（转圈动画）
 * @param {import('electron').BrowserWindow | null} parent
 * @param {string} message
 * @returns {Promise<BrowserWindow>}
 */
export function showEngineBootstrapOverlay (parent, message) {
  const win = new BrowserWindow({
    width: 420,
    height: 180,
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    modal: Boolean(parent && !parent.isDestroyed()),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  const msg = escapeHtml(message)
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      background: #1e1e1e;
      color: #e0e0e0;
      height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      -webkit-app-region: drag;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #333;
      border-top-color: #4a9eff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 20px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    p { font-size: 14px; text-align: center; line-height: 1.5; max-width: 360px; }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <p>${msg}</p>
</body>
</html>`

  const ready = new Promise((resolve) => {
    win.once('ready-to-show', () => {
      win.show()
      resolve(win)
    })
  })

  win.loadURL(
    'data:text/html;charset=utf-8,' + encodeURIComponent(html)
  )

  return ready
}

export function closeEngineBootstrapOverlay (win) {
  if (win && !win.isDestroyed()) {
    win.close()
  }
}
