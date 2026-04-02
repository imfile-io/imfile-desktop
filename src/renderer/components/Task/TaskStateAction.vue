<template>
    <div class="task-state-actions">
        <ul class="task-state-ul">
          <li @click="onRefreshClick" class="mr-2 refresh_btn">
            <mo-icon name="refresh" width="30" height="30" :spin="refreshing" />
          </li>
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
import BatchDeleteTaskBtn from '@/components/Task/BatchDeleteTaskBtn.vue'
import '@/components/Icons/task-pause'
import '@/components/Icons/task-play'
export default {
  name: 'state-task-actions',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  components: {
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
      selectedTaskKeyListCount: state => state.selectedTaskKeyList.length
    })
  },
  methods: {
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
    height: 50px;
    padding: 0;
    overflow: hidden;
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
}
</style>
