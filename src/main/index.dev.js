/**
 * 仅用于开发：安装 vue-devtools，并引导主进程入口。
 */

import { app } from 'electron'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'

import './index.js'

app.whenReady().then(() => {
  installExtension(VUEJS_DEVTOOLS)
    .then(() => {})
    .catch((err) => {
      console.log('Unable to install `vue-devtools`: \n', err)
    })
})
