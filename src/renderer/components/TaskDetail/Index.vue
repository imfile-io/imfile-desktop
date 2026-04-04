<template>
  <el-drawer
    class="panel task-detail-drawer"
    size="61.8%"
    v-if="gid"
    :title="$t('task.task-detail-title')"
    :with-header="true"
    :show-close="true"
    :destroy-on-close="true"
    :model-value="visible"
    :before-close="handleClose"
    @closed="handleClosed"
  >
    <el-tabs
      tab-position="top"
      class="task-detail-tab"
      v-model="activeTab"
      :before-leave="handleTabBeforeLeave"
      @tab-click="handleTabClick"
    >
      <el-tab-pane name="general">
        <template #label>
          <span class="task-detail-tab-label"><el-icon><InfoFilled /></el-icon></span>
        </template>
        <mo-task-general :task="task" />
      </el-tab-pane>
      <el-tab-pane name="activity" lazy>
        <template #label>
          <span class="task-detail-tab-label"><el-icon><Grid /></el-icon></span>
        </template>
        <mo-task-activity ref="taskGraphic" :task="task" />
      </el-tab-pane>
      <el-tab-pane name="trackers" lazy v-if="isBT">
        <template #label>
          <span class="task-detail-tab-label"><el-icon><Compass /></el-icon></span>
        </template>
        <mo-task-trackers :task="task" />
      </el-tab-pane>
      <el-tab-pane name="files" lazy v-if="isBT">
        <template #label>
          <span class="task-detail-tab-label"><el-icon><Document /></el-icon></span>
        </template>
        <mo-task-files
          ref="detailFileList"
          mode="DETAIL"
          :files="fileList"
          emit-from-table-selection-only
          @selection-change="handleFilesSelectionChange"
        />
      </el-tab-pane>
      <!-- <el-tab-pane name="peers" lazy v-if="isBT">
        <span class="task-detail-tab-label" slot="label"><i class="el-icon-s-custom"></i></span>
        <mo-task-peers :peers="peers" />
      </el-tab-pane> -->
    </el-tabs>
    <div class="task-detail-actions">
      <div class="action-wrapper action-wrapper-center">
        <mo-task-item-actions mode="DETAIL" :task="task" />
      </div>
    </div>
  </el-drawer>
</template>

<script>
import is from 'electron-is'
import { debounce, merge } from 'lodash'
import { useI18n } from 'vue-i18n'
import {
  calcFormLabelWidth,
  checkTaskIsBT,
  checkTaskIsSeeder,
  getFileExtension,
  getFileName,
  isTaskFileEntrySelected
} from '@shared/utils'
import {
  EMPTY_STRING,
  NONE_SELECTED_FILES,
  SELECTED_ALL_FILES,
  TASK_STATUS
} from '@shared/constants'
import { Compass, Document, Grid, InfoFilled } from '@element-plus/icons-vue'
import TaskItemActions from '@/components/Task/TaskItemActions'
import TaskGeneral from './TaskGeneral'
import TaskActivity from './TaskActivity'
import TaskTrackers from './TaskTrackers'
import TaskPeers from './TaskPeers'
import TaskFiles from './TaskFiles'

const cached = {
  files: []
}

export default {
  name: 'mo-task-detail',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  components: {
    Compass,
    Document,
    Grid,
    InfoFilled,
    [TaskItemActions.name]: TaskItemActions,
    [TaskGeneral.name]: TaskGeneral,
    [TaskActivity.name]: TaskActivity,
    [TaskTrackers.name]: TaskTrackers,
    [TaskPeers.name]: TaskPeers,
    [TaskFiles.name]: TaskFiles
  },
  props: {
    gid: {
      type: String
    },
    task: {
      type: Object
    },
    files: {
      type: Array,
      default: function () {
        return []
      }
    },
    peers: {
      type: Array,
      default: function () {
        return []
      }
    },
    visible: {
      type: Boolean,
      default: false
    }
  },
  data () {
    const { locale } = this.$store.state.preference.config
    return {
      form: {},
      formLabelWidth: calcFormLabelWidth(locale),
      locale,
      activeTab: 'general',
      graphicWidth: 0
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    isBT () {
      return checkTaskIsBT(this.task)
    },
    isSeeder () {
      return checkTaskIsSeeder(this.task)
    },
    taskStatus () {
      const { task, isSeeder } = this
      if (isSeeder) {
        return TASK_STATUS.SEEDING
      } else {
        return task.status
      }
    },
    /** 与引擎 files[].selected / Selected 一致的勾选语义，用于去重 RPC */
    currentServerFileSelectionToken () {
      const raw = this.files
      if (!raw || !raw.length) {
        return SELECTED_ALL_FILES
      }
      const selected = raw.filter((item) => isTaskFileEntrySelected(item))
      if (selected.length === 0) {
        return NONE_SELECTED_FILES
      }
      if (selected.length === raw.length) {
        return SELECTED_ALL_FILES
      }
      return selected
        .map((item) => Number(item.index))
        .sort((a, b) => a - b)
        .join(',')
    },
    fileList () {
      const { files } = this
      const result = files.map((item) => {
        const name = getFileName(item.path)
        const extension = getFileExtension(name)
        return {
          idx: Number(item.index),
          selected: isTaskFileEntrySelected(item),
          path: item.path,
          name,
          extension: `.${extension}`,
          length: parseInt(item.length, 10),
          completedLength: item.completedLength
        }
      })
      merge(cached.files, result)
      return cached.files
    },
    selectedFileList () {
      const { fileList } = this
      const result = fileList.filter((item) => item.selected)

      return result
    }
  },
  created () {
    this._debouncedApplyFileSelect = debounce((sel) => {
      this.applyFileSelectToken(sel)
    }, 280)
  },
  mounted () {
    window.addEventListener('resize', this.handleAppResize)
  },
  unmounted () {
    this._debouncedApplyFileSelect?.cancel?.()
    window.removeEventListener('resize', this.handleAppResize)
    cached.files = []
  },
  watch: {
    gid () {
      cached.files = []
    }
  },
  methods: {
    handleClose (done) {
      this._debouncedApplyFileSelect?.cancel?.()
      window.removeEventListener('resize', this.handleAppResize)
      this.$store.dispatch('task/hideTaskDetail')
      done()
    },
    handleClosed (done) {
      this._debouncedApplyFileSelect?.cancel?.()
      this.$store.dispatch('task/updateCurrentTaskGid', EMPTY_STRING)
      this.$store.dispatch('task/updateCurrentTaskItem', null)
    },
    handleTabBeforeLeave (activeName, oldActiveName) {
      this.activeTab = activeName
      switch (oldActiveName) {
        case 'peers':
          this.$store.dispatch('task/toggleEnabledFetchPeers', false)
          break
      }
    },
    handleTabClick (tab) {
      const { name } = tab
      switch (name) {
        case 'peers':
          this.$store.dispatch('task/toggleEnabledFetchPeers', true)
          break
        case 'files':
          setImmediate(() => {
            this.updateFilesListSelection()
          })
          break
      }
    },
    handleAppResize () {
      debounce(() => {
        console.log('resize===>', this.activeTab, this.$refs.taskGraphic)
        if (this.activeTab === 'activity' && this.$refs.taskGraphic) {
          this.$refs.taskGraphic.updateGraphicWidth()
        }
      }, 250)
    },
    updateFilesListSelection () {
      if (!this.$refs.detailFileList) {
        return
      }

      const { selectedFileList } = this
      this.$refs.detailFileList.toggleSelection(selectedFileList)
    },
    normalizeSelectFileToken (sel) {
      if (sel === NONE_SELECTED_FILES || sel === SELECTED_ALL_FILES) {
        return sel
      }
      return String(sel)
        .split(',')
        .map((s) => Number(String(s).trim()))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)
        .join(',')
    },
    handleFilesSelectionChange (sel) {
      if (!this._debouncedApplyFileSelect) {
        return
      }
      this._debouncedApplyFileSelect(sel)
    },
    async applyFileSelectToken (sel) {
      const { gid } = this
      if (!gid || !this.isBT) {
        return
      }
      const normalizedSel = this.normalizeSelectFileToken(sel)
      const normalizedCur = this.normalizeSelectFileToken(this.currentServerFileSelectionToken)
      if (normalizedSel === normalizedCur) {
        return
      }
      if (sel === NONE_SELECTED_FILES) {
        this.$msg.warning(this.t('task.select-at-least-one'))
        await this.$nextTick()
        this.updateFilesListSelection()
        return
      }
      const selectFile =
        sel !== SELECTED_ALL_FILES ? this.normalizeSelectFileToken(sel) : EMPTY_STRING
      const options = { selectFile }
      try {
        await this.$store.dispatch('task/changeTaskOption', { gid, options })
        await this.$store.dispatch('task/fetchItem', gid)
        this.$store.dispatch('task/saveSession')
      } catch (e) {
        console.warn('[imFile] change select-file failed:', e)
        this.$msg.error(this.t('task.change-select-file-fail'))
        await this.$nextTick()
        this.updateFilesListSelection()
      }
    }
  }
}
</script>

<style lang="scss">
.task-detail-drawer {
  min-width: 478px;
  .el-drawer__header {
    color: var(--im-dialog-title);
    padding-top: 2rem;
    margin-bottom: 0;
  }
  .el-drawer__body {
    position: relative;
    overflow: hidden;
  }
  .el-tabs__nav-wrap::after {
    display: none !important;
  }
  .el-tabs__active-bar {
    display: none !important;
  }
  .task-detail-actions {
    position: sticky;
    left: 0;
    bottom: 1rem;
    z-index: inherit;
    width: 100%;
    text-align: center;
    font-size: 0;
    padding: 0 1.25rem;
    display: flex;
    align-content: space-between;
    justify-content: space-between;
    .task-item-actions {
      display: inline-block;
      &> .task-item-action {
        margin: 0 0.5rem;
      }
    }
  }
  .task-detail-drawer-title {
    &> span, &> ul {
      vertical-align: middle;
    }
  }
  .action-wrapper {
    flex: 1;
  }
  .action-wrapper-left {
    text-align: left;
  }
  .action-wrapper-center {
    padding: 1px 0;
    &> .task-item-actions {
      margin: 0 auto;
    }
  }
  .action-wrapper-right {
    text-align: right;
  }
}

.task-detail-tab {
  height: 100%;
  padding: 0.5rem 1.25rem 3.125rem;
  display: flex;
  flex-direction: column;
  .task-detail-tab-label {
    padding: 0 0.75rem;
  }
  .el-tabs__content {
    position: relative;
    height: 100%;
  }
  .el-tab-pane {
    overflow-x: hidden;
    overflow-y: auto;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
  }
}

.tab-panel-actions {
  display: flex;
  justify-content: space-between;
  position: absolute;
  bottom: -28px;
  left: 0;
  width: 100%;
}
</style>
