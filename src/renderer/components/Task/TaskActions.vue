<template>
  <div class="task-actions">
    <ul class="task-ul">
      <li class="task-action" @click="onRefreshClick">
        <mo-icon name="refresh" width="30" height="30" :spin="refreshing" />
      </li>
      <!-- <li class="task-action" @click="onResumeAllClick">
        <mo-icon name="search" width="30" height="30" />
      </li> -->
      <li @click="onAddClick()" class="task-action-add">
        <i class="task-action">
          <mo-icon name="task-add" width="8" height="8" />
        </i>
        <span>{{$t('task.task-add') }}</span>
      </li>
    </ul>

    <!-- <el-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.refresh-list')"
    >
      <i class="task-action" @click="onRefreshClick">
        <mo-icon name="refresh" width="30" height="30" :spin="refreshing" />
      </i>
    </el-tooltip>
    <el-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.resume-all-task')"
    >
      <i class="task-action" @click="onResumeAllClick">
        <mo-icon name="search" width="30" height="30" />
      </i>
    </el-tooltip>
    <el-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.pause-all-task')"
    >
      <i class="task-action" @click="onPauseAllClick">
        <mo-icon name="task-pause-line" width="30" height="30" />
      </i>
      <span>{{ $t('preferences.basic') }}</span>
    </el-tooltip> -->

    <!-- <el-tooltip
      class="item"
      effect="dark"
      placement="bottom"
      :content="$t('task.purge-record')"
      v-if="currentList === 'stopped'"
    >
      <i class="task-action" @click="onPurgeRecordClick">
        <mo-icon name="purge" width="30" height="30" />
      </i>
    </el-tooltip> -->
  </div>
</template>

<script>
  import { mapState } from 'vuex'

  import { commands } from '@/components/CommandManager/instance'
  import { ADD_TASK_TYPE } from '@shared/constants'
  import { bytesToSize, timeFormat } from '@shared/utils'
  import '@/components/Icons/menu-add'
  import '@/components/Icons/refresh'
  import '@/components/Icons/task-start-line'
  import '@/components/Icons/task-pause-line'
  import '@/components/Icons/search'
  import '@/components/Icons/delete'
  import '@/components/Icons/purge'
  import '@/components/Icons/more'
  import '@/components/Icons/task-add'

  export default {
    name: 'mo-task-actions',
    components: {
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
    filters: {
      bytesToSize,
      timeFormat
    },
    methods: {
      refreshSpin () {
        this.t && clearTimeout(this.t)

        this.refreshing = true
        this.t = setTimeout(() => {
          this.refreshing = false
        }, 500)
      },
      onBatchDeleteClick (event) {
        const deleteWithFiles = !!event.shiftKey
        commands.emit('batch-delete-task', { deleteWithFiles })
      },
      onRefreshClick () {
        this.refreshSpin()
        this.$store.dispatch('task/fetchList')
      },
      onResumeAllClick () {
        this.$store.dispatch('task/resumeAllTask')
          .then(() => {
            // this.$msg.success(this.$t('task.resume-all-task-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.resume-all-task-fail'))
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
              this.$msg.error(this.$t('task.pause-all-task-fail'))
            }
          })
      },
      onPurgeRecordClick () {
        this.$store.dispatch('task/purgeTaskRecord')
          .then(() => {
            this.$msg.success(this.$t('task.purge-record-success'))
          })
          .catch(({ code }) => {
            if (code === 1) {
              this.$msg.error(this.$t('task.purge-record-fail'))
            }
          })
      },
      onAddClick () {
        this.$store.dispatch('app/showAddTaskDialog', ADD_TASK_TYPE.URI)
      }
    }
  }
</script>

<style lang="scss">
.task-actions {
  position: absolute;
  display: inline-flex;
  top: 32px;
  right: 0;
  height: 50px;
  padding: 0;
  overflow: hidden;
  user-select: none;
  text-align: center;
  align-items: center;
  justify-content: center;
  cursor: default;
  transition: all 0.25s;

  .task-ul {
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .task-action {
      display: inline-flex;
      margin: 0 15px;
      font-size: 0;
      align-items: center;
      justify-content: center;
    }

    .task-action-add {
      display: inline-flex;
      padding: 10px;

      background: #0075FF;
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

}</style>
