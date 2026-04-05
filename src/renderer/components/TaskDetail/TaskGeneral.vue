<template>
  <el-form
    class="mo-task-general"
    ref="form"
    :model="form"
    :label-width="formLabelWidth"
    v-if="task"
  >
    <el-form-item :label="`${$t('task.task-gid')} `">
      <div class="form-static-value">
        {{ task.id || task.gid }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-name')} `">
      <div class="form-static-value">
        {{ taskFullName }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-dir')} `">
      <el-input placeholder="" readonly v-model="path">
        <template v-slot:append>
<mo-show-in-folder

          v-if="isRenderer"
          :path="path"
        />
</template>
      </el-input>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-status')} `">
      <div class="form-static-value">
        {{ taskStatus && taskStatus.toUpperCase() }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-error-info')} `" v-if="task.errorCode && task.errorCode !== '0'">
      <div class="form-static-value">
        {{ task.errorCode }} {{ task.errorMessage }}
      </div>
    </el-form-item>

    <!-- <el-divider v-if="isBT">
      <i class="el-icon-attract"></i>
      {{ $t('task.task-bittorrent-info') }}
    </el-divider> -->

    <el-form-item :label="`${$t('task.task-bittorrent-info')} `" v-if="isBT">
    </el-form-item>

    <el-form-item :label="`${$t('task.task-info-hash')} `" v-if="isBT">
      <div class="form-static-value">
        {{ task.infoHash }}
        <i class="copy-link" @click="handleCopyClick">
          <mo-icon
            name="link"
            width="12"
            height="12"
          />
        </i>
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-piece-length')} `" v-if="isBT">
      <div class="form-static-value">
        {{ bytesToSize(task.pieceLength) }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-num-pieces')} `" v-if="isBT">
      <div class="form-static-value">
        {{ btNumPiecesDisplay }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-bittorrent-creation-date')} `" v-if="isBT">
      <div class="form-static-value">
        {{ localeDateTimeFormat(task.bittorrent.creationDate, locale) }}
      </div>
    </el-form-item>
    <el-form-item :label="`${$t('task.task-bittorrent-comment')} `" v-if="isBT">
      <div class="form-static-value">
        {{ task.bittorrent.comment }}
      </div>
    </el-form-item>
  </el-form>
</template>

<script>
import is from 'electron-is'
import { mapState } from 'vuex'
import { useI18n } from 'vue-i18n'
import {
  bytesToSize,
  calcFormLabelWidth,
  checkTaskIsBT,
  checkTaskIsSeeder,
  getTaskName,
  getTaskNumPieces,
  getTaskUri,
  localeDateTimeFormat
} from '@shared/utils'
import { APP_THEME, TASK_STATUS } from '@shared/constants'
import { getTaskFullPath } from '@/utils/native'
import ShowInFolder from '@/components/Native/ShowInFolder'
import TaskStatus from '@/components/Task/TaskStatus'
import '@/components/Icons/folder'
import '@/components/Icons/link'

export default {
  name: 'mo-task-general',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  components: {
    [ShowInFolder.name]: ShowInFolder,
    [TaskStatus.name]: TaskStatus
  },
  props: {
    task: {
      type: Object
    }
  },
  data () {
    const { locale } = this.$store.state.preference.config
    return {
      form: {},
      formLabelWidth: calcFormLabelWidth(locale),
      locale
    }
  },
  computed: {
    isRenderer: () => is.renderer(),
    ...mapState('app', {
      systemTheme: state => state.systemTheme
    }),
    ...mapState('preference', {
      theme: state => state.config.theme
    }),
    currentTheme () {
      if (this.theme === APP_THEME.AUTO) {
        return this.systemTheme
      } else {
        return this.theme
      }
    },
    taskFullName () {
      return getTaskName(this.task, {
        defaultName: this.t('task.get-task-name'),
        maxLen: -1
      })
    },
    taskName () {
      return getTaskName(this.task, {
        defaultName: this.t('task.get-task-name'),
        maxLen: 32
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
    },
    path () {
      return getTaskFullPath(this.task)
    },
    isBT () {
      return checkTaskIsBT(this.task)
    },
    /** 引擎未返回 numPieces 时用 totalLength/pieceLength 推算，避免详情里只有分片大小、数量空白 */
    btNumPiecesDisplay () {
      const n = getTaskNumPieces(this.task)
      return n != null ? n : '—'
    }
  },
  methods: {
    bytesToSize,
    localeDateTimeFormat,
    handleCopyClick () {
      const { task } = this
      const uri = getTaskUri(task)
      navigator.clipboard.writeText(uri)
        .then(() => {
          this.$msg.success(this.t('task.copy-link-success'))
        })
    }
  }
}
</script>

<style lang="scss">
.copy-link {
  cursor: pointer;
}
.mo-task-general {
  .el-form-item__label {
    color: var(--im-task-detail-label);
  }
  .form-static-value {
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
  .el-input__inner::placeholder {
    color: var(--im-input-placeholder) !important;
  }
  .el-input__wrapper {
    background-color: var(--im-input-bg) !important;
    box-shadow: 0 0 0 1px var(--im-input-border) inset !important;
  }
  .el-input__inner {
    color: var(--im-input-text) !important;
    -webkit-text-fill-color: var(--im-input-text) !important;
  }
  .el-input-group__append {
    border-color: var(--im-input-border) !important;
    background: var(--im-input-bg) !important;
    color: var(--im-input-text) !important;
    margin: 0 !important;
    padding: 0 !important;
  }
}
</style>
