<template>
  <el-container class="main panel" direction="horizontal">
    <el-aside width="200px" class="subnav hidden-xs-only">
      <mo-task-subnav :current="status" />
    </el-aside>
    <el-container class="content panel" direction="vertical">
      <!-- <el-header class="panel-header" height="84">
        <el-row class="panel-row task-header">
          <el-col :span="4" @click.native="() => nav('active')" :class="[status === 'active' ? 'active' : '']">
            <h4>{{ $t('task.active') }}</h4>
          </el-col>
          <el-col :span="4" @click.native="() => nav('seeding')" :class="[status === 'seeding' ? 'active' : '']">
            <h4>{{ $t('task.seeding') }}</h4>
          </el-col>
          <el-col :span="4" @click.native="() => nav('waiting')" :class="[status === 'waiting' ? 'active' : '']">
            <h4>{{ $t('task.waiting') }}</h4>
          </el-col>
          <el-col :span="4" @click.native="() => nav('stopped')" :class="[status === 'stopped' ? 'active' : '']">
            <h4>{{ $t('task.stopped') }}</h4>
          </el-col>
        </el-row>
        <mo-subnav-switcher :title="title" :subnavs="subnavs" class="hidden-sm-and-up" />
        <mo-task-actions />
      </el-header> -->
      <el-header class="panel-header task-panel-toolbar" height="auto">
        <div class="task-toolbar">
          <el-input
            v-if="taskList.length > 0"
            v-model="taskSearchQuery"
            class="task-toolbar-search"
            clearable
            :placeholder="$t('task.search-placeholder')"
          />
          <state-task-actions class="task-toolbar-actions" />
        </div>
      </el-header>
      <el-main class="panel-content">
        <div
          ref="taskContentPanel"
          class="task-content-panel"
          tabindex="0"
          @mousedown.capture="focusTaskContentPanel"
          @keydown="onTaskContentKeydown"
        >
          <mo-task-list :search-query="taskSearchQuery" />
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import { dialog } from '@electron/remote'
import { mapState } from 'vuex'
import { useI18n } from 'vue-i18n'

import { commands } from '@/components/CommandManager/instance'
import { ADD_TASK_TYPE } from '@shared/constants'
import TaskSubnav from '@/components/Subnav/TaskSubnav'
import TaskActions from '@/components/Task/TaskActions'
import TaskList from '@/components/Task/TaskList'
import TaskStateAction from '@/components/Task/TaskStateAction'
import SubnavSwitcher from '@/components/Subnav/SubnavSwitcher'
import {
  getTaskName,
  getTaskUri,
  parseHeader
} from '@shared/utils'
import {
  delayDeleteTaskFiles,
  showItemInFolder,
  moveTaskFilesToTrash
} from '@/utils/native'

export default {
  name: 'mo-content-task',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  components: {
    [TaskSubnav.name]: TaskSubnav,
    [TaskActions.name]: TaskActions,
    [TaskStateAction.name]: TaskStateAction,
    [TaskList.name]: TaskList,
    [SubnavSwitcher.name]: SubnavSwitcher
  },
  props: {
    status: {
      type: String,
      default: 'all'
    }
  },
  data () {
    return {
      taskSearchQuery: ''
    }
  },
  computed: {
    ...mapState('task', {
      taskList: state => state.taskList,
      selectedTaskKeyList: state => state.selectedTaskKeyList,
      selectedTaskKeyListCount: state => state.selectedTaskKeyList.length
    }),
    ...mapState('preference', {
      noConfirmBeforeDelete: state => state.config.noConfirmBeforeDeleteTask
    }),
    subnavs () {
      return [
        {
          key: 'all',
          title: this.t('task.all-tasks'),
          route: '/task/all'
        },
        {
          key: 'seeding',
          title: this.t('task.seeding'),
          route: '/task/seeding'
        },
        {
          key: 'active',
          title: this.t('task.active'),
          route: '/task/active'
        },
        {
          key: 'waiting',
          title: this.t('task.waiting'),
          route: '/task/waiting'
        },
        {
          key: 'stopped',
          title: this.t('task.stopped'),
          route: '/task/stopped'
        }
      ]
    },
    title () {
      const subnav = this.subnavs.find((item) => item.key === this.status)
      return subnav ? subnav.title : this.t('task.all-tasks')
    },
    /** 与 TaskList filteredTaskList 一致，用于 Ctrl/Cmd+A 全选 */
    filteredTaskKeysForSelectAll () {
      const q = this.taskSearchQuery.trim().toLowerCase()
      if (!q) {
        return this.taskList.map((t) => t.taskKey)
      }
      const defaultName = this.t('task.get-task-name')
      return this.taskList
        .filter((task) => {
          const name = getTaskName(task, {
            defaultName,
            maxLen: -1
          })
          return name.toLowerCase().includes(q)
        })
        .map((t) => t.taskKey)
    }
  },
  watch: {
    status: 'onStatusChange'
  },
  methods: {
    nav (status = 'all') {
      this.$router.push({
        path: `/task/${status}`
      }).catch(err => {
        console.log(err)
      })
    },
    onStatusChange () {
      this.taskSearchQuery = ''
      this.changeCurrentList()
    },
    changeCurrentList () {
      this.$store.dispatch('task/changeCurrentList', this.status)
    },
    directAddTask (uri, options = {}) {
      const uris = [uri]
      const payload = {
        uris,
        options: {
          ...options
        }
      }
      this.$store.dispatch('task/addUri', payload)
        .catch((err) => {
          this.$msg.error(err.message)
        })
    },
    showAddTaskDialog (uri, options = {}) {
      const {
        header,
        ...rest
      } = options
      console.log('[imFile] show add task dialog options: ', options)

      const headers = parseHeader(header)
      const newOptions = {
        ...rest,
        ...headers
      }

      this.$store.dispatch('app/updateAddTaskUrl', uri)
      this.$store.dispatch('app/updateAddTaskOptions', newOptions)
      this.$store.dispatch('app/showAddTaskDialog', ADD_TASK_TYPE.URI)
    },
    deleteTaskFiles (task) {
      try {
        const result = moveTaskFilesToTrash(task)

        if (!result) {
          throw new Error('task.remove-task-file-fail')
        }
      } catch (err) {
        this.$msg.error(this.t(err.message))
      }
    },
    removeTask (task, taskName, isRemoveWithFiles = false) {
      this.$store.dispatch('task/forcePauseTask', task)
        .finally(() => {
          if (isRemoveWithFiles) {
            this.deleteTaskFiles(task)
          }

          return this.removeTaskItem(task, taskName)
        })
    },
    removeTaskRecord (task, taskName, isRemoveWithFiles = false) {
      this.$store.dispatch('task/forcePauseTask', task)
        .finally(() => {
          if (isRemoveWithFiles) {
            this.deleteTaskFiles(task)
          }

          return this.removeTaskRecordItem(task, taskName)
        })
    },
    async removeTaskItem (task, taskName) {
      try {
        await this.$store.dispatch('task/removeTask', task)
        this.$msg.success(this.t('task.delete-task-success', {
          taskName
        }))
      } catch ({ code }) {
        if (code === 1) {
          this.$msg.error(this.t('task.delete-task-fail', {
            taskName
          }))
        }
      }
    },
    async removeTaskRecordItem (task, taskName) {
      try {
        await this.$store.dispatch('task/removeTaskRecord', task)
        this.$msg.success(this.t('task.remove-record-success', {
          taskName
        }))
      } catch ({ code }) {
        if (code === 1) {
          this.$msg.error(this.t('task.remove-record-fail', {
            taskName
          }))
        }
      }
    },
    removeTasks (taskList, isRemoveWithFiles = false) {
      const gids = taskList
        .filter(task => task.engine !== 'goed2kd')
        .map((task) => task.gid)
      const goed2kdTasks = taskList.filter(task => task.engine === 'goed2kd')
      const goed2kdRemovals = goed2kdTasks.map(task => this.$store.dispatch('task/removeTask', task))
      this.$store.dispatch('task/batchForcePauseTask', gids)
        .finally(() => {
          if (isRemoveWithFiles) {
            this.batchDeleteTaskFiles(taskList)
          }

          if (gids.length > 0) {
            this.removeTaskItems(gids)
          }
          if (goed2kdRemovals.length > 0) {
            Promise.allSettled(goed2kdRemovals)
          }
        })
    },
    batchDeleteTaskFiles (taskList) {
      const promises = taskList.map((task, index) => delayDeleteTaskFiles(task, index * 200))
      Promise.allSettled(promises).then(results => {
        console.log('[imFile] batch delete task files: ', results)
      })
    },
    removeTaskItems (gids) {
      this.$store.dispatch('task/batchRemoveTask', gids)
        .then(() => {
          this.$msg.success(this.t('task.batch-delete-task-success'))
        })
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.t('task.batch-delete-task-fail'))
          }
        })
    },
    handlePauseTask (payload) {
      const { task, taskName } = payload
      // this.$msg.info(this.t('task.download-pause-message', { taskName }))
      this.$store.dispatch('task/pauseTask', task)
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.t('task.pause-task-fail', { taskName }))
          }
        })
    },
    handleResumeTask (payload) {
      const { task, taskName } = payload
      this.$store.dispatch('task/resumeTask', task)
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.t('task.resume-task-fail', {
              taskName
            }))
          }
        })
    },
    handleStopTaskSeeding (payload) {
      const { task } = payload
      this.$store.dispatch('task/stopSeeding', task)
      this.$msg.info({
        message: this.t('task.bt-stopping-seeding-tip'),
        duration: 8000
      })
    },
    handleRestartTask (payload) {
      const { task, taskName, showDialog } = payload
      const { gid } = task
      const uri = getTaskUri(task)

      this.$store.dispatch('task/getTaskOption', gid)
        .then((data) => {
          console.log('[imFile] get task option:', data)
          const { dir, header, split } = data
          const options = {
            dir,
            header,
            split,
            out: taskName
          }

          if (showDialog) {
            this.showAddTaskDialog(uri, options)
          } else {
            this.directAddTask(uri, options)
            this.$store.dispatch('task/removeTaskRecord', task)
          }
        })
    },
    handleRevealInFolder (payload) {
      const { path } = payload
      showItemInFolder(path, {
        errorMsg: this.t('task.file-not-exist')
      })
    },
    handleDeleteTask (payload) {
      const { task, taskName, deleteWithFiles } = payload
      const { noConfirmBeforeDelete } = this

      if (noConfirmBeforeDelete) {
        this.removeTask(task, taskName, deleteWithFiles)
        return
      }

      dialog.showMessageBox({
        type: 'warning',
        title: this.t('task.delete-task'),
        message: this.t('task.delete-task-confirm', { taskName }),
        buttons: [this.t('app.yes'), this.t('app.no')],
        cancelId: 1,
        checkboxLabel: this.t('task.delete-task-label'),
        checkboxChecked: deleteWithFiles
      }).then(({ response, checkboxChecked }) => {
        if (response === 0) {
          this.removeTask(task, taskName, checkboxChecked)
        }
      })
    },
    handleDeleteTaskRecord (payload) {
      const { task, taskName, deleteWithFiles } = payload
      const { noConfirmBeforeDelete } = this

      if (noConfirmBeforeDelete) {
        this.removeTaskRecord(task, taskName, deleteWithFiles)
        return
      }

      dialog.showMessageBox({
        type: 'warning',
        title: this.t('task.remove-record'),
        message: this.t('task.remove-record-confirm', { taskName }),
        buttons: [this.t('app.yes'), this.t('app.no')],
        cancelId: 1,
        checkboxLabel: this.t('task.remove-record-label'),
        checkboxChecked: !!deleteWithFiles
      }).then(({ response, checkboxChecked }) => {
        if (response === 0) {
          this.removeTaskRecord(task, taskName, checkboxChecked)
        }
      })
    },
    handleBatchDeleteTask (payload) {
      const { deleteWithFiles } = payload
      const {
        noConfirmBeforeDelete,
        selectedTaskKeyList,
        selectedTaskKeyListCount,
        taskList
      } = this
      if (selectedTaskKeyListCount === 0) {
        return
      }

      const selectedTaskList = taskList.filter((task) => {
        return selectedTaskKeyList.includes(task.taskKey)
      })

      if (noConfirmBeforeDelete) {
        this.removeTasks(selectedTaskList, deleteWithFiles)
        return
      }

      const count = `${selectedTaskKeyListCount}`
      dialog.showMessageBox({
        type: 'warning',
        title: this.t('task.delete-selected-task'),
        message: this.t('task.batch-delete-task-confirm', { count }),
        buttons: [this.t('app.yes'), this.t('app.no')],
        cancelId: 1,
        checkboxLabel: this.t('task.delete-task-label'),
        checkboxChecked: deleteWithFiles
      }).then(({ response, checkboxChecked }) => {
        if (response === 0) {
          this.removeTasks(selectedTaskList, checkboxChecked)
        }
      })
    },
    handleCopyTaskLink (payload) {
      const { task } = payload
      const uri = getTaskUri(task)
      navigator.clipboard.writeText(uri)
        .then(() => {
          this.$msg.success(this.t('task.copy-link-success'))
        })
    },
    handleShowTaskInfo (payload) {
      const { task } = payload
      this.$store.dispatch('task/showTaskDetail', task)
    },
    focusTaskContentPanel () {
      this.$nextTick(() => {
        this.$refs.taskContentPanel?.focus?.()
      })
    },
    onTaskContentKeydown (e) {
      if (!(e.ctrlKey || e.metaKey)) {
        return
      }
      if (e.key !== 'a' && e.key !== 'A') {
        return
      }
      if (this.taskList.length === 0) {
        return
      }
      const keys = this.filteredTaskKeysForSelectAll
      if (keys.length === 0) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      this.$store.dispatch('task/selectTasks', keys)
    }
  },
  created () {
    this.changeCurrentList()
    this.$store.dispatch('task/fetchAllList')
  },
  mounted () {
    commands.on('pause-task', this.handlePauseTask)
    commands.on('resume-task', this.handleResumeTask)
    commands.on('stop-task-seeding', this.handleStopTaskSeeding)
    commands.on('restart-task', this.handleRestartTask)
    commands.on('reveal-in-folder', this.handleRevealInFolder)
    commands.on('delete-task', this.handleDeleteTask)
    commands.on('delete-task-record', this.handleDeleteTaskRecord)
    commands.on('batch-delete-task', this.handleBatchDeleteTask)
    commands.on('copy-task-link', this.handleCopyTaskLink)
    commands.on('show-task-info', this.handleShowTaskInfo)
  },
  unmounted () {
    commands.off('pause-task', this.handlePauseTask)
    commands.off('resume-task', this.handleResumeTask)
    commands.off('stop-task-seeding', this.handleStopTaskSeeding)
    commands.off('restart-task', this.handleRestartTask)
    commands.off('reveal-in-folder', this.handleRevealInFolder)
    commands.off('delete-task', this.handleDeleteTask)
    commands.off('delete-task-record', this.handleDeleteTaskRecord)
    commands.off('batch-delete-task', this.handleBatchDeleteTask)
    commands.off('copy-task-link', this.handleCopyTaskLink)
    commands.off('show-task-info', this.handleShowTaskInfo)
  }
}
</script>

<style lang="scss">
/* 特异性需高于 .panel .panel-header，否则会沿用全局 padding 且与标题栏叠在一起 */
.panel .panel-header.task-panel-toolbar {
  padding-top: 56px;
  padding-bottom: 10px;
  overflow: visible;
}
.task-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 50px;
  box-sizing: border-box;
}
.task-toolbar-search {
  flex: 1;
  max-width: 360px;
  min-width: 120px;
}
.task-toolbar-actions {
  margin-left: auto;
  flex-shrink: 0;
  padding-right: 8px;
}
.task-content-panel {
  min-height: 100%;
  outline: none;
}
</style>
