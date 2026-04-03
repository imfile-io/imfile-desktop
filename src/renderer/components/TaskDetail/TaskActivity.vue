<template>
  <el-form
    class="mo-task-activity"
    ref="form"
    :model="form"
    :label-width="formLabelWidth"
    v-if="task"
  >
    <!-- <div class="graphic-box" ref="graphicBox">
      <mo-task-graphic
        :outerWidth="graphicWidth"
        :bitfield="task.bitfield"
        v-if="graphicWidth > 0"
      />
    </div> -->
    <el-form-item :label="`${$t('task.task-progress-info')}: `">
      <div class="form-static-value form-static-value--progress">
        <div class="task-progress-row">
          <div class="progress-wrapper">
            <mo-task-progress
              :completed="Number(task.completedLength)"
              :total="Number(task.totalLength)"
              :status="taskStatus"
            />
          </div>
          <div class="task-progress-percent">{{ percent }}</div>
        </div>
      </div>
    </el-form-item>
    <el-form-item>
      <div class="form-static-value">
        <span>{{ bytesToSize(task.completedLength, 2) }}</span>
        <span v-if="task.totalLength > 0"> / {{ bytesToSize(task.totalLength, 2) }}</span>
        <span class="task-time-remaining" v-if="isActive && remaining > 0">
          {{
            timeFormat(remaining, {
              prefix: $t('task.remaining-prefix'),
              i18n: {
                gt1d: $t('app.gt1d'),
                hour: $t('app.hour'),
                minute: $t('app.minute'),
                second: $t('app.second')
              }
            })
          }}
        </span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-num-seeders')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ task.numSeeders }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-connections')}: `">
      <div class="form-static-value">
        {{ task.connections }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-download-speed')}: `">
      <div class="form-static-value">
        <span>{{ bytesToSize(task.downloadSpeed) }}/s</span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-upload-speed')}: `" v-if="isBT">
      <div class="form-static-value">
        <span>{{ bytesToSize(task.uploadSpeed) }}/s</span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-upload-length')}: `" v-if="isBT">
      <div class="form-static-value">
        <span>{{ bytesToSize(task.uploadLength) }}</span>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-ratio')}: `" v-if="isBT">
      <div class="form-static-value">
        {{ ratio }}
      </div>
    </el-form-item>
  </el-form>
</template>

<script>
import is from 'electron-is'
import {
  bytesToSize,
  calcFormLabelWidth,
  calcProgress,
  calcRatio,
  checkTaskIsBT,
  checkTaskIsSeeder,
  timeFormat,
  timeRemaining
} from '@shared/utils'
import { TASK_STATUS } from '@shared/constants'
import TaskGraphic from '@/components/TaskGraphic/Index'
import TaskProgress from '@/components/Task/TaskProgress'

export default {
  name: 'mo-task-activity',
  components: {
    [TaskGraphic.name]: TaskGraphic,
    [TaskProgress.name]: TaskProgress
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
    isActive () {
      return this.taskStatus === TASK_STATUS.ACTIVE
    },
    percent () {
      const { totalLength, completedLength } = this.task
      const percent = calcProgress(totalLength, completedLength)
      return `${percent}%`
    },
    remaining () {
      const { totalLength, completedLength, downloadSpeed } = this.task
      return timeRemaining(totalLength, completedLength, downloadSpeed)
    },
    ratio () {
      if (!this.isBT) {
        return 0
      }

      const { totalLength, uploadLength } = this.task
      const ratio = calcRatio(totalLength, uploadLength)
      return ratio
    }
  },
  mounted () {
    setImmediate(() => {
      this.updateGraphicWidth()
    })
  },
  methods: {
    bytesToSize,
    timeFormat,
    updateGraphicWidth () {
      if (!this.$refs.graphicBox) {
        return
      }
      this.graphicWidth = this.calcInnerWidth(this.$refs.graphicBox)
    },
    calcInnerWidth (ele) {
      if (!ele) {
        return 0
      }

      const style = getComputedStyle(ele, null)
      const width = parseInt(style.width, 10)
      const paddingLeft = parseInt(style.paddingLeft, 10)
      const paddingRight = parseInt(style.paddingRight, 10)
      return width - paddingLeft - paddingRight
    }
  }
}
</script>

<style lang="scss">
.task-progress-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  min-width: 0;
}

.progress-wrapper {
  flex: 1;
  min-width: 0;
  padding: 0.6875rem 0 0 0;
}

.task-progress-percent {
  flex-shrink: 0;
  white-space: nowrap;
  padding-top: 0.6875rem;
  line-height: 1.25;
  min-width: 3.25rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.task-time-remaining {
  margin-left: 1rem;
}
.mo-task-activity{
  .el-form-item__label{
    color: var(--im-task-detail-label);
  }
  .form-static-value{
    color: var(--im-task-detail-value);
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  .el-form-item__content {
    flex: 1;
    min-width: 0;
    max-width: 100%;
  }
}
</style>
