<template>
  <!-- 占位节点，不参与渲染 -->
  <!-- eslint-disable-next-line vue/no-constant-condition -->
  <div v-if="false"></div>
</template>

<script>
import { ADD_TASK_TYPE } from '@shared/constants'
import { useI18n } from 'vue-i18n'

export default {
  name: 'mo-dragger',
  setup () {
    const { t } = useI18n()
    return { t }
  },
  mounted () {
    this.preventDefault = ev => ev.preventDefault()
    let count = 0
    this.onDragEnter = (ev) => {
      if (count === 0) {
        this.$store.dispatch('app/showAddTaskDialog', ADD_TASK_TYPE.TORRENT)
      }
      count++
    }

    this.onDragLeave = (ev) => {
      count--
      if (count === 0) {
        this.$store.dispatch('app/hideAddTaskDialog')
      }
    }

    this.onDrop = (ev) => {
      count = 0

      const fileList = [...ev.dataTransfer.files]
        .map(item => ({ raw: item, name: item.name }))
        .filter(item => /\.torrent$/.test(item.name))
      if (!fileList.length) {
        this.$msg.error(this.t('task.select-torrent'))
      }
    }

    document.addEventListener('dragover', this.preventDefault)
    document.body.addEventListener('dragenter', this.onDragEnter)
    document.body.addEventListener('dragleave', this.onDragLeave)
    document.body.addEventListener('drop', this.onDrop)
  },
  unmounted () {
    document.removeEventListener('dragover', this.preventDefault)
    document.body.removeEventListener('dragenter', this.onDragEnter)
    document.body.removeEventListener('dragleave', this.onDragLeave)
    document.body.removeEventListener('drop', this.onDrop)
  }
}
</script>
