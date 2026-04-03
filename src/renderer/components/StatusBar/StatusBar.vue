<template>
  <footer class="mo-status-bar" role="status">
    <span class="mo-status-bar__text">{{ lineText }}</span>
  </footer>
</template>

<script>
import { ipcRenderer } from 'electron'

import api from '@/api'

export default {
  name: 'mo-status-bar',
  data () {
    return {
      enabled: false,
      btPort: '',
      dhtPort: '',
      btMapped: false,
      dhtMapped: false
    }
  },
  computed: {
    lineText () {
      const upnpOn = this.enabled
        ? this.$t('app.status-upnp-on')
        : this.$t('app.status-upnp-off')
      const btOk = this.btMapped
        ? this.$t('app.status-upnp-mapped')
        : this.$t('app.status-upnp-not-mapped')
      const dhtOk = this.dhtMapped
        ? this.$t('app.status-upnp-mapped')
        : this.$t('app.status-upnp-not-mapped')
      return this.$t('app.status-upnp-line', {
        upnpOn,
        btPort: this.btPort,
        btOk,
        dhtPort: this.dhtPort,
        dhtOk
      })
    }
  },
  mounted () {
    this.refresh()
    this._onUpnpChanged = () => {
      this.refresh()
    }
    ipcRenderer.on('upnp-status-changed', this._onUpnpChanged)
  },
  beforeUnmount () {
    ipcRenderer.removeListener('upnp-status-changed', this._onUpnpChanged)
  },
  methods: {
    async refresh () {
      try {
        const s = await api.fetchUpnpStatus()
        this.enabled = !!s.enabled
        this.btPort = s.btPort != null ? String(s.btPort) : '—'
        this.dhtPort = s.dhtPort != null ? String(s.dhtPort) : '—'
        this.btMapped = !!s.btMapped
        this.dhtMapped = !!s.dhtMapped
      } catch (e) {
        this.enabled = false
        this.btMapped = false
        this.dhtMapped = false
      }
    }
  }
}
</script>

<style lang="scss">
.mo-status-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 18;
  height: 26px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  font-size: 12px;
  line-height: 1;
  color: $--color-text-secondary;
  background: $--app-background;
  border-top: 1px solid $--border-color-lighter;
  box-sizing: border-box;
  user-select: none;
}
.mo-status-bar__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
