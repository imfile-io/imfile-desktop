<template>
  <div class="mo-engine-client-host">
    <el-dialog
      v-model="postDownloadConfirmVisible"
      :title="$t('task.post-download-confirm-title')"
      width="420px"
      align-center
      append-to-body
      :close-on-click-modal="false"
      @closed="onPostDownloadDialogClosed"
    >
      <p class="post-download-confirm-body">{{ postDownloadConfirmBody }}</p>
      <template #footer>
        <el-button size="small" @click="handlePostDownloadConfirmCancel">
          {{ $t('task.post-download-confirm-cancel') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import is from 'electron-is'
import { mapState } from 'vuex'
import { useI18n } from 'vue-i18n'
import api from '@/api'
import taskCompleteSoundUrl from '@/assets/sounds/task-complete.mp3'
import {
  getTaskFullPath,
  showItemInFolder
} from '@/utils/native'
import { checkTaskIsBT, getTaskName } from '@shared/utils'
import { POST_DOWNLOAD_ACTION } from '@shared/constants'

const POST_DOWNLOAD_CONFIRM_SECONDS = 10

export default {
  name: 'mo-engine-client',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  data () {
    return {
      postDownloadConfirmVisible: false,
      postDownloadCountdown: POST_DOWNLOAD_CONFIRM_SECONDS,
      postDownloadPendingAction: null,
      postDownloadConfirmTimerId: null
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    ...mapState('app', {
      uploadSpeed: state => state.stat.uploadSpeed,
      downloadSpeed: state => state.stat.downloadSpeed,
      speed: state => state.stat.uploadSpeed + state.stat.downloadSpeed,
      interval: state => state.interval,
      downloading: state => state.stat.numActive > 0,
      progress: state => state.progress
    }),
    ...mapState('task', {
      messages: state => state.messages,
      seedingList: state => state.seedingList,
      taskDetailVisible: state => state.taskDetailVisible,
      enabledFetchPeers: state => state.enabledFetchPeers,
      currentTaskGid: state => state.currentTaskGid,
      currentTaskItem: state => state.currentTaskItem
    }),
    ...mapState('preference', {
      taskNotification: state => state.config.taskNotification,
      taskCompleteSound: state => state.config.taskCompleteSound ?? true
    }),
    currentTaskIsBT () {
      return checkTaskIsBT(this.currentTaskItem)
    },
    postDownloadConfirmBody () {
      if (!this.postDownloadPendingAction) {
        return ''
      }
      return this.t('task.post-download-confirm-countdown', {
        seconds: this.postDownloadCountdown,
        actionName: this.postDownloadActionLabel(this.postDownloadPendingAction)
      })
    }
  },
  watch: {
    speed (val) {
      const { uploadSpeed, downloadSpeed } = this
      this.$electron.ipcRenderer.send('event', 'speed-change', {
        uploadSpeed,
        downloadSpeed
      })
    },
    downloading (val, oldVal) {
      if (val !== oldVal && this.isRenderer) {
        this.$electron.ipcRenderer.send('event', 'download-status-change', val)
      }
    },
    progress (val) {
      this.$electron.ipcRenderer.send('event', 'progress-change', val)
    }
  },
  methods: {
    async fetchTaskItem ({ gid }) {
      return api.fetchTaskItem({ gid })
        .catch((e) => {
          console.warn(`fetchTaskItem fail: ${e.message}`)
        })
    },
    onDownloadStart (event) {
      this.$store.dispatch('task/fetchList')
      this.$store.dispatch('app/resetInterval')
      this.$store.dispatch('task/saveSession')
      const [{ gid }] = event
      const { seedingList } = this
      if (seedingList.includes(gid)) {
        return
      }

      this.fetchTaskItem({ gid })
        .then((task) => {
          const { dir } = task
          this.$store.dispatch('preference/recordHistoryDirectory', dir)
          const taskName = getTaskName(task)
          const message = this.t('task.download-start-message', { taskName })
          this.$msg.info(message)
        })
    },
    onDownloadPause (event) {
      const [{ gid }] = event
      const { seedingList } = this
      if (seedingList.includes(gid)) {
        return
      }

      this.fetchTaskItem({ gid })
        .then((task) => {
          const taskName = getTaskName(task)
          const message = this.t('task.download-pause-message', { taskName })
          this.$msg.info(message)
        })
    },
    onDownloadStop (event) {
      const [{ gid }] = event
      this.fetchTaskItem({ gid })
        .then((task) => {
          const taskName = getTaskName(task)
          const message = this.t('task.download-stop-message', { taskName })
          this.$msg.info(message)
        })
    },
    onDownloadError (event) {
      const [{ gid }] = event
      this.fetchTaskItem({ gid })
        .then((task) => {
          const taskName = getTaskName(task)
          const { errorCode, errorMessage } = task
          console.error(`[imFile] download error gid: ${gid}, #${errorCode}, ${errorMessage}`)
          const message = this.t('task.download-error-message', { taskName })
          this.$msg({
            type: 'error',
            showClose: true,
            duration: 5000,
            dangerouslyUseHTMLString: true,
            message: `${message}`
          })
        })
    },
    onDownloadComplete (event) {
      this.$store.dispatch('task/fetchList')
      const [{ gid }] = event
      this.$store.dispatch('task/removeFromSeedingList', gid)

      this.fetchTaskItem({ gid })
        .then((task) => {
          this.handleDownloadComplete(task, false)
        })
    },
    onBtDownloadComplete (event) {
      this.$store.dispatch('task/fetchList')
      const [{ gid }] = event
      const { seedingList } = this
      if (seedingList.includes(gid)) {
        return
      }

      this.$store.dispatch('task/addToSeedingList', gid)

      this.fetchTaskItem({ gid })
        .then((task) => {
          this.handleDownloadComplete(task, true)
        })
    },
    handleDownloadComplete (task, isBT) {
      this.$store.dispatch('task/saveSession')

      const path = getTaskFullPath(task)
      this.showTaskCompleteNotify(task, isBT, path)
      this.$electron.ipcRenderer.send('event', 'task-download-complete', task, path)

      this.$nextTick(() => {
        this.$store.dispatch('task/runPostDownloadActionIfIdle')
          .then((res) => {
            if (res && res.ready && res.action) {
              this.openPostDownloadConfirm(res.action)
              return
            }
            if (res && res.ok === false && res.error) {
              this.$msg.error(this.t('task.post-download-action-fail', { detail: res.error }))
            }
          })
          .catch((e) => console.warn('[imFile] runPostDownloadActionIfIdle', e))
      })
    },
    playTaskCompleteSound () {
      const audio = new Audio(taskCompleteSoundUrl)
      audio.volume = 0.5
      audio.play().catch(() => {})
    },
    showTaskCompleteNotify (task, isBT, path) {
      const taskName = getTaskName(task)
      const message = isBT
        ? this.t('task.bt-download-complete-message', { taskName })
        : this.t('task.download-complete-message', { taskName })
      const tips = isBT
        ? '\n' + this.t('task.bt-download-complete-tips')
        : ''

      this.$msg.success(`${message}${tips}`)

      if (this.taskCompleteSound) {
        this.playTaskCompleteSound()
      }

      if (!this.taskNotification) {
        return
      }

      const notifyMessage = isBT
        ? this.t('task.bt-download-complete-notify')
        : this.t('task.download-complete-notify')

      const notify = new Notification(notifyMessage, {
        body: `${taskName}${tips}`
      })
      notify.onclick = () => {
        showItemInFolder(path, {
          errorMsg: this.t('task.file-not-exist')
        })
      }
    },
    showTaskErrorNotify (task) {
      const taskName = getTaskName(task)

      const message = this.t('task.download-fail-message', { taskName })
      this.$msg.success(message)

      if (!this.taskNotification) {
        return
      }

      /* eslint-disable no-new */
      new Notification(this.t('task.download-fail-notify'), {
        body: taskName
      })
    },
    bindEngineEvents () {
      api.client.on('onDownloadStart', this.onDownloadStart)
      // api.client.on('onDownloadPause', this.onDownloadPause)
      api.client.on('onDownloadStop', this.onDownloadStop)
      api.client.on('onDownloadComplete', this.onDownloadComplete)
      api.client.on('onDownloadError', this.onDownloadError)
      api.client.on('onBtDownloadComplete', this.onBtDownloadComplete)
    },
    unbindEngineEvents () {
      api.client.removeListener('onDownloadStart', this.onDownloadStart)
      // api.client.removeListener('onDownloadPause', this.onDownloadPause)
      api.client.removeListener('onDownloadStop', this.onDownloadStop)
      api.client.removeListener('onDownloadComplete', this.onDownloadComplete)
      api.client.removeListener('onDownloadError', this.onDownloadError)
      api.client.removeListener('onBtDownloadComplete', this.onBtDownloadComplete)
    },
    startPolling () {
      this.timer = setTimeout(() => {
        this.polling()
        this.startPolling()
      }, this.interval)
    },
    polling () {
      this.$store.dispatch('app/fetchGlobalStat')
      this.$store.dispatch('app/fetchProgress')
      this.$store.dispatch('task/fetchList')

      if (this.taskDetailVisible && this.currentTaskGid && this.currentTaskItem && this.currentTaskItem.engine !== 'goed2kd') {
        if (this.currentTaskIsBT && this.enabledFetchPeers) {
          this.$store.dispatch('task/fetchItemWithPeers', this.currentTaskGid)
        } else {
          this.$store.dispatch('task/fetchItem', this.currentTaskGid)
        }
      }
    },
    stopPolling () {
      clearTimeout(this.timer)
      this.timer = null
    },
    clearPostDownloadConfirmTimer () {
      if (this.postDownloadConfirmTimerId != null) {
        clearInterval(this.postDownloadConfirmTimerId)
        this.postDownloadConfirmTimerId = null
      }
    },
    postDownloadActionLabel (action) {
      if (action === POST_DOWNLOAD_ACTION.SHUTDOWN) {
        return this.t('task.post-download-action-shutdown')
      }
      if (action === POST_DOWNLOAD_ACTION.SLEEP) {
        return this.t('task.post-download-action-sleep')
      }
      if (action === POST_DOWNLOAD_ACTION.QUIT) {
        return this.t('task.post-download-action-quit')
      }
      return ''
    },
    openPostDownloadConfirm (action) {
      if (!action || action === POST_DOWNLOAD_ACTION.NONE) {
        return
      }
      this.clearPostDownloadConfirmTimer()
      this.postDownloadPendingAction = action
      this.postDownloadCountdown = POST_DOWNLOAD_CONFIRM_SECONDS
      this.postDownloadConfirmVisible = true
      this.postDownloadConfirmTimerId = setInterval(() => {
        this.postDownloadCountdown -= 1
        if (this.postDownloadCountdown <= 0) {
          this.clearPostDownloadConfirmTimer()
          this.handlePostDownloadConfirmExecute()
        }
      }, 1000)
    },
    handlePostDownloadConfirmCancel () {
      this.clearPostDownloadConfirmTimer()
      this.postDownloadPendingAction = null
      this.postDownloadConfirmVisible = false
      this.$store.dispatch('task/cancelPostDownloadConfirm')
    },
    handlePostDownloadConfirmExecute () {
      const action = this.postDownloadPendingAction
      if (!action) {
        return
      }
      this.clearPostDownloadConfirmTimer()
      this.postDownloadPendingAction = null
      this.postDownloadConfirmVisible = false
      this.$store.dispatch('task/executePostDownloadAction', action)
        .then((res) => {
          if (res && res.ok === false && res.error) {
            this.$msg.error(this.t('task.post-download-action-fail', { detail: res.error }))
          }
        })
        .catch((e) => console.warn('[imFile] executePostDownloadAction', e))
    },
    onPostDownloadDialogClosed () {
      this.clearPostDownloadConfirmTimer()
      if (this.postDownloadPendingAction) {
        this.$store.dispatch('task/cancelPostDownloadConfirm')
        this.postDownloadPendingAction = null
      }
    }
  },
  created () {
    this.bindEngineEvents()
  },
  mounted () {
    setTimeout(() => {
      this.$store.dispatch('app/fetchEngineInfo')
      this.$store.dispatch('app/fetchEngineOptions')

      this.startPolling()
    }, 100)
  },
  unmounted () {
    this.clearPostDownloadConfirmTimer()
    if (this.postDownloadPendingAction) {
      this.$store.dispatch('task/cancelPostDownloadConfirm')
      this.postDownloadPendingAction = null
    }

    this.$store.dispatch('task/saveSession')

    this.unbindEngineEvents()

    this.stopPolling()
  }
}
</script>
