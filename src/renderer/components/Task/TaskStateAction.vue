<template>
    <div class="task-state-actions">
        <ul class="task-state-ul">
          <li @click="onRefreshClick" class="mr-2 refresh_btn">
            <mo-icon name="refresh" width="30" height="30" :spin="refreshing" />
          </li>
          <el-button @click="onNewTaskClick"><div class="flex items-center justify-center">
            <i class="task-action">
                  <mo-icon name="task-add" width="15" height="15" />
              </i>
              <span>{{ $t('task.new-task') }}</span>
          </div></el-button>
          <el-button @click="onResumeAllClick"><div class="flex items-center justify-center">
            <i class="task-action">
                  <mo-icon name="task-play" width="15" height="15" />
              </i>
              <span>{{ $t('task.task-all-start') }}</span>
          </div></el-button>
          <el-button @click="onPauseAllClick"><div class="flex items-center justify-center">
            <i class="task-action">
                  <mo-icon name="task-pause" width="15" height="15" />
              </i>
              <span>{{ $t('task.task-all-stop') }}</span>
          </div></el-button>
          <li
            v-if="currentList === 'active'"
            class="post-download-action-group"
          >
            <span class="post-download-action-title">{{ $t('task.post-download-action-menu') }}</span>
            <el-dropdown
              class="post-download-action-dropdown"
              trigger="click"
              @command="onPostDownloadActionCommand"
            >
            <el-button class="post-download-action-trigger" size="small">
              <span class="post-download-action-label">{{ postDownloadActionButtonLabel }}</span>
              <el-icon class="el-icon--right post-download-action-caret"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in postDownloadActionOptions"
                  :key="opt.value"
                  :command="opt.value"
                >
                  <span v-if="onCompleteAction === opt.value" class="post-download-check">✓ </span>{{ opt.label }}
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          </li>
          <mo-batch-delete-task-btn v-if="selectedTaskKeyListCount > 1"/>
          <!-- <li @click="onResumeAllClick" class="task-action-start">
              <i class="task-action">
                  <mo-icon name="task-play" width="15" height="15" />
              </i>
              <span>{{ $t('task.task-all-start') }}</span>
          </li> -->
          <!-- <li @click="onPauseAllClick" class="task-action-stop">
              <i class="task-action">
                  <mo-icon name="task-pause" width="15" height="15" />
              </i>
              <span>{{ $t('task.task-all-stop') }}</span>
          </li> -->
        </ul>
    </div>
</template>

<script>
import { mapState } from 'vuex'
import { useI18n } from 'vue-i18n'
import { ArrowDown } from '@element-plus/icons-vue'
import { ADD_TASK_TYPE, POST_DOWNLOAD_ACTION } from '@shared/constants'
import BatchDeleteTaskBtn from '@/components/Task/BatchDeleteTaskBtn.vue'
import '@/components/Icons/task-add'
import '@/components/Icons/task-pause'
import '@/components/Icons/task-play'
export default {
  name: 'state-task-actions',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  components: {
    ArrowDown,
    [BatchDeleteTaskBtn.name]: BatchDeleteTaskBtn
  },
  props: ['task'],
  data () {
    return {
      refreshing: false
    }
  },
  computed: {
    ...mapState('task', {
      currentList: state => state.currentList,
      onCompleteAction: state => state.onCompleteAction,
      selectedTaskKeyListCount: state => state.selectedTaskKeyList.length
    }),
    postDownloadActionOptions () {
      return [
        { value: POST_DOWNLOAD_ACTION.NONE, label: this.t('task.post-download-action-none') },
        { value: POST_DOWNLOAD_ACTION.SHUTDOWN, label: this.t('task.post-download-action-shutdown') },
        { value: POST_DOWNLOAD_ACTION.SLEEP, label: this.t('task.post-download-action-sleep') },
        { value: POST_DOWNLOAD_ACTION.QUIT, label: this.t('task.post-download-action-quit') }
      ]
    },
    postDownloadActionButtonLabel () {
      const cur = this.postDownloadActionOptions.find((o) => o.value === this.onCompleteAction)
      return cur ? cur.label : this.t('task.post-download-action-none')
    }
  },
  methods: {
    onNewTaskClick () {
      this.$store.dispatch('app/showAddTaskDialog', ADD_TASK_TYPE.URI)
    },
    onResumeAllClick () {
      this.$store.dispatch('task/resumeAllTask')
        .then(() => {
          // this.$msg.success(this.$t('task.resume-all-task-success'))
        })
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.t('task.resume-all-task-fail'))
          }
        })
    },
    onPauseAllClick () {
      this.$store.dispatch('task/pauseAllTask')
        .then(() => {
          // this.$msg.success(this.$t('task.pause-all-task-success'))
        })
        .catch(({ code }) => {
          if (code === 1) {
            this.$msg.error(this.t('task.pause-all-task-fail'))
          }
        })
    },
    onPostDownloadActionCommand (command) {
      this.$store.dispatch('task/setOnCompleteAction', command)
    },
    onRefreshClick () {
      this.refreshSpin()
      this.$store.dispatch('task/fetchList')
    },
    refreshSpin () {
      this.refreshTimerId && clearTimeout(this.refreshTimerId)

      this.refreshing = true
      this.refreshTimerId = setTimeout(() => {
        this.refreshing = false
      }, 500)
    }
  }
}
</script>

<style lang="scss">
.task-state-actions {
    position: relative;
    display: inline-flex;
    top: auto;
    right: auto;
    min-height: 50px;
    height: auto;
    padding: 4px 0;
    overflow: visible;
    user-select: none;
    text-align: center;
    align-items: center;
    justify-content: center;
    cursor: default;
    transition: all 0.25s;

    .task-state-ul {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        .post-download-action-group {
            display: inline-flex;
            align-items: stretch;
            flex-shrink: 0;
            margin-left: 12px;
            margin-right: 6px;
            list-style: none;
            border: 1px solid var(--el-border-color);
            border-radius: var(--el-border-radius-base);
            background-color: var(--el-fill-color-blank);
            overflow: hidden;
            box-sizing: border-box;
            min-height: 25px;
        }
        .post-download-action-title {
            display: inline-flex;
            align-items: center;
            flex-shrink: 0;
            padding: 0 8px;
            font-size: 12px;
            line-height: 1;
            color: var(--el-text-color-regular);
            white-space: nowrap;
            border-right: 1px solid var(--el-border-color);
            background-color: var(--el-fill-color-light);
        }
        .post-download-action-dropdown {
            display: inline-flex;
            align-items: stretch;
        }
        .post-download-action-dropdown .post-download-action-trigger {
            margin: 0;
            height: auto;
            min-height: 100%;
            min-height: 25px;
            padding: 5px 8px;
            font-size: 12px;
            border: none;
            border-radius: 0;
            box-shadow: none;
            background-color: transparent;
        }
        .post-download-action-caret {
            font-size: 12px;
        }
        .post-download-action-dropdown .post-download-action-trigger:hover,
        .post-download-action-dropdown .post-download-action-trigger:focus {
            background-color: var(--el-fill-color-light);
        }
        .task-action-start {
            display: inline-flex;
            padding: 10px;
            margin: 0 10px;
            color: #fff;
            align-items: center;
            justify-content: center;
            .task-action {
                font-size: 0;
                cursor: pointer;
                margin: 0 10px;
            }
        }
        .task-action-stop {
            display: inline-flex;
            padding: 10px;
            color: #fff;
            align-items: center;
            justify-content: center;
            .task-action {
                font-size: 0;
                cursor: pointer;
                margin: 0 10px;
            }
        }
    }
}
.theme-dark {
  .refresh_btn svg{
    &:hover {
      color: $--color-primary-light-4;
    }
  }
  /* 与 .theme-dark .el-button 一致（见 Theme/Dark.scss） */
  .task-state-actions .post-download-action-group {
    border: 1px solid #333;
    background-color: $--dk--background-color-gray;
  }
  .task-state-actions .post-download-action-title {
    color: #aaa;
    border-right-color: #333;
    background-color: $--dk--background-color-gray;
  }
  .task-state-actions .post-download-action-dropdown .post-download-action-trigger {
    color: #aaa;
    background-color: transparent;
    &:hover,
    &:focus {
      color: $--color-primary-light-4;
      background-color: #333;
      border: none;
    }
    .post-download-action-caret {
      color: inherit;
    }
  }
  .task-state-actions .post-download-action-dropdown .post-download-action-trigger:hover .post-download-action-caret,
  .task-state-actions .post-download-action-dropdown .post-download-action-trigger:focus .post-download-action-caret {
    color: $--color-primary-light-4;
  }
}
</style>
