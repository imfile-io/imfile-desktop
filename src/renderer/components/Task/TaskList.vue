<template>
  <!-- <mo-drag-select
    class="task-list"
    v-if="taskList.length > 0"
    attribute="attr"
    @change="handleDragSelectChange"
  > -->
  <div v-if="taskList.length > 0" class="mx-4">
    <div
      v-for="item in taskList"
      :key="item.gid"
      :attr="item.gid"
      :class="getItemClass(item)"
      @click="()=>selectData(item.gid)"
    >
      <mo-task-item
        :task="item"
      />
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
  import DragSelect from '@/components/DragSelect/Index'
  import TaskItem from './TaskItem'

  export default {
    name: 'mo-task-list',
    components: {
      [DragSelect.name]: DragSelect,
      [TaskItem.name]: TaskItem
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
        selectedGidList: state => state.selectedGidList
      })
    },
    methods: {
      selectData (gid) {
        const selectedGidList = this.$store.state.task.selectedGidList
        if (selectedGidList.includes(gid)) {
          this.$store.dispatch('task/selectTasks', pull(selectedGidList, gid))
        } else {
          this.$store.dispatch('task/selectTasks', selectedGidList.concat(gid))
        }
      },
      handleDragSelectChange (selectedList) {
        this.selectedList = selectedList
        this.$store.dispatch('task/selectTasks', cloneDeep(selectedList))
      },
      getItemClass (item) {
        const isSelected = this.selectedList.includes(item.gid)
        return {
          selected: isSelected
        }
      }
    },
    watch: {
      selectedGidList (newVal) {
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
