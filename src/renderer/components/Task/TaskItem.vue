<template>
  <div
    :key="task.taskKey"
    class="task-item task-item--table"
    v-on:dblclick="onDbClick"
    :style="taskRowProgressStyle"
  >
    <div class="task-item-cell task-item-cell--check" @click.stop>
      <el-checkbox :model-value="selectedTaskKeyList.includes(task.taskKey)" />
    </div>
    <div class="task-item-cell task-item-cell--name">
      <div class="task-name" :title="taskFullName">
        <span>{{ taskFullName }}</span>
      </div>
    </div>
    <div class="task-item-cell task-item-cell--connections" :title="String(connectionCount)">
      {{ connectionCount }}
    </div>
    <div class="task-item-cell task-item-cell--size">
      <template v-if="task.completedLength > 0 || task.totalLength > 0">
        <span>{{ bytesToSize(task.completedLength, 2) }}</span>
        <span v-if="task.totalLength > 0"> / {{ bytesToSize(task.totalLength, 2) }}</span>
      </template>
      <template v-else>—</template>
    </div>
    <div class="task-item-cell task-item-cell--speed" :title="speedText">
      {{ speedText }}
    </div>
    <div class="task-item-cell task-item-cell--actions" @click.stop>
      <mo-task-item-actions mode="LIST" :task="task" />
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { useI18n } from 'vue-i18n'
import { bytesToSize, calcProgress, checkTaskIsSeeder, getTaskListDisplaySpeed, getTaskName } from '@shared/utils'
import { TASK_STATUS } from '@shared/constants'
import { openItem, getTaskFullPath } from '@/utils/native'
import TaskItemActions from './TaskItemActions'
export default {
  name: 'mo-task-item',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  components: {
    [TaskItemActions.name]: TaskItemActions
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
        defaultName: this.t('task.get-task-name'),
        maxLen: -1
      })
    },
    taskName () {
      return getTaskName(this.task, {
        defaultName: this.t('task.get-task-name')
      })
    },
    isSeeder () {
      return checkTaskIsSeeder(this.task)
    },
    rowProgressPercent () {
      const { task, isSeeder } = this
      const { COMPLETE } = TASK_STATUS
      if (task.status === COMPLETE || isSeeder) {
        return 100
      }
      return calcProgress(task.totalLength, task.completedLength)
    },
    taskRowProgressStyle () {
      const p = Math.min(100, Math.max(0, this.rowProgressPercent))
      return { '--task-row-progress': `${p}%` }
    },
    connectionCount () {
      return Number(this.task.connections) || 0
    },
    speedText () {
      return `${this.bytesToSize(getTaskListDisplaySpeed(this.task), 2)}/s`
    }
  },
  methods: {
    bytesToSize (v, p) {
      return bytesToSize(v, p)
    },
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
      this.$msg.info(this.t('task.opening-task-message', { taskName }))
      const fullPath = getTaskFullPath(this.task)
      const result = await openItem(fullPath)
      if (result) {
        this.$msg.error(this.t('task.file-not-exist'))
      }
    },
    toggleTask () {
      this.$store.dispatch('task/toggleTask', this.task)
    }
  }
}
</script>

<style lang="scss">
.task-item {
  position: relative;
  min-height: 64px;
  padding: 12px 12px;
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
  margin-bottom: 1rem;
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
  margin-bottom: 1rem;
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
