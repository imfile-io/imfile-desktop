<template>
  <footer class="mo-status-bar" role="status">
    <span class="mo-status-bar__col mo-status-bar__col--upnp" :title="upnpStatusLine">{{ upnpStatusLine }}</span>
    <span class="mo-status-bar__sep" aria-hidden="true" />
    <span class="mo-status-bar__col mo-status-bar__col--ed2k" :title="ed2kStatusLine">{{ ed2kStatusLine }}</span>
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
      dhtMapped: false,
      ed2kStarted: false,
      ed2kHealthy: false,
      ed2kTcpPort: '',
      ed2kUdpPort: '',
      ed2kTcpMapped: false,
      ed2kUdpMapped: false,
      ed2kKadNodes: null
    }
  },
  computed: {
    upnpStatusLine () {
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
    },
    ed2kStatusLine () {
      const ed2kState = !this.ed2kStarted
        ? this.$t('app.status-ed2k-stopped')
        : this.ed2kHealthy
          ? this.$t('app.status-ed2k-ok')
          : this.$t('app.status-ed2k-bad')
      const kadNodes =
        this.ed2kKadNodes != null && this.ed2kKadNodes !== ''
          ? String(this.ed2kKadNodes)
          : '—'
      const tcpUpnpOk = this.ed2kTcpMapped
        ? this.$t('app.status-upnp-mapped')
        : this.$t('app.status-upnp-not-mapped')
      const udpUpnpOk = this.ed2kUdpMapped
        ? this.$t('app.status-upnp-mapped')
        : this.$t('app.status-upnp-not-mapped')
      const ed2kMeta = this.$t('app.status-ed2k-meta', {
        tcpPort: this.ed2kTcpPort || '—',
        udpPort: this.ed2kUdpPort || '—',
        tcpUpnpOk,
        udpUpnpOk
      })
      const ed2kKad = this.$t('app.status-ed2k-kad', { kadNodes })
      return `${ed2kMeta} · ${ed2kState} · ${ed2kKad}`
    }
  },
  mounted () {
    this.refresh()
    this._kadPollTimer = setInterval(() => {
      this.refreshGoed2kd()
    }, 15000)
    this._onUpnpChanged = () => {
      this.refresh()
    }
    this._onGoed2kdChanged = () => {
      this.refresh()
    }
    ipcRenderer.on('upnp-status-changed', this._onUpnpChanged)
    ipcRenderer.on('goed2kd-status-changed', this._onGoed2kdChanged)
  },
  beforeUnmount () {
    if (this._kadPollTimer) {
      clearInterval(this._kadPollTimer)
    }
    ipcRenderer.removeListener('upnp-status-changed', this._onUpnpChanged)
    ipcRenderer.removeListener('goed2kd-status-changed', this._onGoed2kdChanged)
  },
  methods: {
    async refresh () {
      await this.refreshUpnp()
      await this.refreshGoed2kd()
    },
    async refreshUpnp () {
      try {
        const s = await api.fetchUpnpStatus()
        this.enabled = !!s.enabled
        this.btPort = s.btPort != null ? String(s.btPort) : '—'
        this.dhtPort = s.dhtPort != null ? String(s.dhtPort) : '—'
        this.btMapped = !!s.btMapped
        this.dhtMapped = !!s.dhtMapped
        this.ed2kTcpMapped = !!s.ed2kTcpMapped
        this.ed2kUdpMapped = !!s.ed2kUdpMapped
      } catch (e) {
        this.enabled = false
        this.btMapped = false
        this.dhtMapped = false
        this.ed2kTcpMapped = false
        this.ed2kUdpMapped = false
      }
    },
    async refreshGoed2kd () {
      try {
        const g = await api.getGoed2kdStatus()
        this.ed2kStarted = !!g.started
        this.ed2kHealthy = !!g.healthy
        const tcp = g.ed2kTcpPort
        const udp = g.ed2kUdpPort
        this.ed2kTcpPort =
          tcp != null && tcp !== '' && !Number.isNaN(Number(tcp))
            ? String(tcp)
            : ''
        this.ed2kUdpPort =
          udp != null && udp !== '' && !Number.isNaN(Number(udp))
            ? String(udp)
            : ''
        const k = g.kadKnownNodes
        this.ed2kKadNodes = k != null && k !== '' ? k : null
      } catch (e) {
        this.ed2kStarted = false
        this.ed2kHealthy = false
        this.ed2kTcpPort = ''
        this.ed2kUdpPort = ''
        this.ed2kKadNodes = null
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
  min-height: 26px;
  padding: 4px 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  line-height: 1.35;
  color: $--color-text-secondary;
  background: $--app-background;
  border-top: 1px solid $--border-color-lighter;
  box-sizing: border-box;
}
.mo-status-bar__col {
  flex: 1 1 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: text;
  cursor: text;
}
.mo-status-bar__col--ed2k {
  text-align: right;
}
.mo-status-bar__sep {
  flex: 0 0 1px;
  align-self: stretch;
  min-height: 14px;
  background: $--border-color-lighter;
}
</style>
