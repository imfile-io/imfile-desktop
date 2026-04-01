<template>
  <el-row class="w-1/2 task-progress-info">
    <el-col
      class="task-progress-info-left"
      :xs="12"
      :sm="7"
      :md="6"
      :lg="6"
    >
    <div class="task-speed-info" v-if="isActive">
        <div class="task-speed-text">
          <i><mo-icon name="arrow-up" width="10" height="14" /></i>
          <span>{{ bytesToSize(task.uploadSpeed) }}/s</span>
        </div>
        <div class="task-speed-text">
          <i><mo-icon name="arrow-down" width="10" height="14" /></i>
          <span>{{ bytesToSize(task.downloadSpeed) }}/s</span>
        </div>
        <div class="task-speed-text hidden-sm-and-down" v-if="remaining > 0">
          <span class="remaining-label-value">
            {{ $t('task.remaining-prefix') }}
            {{
              timeFormat(remaining, {
                i18n: {
                  'gt1d': $t('app.gt1d'),
                  'hour': $t('app.hour'),
                  'minute': $t('app.minute'),
                  'second': $t('app.second')
                }
              })
            }}
          </span>
        </div>
        <div class="task-speed-text hidden-sm-and-down" v-if="isBT">
          <i><mo-icon name="magnet" width="10" height="14" /></i>
          <span>{{ task.numSeeders }}</span>
        </div>
        <div class="task-speed-text hidden-sm-and-down">
          <i><mo-icon name="node" width="10" height="14" /></i>
          <span>{{ task.connections }}</span>
        </div>
      </div>
    </el-col>
    <el-col
      class="task-progress-info-right"
    >
    </el-col>
  </el-row>
</template>

<script>
  import {
    bytesToSize,
    checkTaskIsBT,
    checkTaskIsSeeder,
    timeFormat,
    timeRemaining
  } from '@shared/utils'
  import { TASK_STATUS } from '@shared/constants'
  import '@/components/Icons/arrow-up'
  import '@/components/Icons/arrow-down'
  import '@/components/Icons/node'
  import '@/components/Icons/magnet'

  export default {
    name: 'mo-task-progress-info',
    props: {
      task: {
        type: Object
      }
    },
    computed: {
      isActive () {
        return this.task.status === TASK_STATUS.ACTIVE
      },
      isBT () {
        return checkTaskIsBT(this.task)
      },
      isSeeder () {
        return checkTaskIsSeeder(this.task)
      },
      remaining () {
        const { totalLength, completedLength, downloadSpeed } = this.task
        return timeRemaining(totalLength, completedLength, downloadSpeed)
      }
    },
    methods: {
      bytesToSize,
      timeFormat
    }
  }
</script>

<style lang="scss">
.task-speed-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  font-size: 0.75rem;
  color: #9B9B9B;
  width: 100%;

  & > .task-speed-text {
    margin-left: 0;
    margin-bottom: 0.375rem;
    font-size: 0.75rem;
    line-height: 0.875rem;
    display: flex;
    align-items: center;
    width: 100%;

    &:last-of-type {
      margin-bottom: 0;
    }
    & > i {
      margin-right: 0.125rem;
    }
  }
}

.remaining-label-value {
  white-space: nowrap;
}

.task-progress-info-left {
  min-height: 0.875rem;
  text-align: left;
}
</style>
