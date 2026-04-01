<template>
  <el-button @click="onBatchDeleteClick">
    <div class="flex items-center justify-center">
      <i class="task-action">
        <mo-icon name="delete" width="15" height="15" />
      </i>
      <span>{{ $t('task.delete-task') }}</span>
    </div>
  </el-button>
</template>

<script>
import { commands } from '@/components/CommandManager/instance'
export default {
  name: 'mo-batch-delete-task-btn',
  data () {
    return {}
  },
  computed: {},
  methods: {
    onBatchDeleteClick (event) {
      const deleteWithFiles = !!event.shiftKey
      commands.emit('batch-delete-task', { deleteWithFiles })
    }
  }
}
</script>
