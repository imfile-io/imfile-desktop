import is from 'electron-is'
import { ipcRenderer } from 'electron'
import { createApp } from 'vue'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import { ElLoading, ElMessage } from 'element-plus'
import axios from 'axios'

import App from './App.vue'
import router from '@/router'
import store from '@/store'
import { createAppI18n } from '@/i18n'
import { setRendererI18n } from '@/components/Locale'
import Icon from '@/components/Icons/Icon.vue'
import Msg from '@/components/Msg'
import { commands } from '@/components/CommandManager/instance'
import TrayWorker from '@/workers/tray.worker?worker&inline'

import '@/components/Theme/tailwind.css'
import '@/components/Theme/Index.scss'
import './commands'

const updateTray = is.renderer()
  ? async (payload) => {
    const { tray } = payload
    if (!tray) {
      return
    }

    const ab = await tray.arrayBuffer()
    ipcRenderer.send('command', 'application:update-tray', ab)
  }
  : () => {}

function initTrayWorker () {
  try {
    const worker = new TrayWorker()

    worker.addEventListener('message', (event) => {
      const { type, payload } = event.data

      switch (type) {
        case 'initialized':
        case 'log':
          console.log('[imFile] Log from Tray Worker: ', payload)
          break
        case 'tray:drawed':
          updateTray(payload)
          break
        default:
          console.warn('[imFile] Tray Worker unhandled message type:', type, payload)
      }
    })

    return worker
  } catch (err) {
    console.warn('[imFile] tray worker init failed:', err)
    return null
  }
}

function withTimeout (promise, ms, label) {
  let timer
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error(label)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

function init (config) {
  const i18n = createAppI18n(config.locale)
  setRendererI18n(i18n)

  const app = createApp(App)

  app.config.globalProperties.$http = axios
  app.config.globalProperties.$electron = { ipcRenderer }

  app.use(i18n)
  app.use(Msg, ElMessage, {
    showClose: true
  })
  app.component('mo-icon', Icon)

  const loading = ElLoading.service({
    fullscreen: true,
    background: 'rgba(0, 0, 0, 0.1)'
  })

  app.use(store)
  app.use(router)

  global.app = app.mount('#app')

  global.app.commands = commands
  global.app.trayWorker = initTrayWorker()

  setTimeout(() => {
    loading.close()
  }, 400)
}

withTimeout(store.dispatch('preference/fetchPreference'), 4000, 'fetchPreference timeout')
  .then((config) => {
    console.info('[imFile] load preference:', config)
    init(config)
  })
  .catch((err) => {
    console.error('[imFile] load preference failed, fallback to defaults:', err)
    init({})
  })
