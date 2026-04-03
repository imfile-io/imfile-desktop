<template>
  <el-config-provider :locale="elementPlusLocale" size="small">
    <div id="app">
      <mo-title-bar
        v-if="isRenderer"
        :showActions="showWindowActions"
      />
      <router-view />
      <mo-status-bar />
      <mo-engine-client
        :secret="rpcSecret"
      />
      <mo-ipc v-if="isRenderer" />
      <mo-dynamic-tray v-if="enableTraySpeedometer" />
    </div>
  </el-config-provider>
</template>

<script>
import is from 'electron-is'
import { mapGetters, mapState } from 'vuex'
import { APP_RUN_MODE, APP_THEME } from '@shared/constants'
import DynamicTray from '@/components/Native/DynamicTray'
import EngineClient from '@/components/Native/EngineClient'
import Ipc from '@/components/Native/Ipc'
import TitleBar from '@/components/Native/TitleBar'
import StatusBar from '@/components/StatusBar/StatusBar'
import { getLanguage } from '@shared/locales'
import { getLocaleManager } from '@/components/Locale'
import { getElementPlusLocale } from '@/utils/elementPlusLocale'

export default {
  name: 'imfile-app',
  components: {
    [DynamicTray.name]: DynamicTray,
    [EngineClient.name]: EngineClient,
    [Ipc.name]: Ipc,
    [TitleBar.name]: TitleBar,
    [StatusBar.name]: StatusBar
  },
  computed: {
    isMac: () => is.macOS(),
    isRenderer: () => is.renderer(),
    ...mapState('app', {
      systemTheme: state => state.systemTheme
    }),
    ...mapState('preference', {
      showWindowActions: state => {
        return (is.windows() || is.linux()) && state.config.hideAppMenu
      },
      runMode: state => state.config.runMode,
      traySpeedometer: state => state.config.traySpeedometer,
      rpcSecret: state => state.config.rpcSecret
    }),
    ...mapGetters('preference', [
      'theme',
      'locale',
      'direction'
    ]),
    elementPlusLocale () {
      const lng = getLanguage(this.locale)
      return getElementPlusLocale(lng)
    },
    themeClass () {
      if (this.theme === APP_THEME.AUTO) {
        return `theme-${this.systemTheme}`
      } else {
        return `theme-${this.theme}`
      }
    },
    i18nClass () {
      return `i18n-${this.locale}`
    },
    directionClass () {
      return `dir-${this.direction}`
    },
    enableTraySpeedometer () {
      const { isMac, isRenderer, traySpeedometer, runMode } = this
      return isMac && isRenderer && traySpeedometer && runMode !== APP_RUN_MODE.HIDE_TRAY
    }
  },
  methods: {
    updateRootClassName () {
      const { themeClass = '', i18nClass = '', directionClass = '' } = this
      const classList = [themeClass, i18nClass, directionClass]

      // Element Plus dark vars uses `.dark`; keep compatibility with existing `theme-dark`.
      if (themeClass === `theme-${APP_THEME.DARK}`) {
        classList.push('dark')
      }

      const className = classList.filter(Boolean).join(' ')
      document.documentElement.className = className
    }
  },
  beforeMount () {
    this.updateRootClassName()
  },
  watch: {
    locale (val) {
      const lng = getLanguage(val)
      getLocaleManager().changeLanguage(lng)
    },
    themeClass () {
      this.updateRootClassName()
    },
    i18nClass () {
      this.updateRootClassName()
    },
    directionClass () {
      this.updateRootClassName()
    }
  }
}
</script>

<style>
</style>
