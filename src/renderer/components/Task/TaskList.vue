<template>
  <!-- <mo-drag-select
    class="task-list"
    v-if="taskList.length > 0"
    attribute="attr"
    @change="handleDragSelectChange"
  > -->
  <div v-if="taskList.length > 0" class="mx-4 task-list-root">
    <div v-if="filteredTaskList.length > 0">
      <div
        v-for="item in filteredTaskList"
        :key="item.taskKey"
        :attr="item.taskKey"
        :class="getItemClass(item)"
        @click="() => selectData(item.taskKey)"
      >
        <mo-task-item
          :task="item"
        />
      </div>
    </div>
    <div v-else class="search-no-match">
      {{ $t('task.search-no-match') }}
    </div>
  </div>
  <!-- </mo-drag-select> -->
  <div class="no-task" v-else>
    <div class="no-task-inner">
      {{ $t('task.no-task') }}
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { cloneDeep, pull } from 'lodash'
import { getTaskName } from '@shared/utils'
import DragSelect from '@/components/DragSelect/Index'
import TaskItem from './TaskItem'

export default {
  name: 'mo-task-list',
  components: {
    [DragSelect.name]: DragSelect,
    [TaskItem.name]: TaskItem
  },
  props: {
    searchQuery: {
      type: String,
      default: ''
    }
  },
  data () {
    const selectedList = cloneDeep(this.$store.state.task.selectedList) || []
    return {
      selectedList
    }
  },
  computed: {
    ...mapState('task', {
      taskList: state => state.taskList,
      selectedTaskKeyList: state => state.selectedTaskKeyList
    }),
    filteredTaskList () {
      const q = this.searchQuery.trim().toLowerCase()
      if (!q) {
        return this.taskList
      }
      const defaultName = this.$t('task.get-task-name')
      return this.taskList.filter((task) => {
        const name = getTaskName(task, {
          defaultName,
          maxLen: -1
        })
        return name.toLowerCase().includes(q)
      })
    }
  },
  methods: {
    selectData (taskKey) {
      const selectedTaskKeyList = this.$store.state.task.selectedTaskKeyList
      if (selectedTaskKeyList.includes(taskKey)) {
        this.$store.dispatch('task/selectTasks', pull(selectedTaskKeyList, taskKey))
      } else {
        this.$store.dispatch('task/selectTasks', selectedTaskKeyList.concat(taskKey))
      }
    },
    handleDragSelectChange (selectedList) {
      this.selectedList = selectedList
      this.$store.dispatch('task/selectTasks', cloneDeep(selectedList))
    },
    getItemClass (item) {
      const isSelected = this.selectedList.includes(item.taskKey)
      return {
        selected: isSelected
      }
    }
  },
  watch: {
    selectedTaskKeyList (newVal) {
      this.selectedList = newVal
    }
  }
}
</script>

<style lang="scss">
.task-list {
  padding: 16px 16px 64px;
  min-height: 100%;
  box-sizing: border-box;
}
.search-no-match {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  font-size: 14px;
  color: #555;
  user-select: none;
}
.no-task {
  display: flex;
  height: 80%;
  text-align: center;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: #555;
  user-select: none;
}
.no-task-inner {
  width: 100%;
  padding-top: 160px;
  background: transparent url('~@/assets/no-task.svg') center no-repeat;
}
</style>
