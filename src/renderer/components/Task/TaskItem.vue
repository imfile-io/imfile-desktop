<template>
  <div :key="task.taskKey" class="task-item" v-on:dblclick="onDbClick">
    <el-row type="flex">
      <el-col :span="2">
        <div class="flex items-center justify-center h-full"><el-checkbox :value="selectedTaskKeyList.includes(task.taskKey)"></el-checkbox></div>
      </el-col>
      <el-col :span="22">
        <el-row>
          <el-col :span="16">
            <div class="task-name" :title="taskFullName">
              <span>{{ taskFullName }}</span>
            </div>
          </el-col>
          <el-col :span="8">
            <div
              v-if="task.completedLength > 0 || task.totalLength > 0"
              class="task-progress-num"
            >
              <span>{{ task.completedLength | bytesToSize(2) }}</span>
              <span v-if="task.totalLength > 0">
                / {{ task.totalLength | bytesToSize(2) }}</span
              >
            </div>
          </el-col>
        </el-row>
        <div class="task-progress">
          <mo-task-progress
            :completed="Number(task.completedLength)"
            :total="Number(task.totalLength)"
            :status="taskStatus"
          />
        </div>
        <div class="flex flex-row justify-between mt-2">
          <mo-task-progress-info :task="task" />
          <mo-task-item-actions mode="LIST" :task="task" />
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script>
  import { mapState } from 'vuex'
  import { bytesToSize, checkTaskIsSeeder, getTaskName } from '@shared/utils'
  import { TASK_STATUS } from '@shared/constants'
  import { openItem, getTaskFullPath } from '@/utils/native'
  import TaskItemActions from './TaskItemActions'
  import TaskProgress from './TaskProgress'
  import TaskProgressInfo from './TaskProgressInfo'

  export default {
    name: 'mo-task-item',
    components: {
      [TaskItemActions.name]: TaskItemActions,
      [TaskProgress.name]: TaskProgress,
      [TaskProgressInfo.name]: TaskProgressInfo
    },
    props: {
      task: {
        type: Object
      }
    },
    computed: {
      ...mapState('task', {
        selectedTaskKeyList: state => state.selectedTaskKeyList
      }),
      taskFullName () {
        return getTaskName(this.task, {
          defaultName: this.$t('task.get-task-name'),
          maxLen: -1
        })
      },
      taskName () {
        return getTaskName(this.task, {
          defaultName: this.$t('task.get-task-name')
        })
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
      }
    },
    methods: {
      onDbClick () {
        const { status } = this.task
        const { COMPLETE, WAITING, PAUSED } = TASK_STATUS
        if (status === COMPLETE) {
          this.openTask()
        } else if ([WAITING, PAUSED].includes(status) !== -1) {
          this.toggleTask()
        }
      },
      async openTask () {
        const { taskName } = this
        this.$msg.info(this.$t('task.opening-task-message', { taskName }))
        const fullPath = getTaskFullPath(this.task)
        const result = await openItem(fullPath)
        if (result) {
          this.$msg.error(this.$t('task.file-not-exist'))
        }
      },
      toggleTask () {
        this.$store.dispatch('task/toggleTask', this.task)
      }
    },
    filters: {
      bytesToSize
    }
  }
</script>

<style lang="scss">
.task-item {
  position: relative;
  min-height: 80px;
  padding: 16px 12px;
  background-color: $--background-color-gray;
  border: 2px solid $--background-color-gray;
  border-radius: 0px;
  margin-bottom: 16px;
  transition: $--border-transition-base;
  &:hover {
    border-color: $--task-item-hover-border-color;
  }
  .el-checkbox__inner{
    border-color: $--task-item-action-color;
    background-color: $--task-item-action-color;
  }
}
.selected .task-item {
  border-color: $--task-item-hover-border-color;
}
.task-name {
  color: $--color-black;
  margin-bottom: 1.5rem;
  word-break: break-all;
  min-height: 26px;
  & > span {
    font-size: 14px;
    line-height: 26px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
.task-progress-num {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1.5rem;
  min-height: 26px;
  & > span {
    font-size: 14px;
    line-height: 26px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
/* .task-item-actions {
  position: absolute;
  bottom: 0px;
  right: 12px;
} */
.theme-dark {
  .task-item {
    background-color: $--task-item-background;
    border: 2px solid $--task-item-border-color;
    &:hover {
      border-color: $--task-item-hover-border-color;
    }
    .el-checkbox__inner{
      border-color: $--dk-task-item-action-background;
      background-color: $--dk-task-item-action-background;
    }
  }
  .selected .task-item {
    border-color: $--task-item-hover-border-color;
  }
  .task-name, .task-progress-num  {
    color: $--dk-aside-text-color;
  }
}
</style>
