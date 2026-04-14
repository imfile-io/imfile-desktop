<template>
  <!-- <mo-drag-select
    class="task-list"
    v-if="taskList.length > 0"
    attribute="attr"
    @change="handleDragSelectChange"
  > -->
  <div v-if="taskList.length > 0" class="mx-4 task-list-root">
    <div v-if="filteredTaskList.length > 0" class="task-list-table">
      <div class="task-list-head" role="row" @click.stop>
        <div class="task-list-head-cell task-list-head-cell--check" aria-hidden="true" />
        <button
          type="button"
          class="task-list-head-cell task-list-head-sort"
          :class="{ 'is-active': sortKey === 'name' }"
          :aria-sort="ariaSortFor('name')"
          @click="toggleSort('name')"
        >
          <span>{{ $t('task.file-name') }}</span>
          <span class="task-list-sort-carets" aria-hidden="true">
            <span class="caret-up" :class="{ on: sortKey === 'name' && sortOrder === 'asc' }" />
            <span class="caret-down" :class="{ on: sortKey === 'name' && sortOrder === 'desc' }" />
          </span>
        </button>
        <button
          type="button"
          class="task-list-head-cell task-list-head-sort task-list-head-sort--end"
          :class="{ 'is-active': sortKey === 'connections' }"
          :aria-sort="ariaSortFor('connections')"
          @click="toggleSort('connections')"
        >
          <span>{{ $t('task.task-connections') }}</span>
          <span class="task-list-sort-carets" aria-hidden="true">
            <span class="caret-up" :class="{ on: sortKey === 'connections' && sortOrder === 'asc' }" />
            <span class="caret-down" :class="{ on: sortKey === 'connections' && sortOrder === 'desc' }" />
          </span>
        </button>
        <button
          type="button"
          class="task-list-head-cell task-list-head-sort task-list-head-sort--end"
          :class="{ 'is-active': sortKey === 'size' }"
          :aria-sort="ariaSortFor('size')"
          @click="toggleSort('size')"
        >
          <span>{{ $t('task.task-file-size') }}</span>
          <span class="task-list-sort-carets" aria-hidden="true">
            <span class="caret-up" :class="{ on: sortKey === 'size' && sortOrder === 'asc' }" />
            <span class="caret-down" :class="{ on: sortKey === 'size' && sortOrder === 'desc' }" />
          </span>
        </button>
        <button
          type="button"
          class="task-list-head-cell task-list-head-sort task-list-head-sort--end"
          :class="{ 'is-active': sortKey === 'speed' }"
          :aria-sort="ariaSortFor('speed')"
          @click="toggleSort('speed')"
        >
          <span>{{ $t('task.task-list-col-speed') }}</span>
          <span class="task-list-sort-carets" aria-hidden="true">
            <span class="caret-up" :class="{ on: sortKey === 'speed' && sortOrder === 'asc' }" />
            <span class="caret-down" :class="{ on: sortKey === 'speed' && sortOrder === 'desc' }" />
          </span>
        </button>
        <div class="task-list-head-cell task-list-head-cell--actions" aria-hidden="true" />
      </div>
      <div
        v-for="item in displayTaskList"
        :key="item.taskKey"
        :attr="item.taskKey"
        :class="getItemClass(item)"
        class="task-list-row-wrap"
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
import { useI18n } from 'vue-i18n'
import { cloneDeep, pull } from 'lodash'
import { getTaskListDisplaySpeed, getTaskName } from '@shared/utils'
import DragSelect from '@/components/DragSelect/Index'
import TaskItem from './TaskItem'

export default {
  name: 'mo-task-list',
  setup () {
    const { t } = useI18n()
    return { t }
  },
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
    const selectedList = cloneDeep(this.$store.state.task.selectedTaskKeyList) || []
    return {
      selectedList,
      sortKey: 'name',
      sortOrder: 'asc'
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
      const defaultName = this.t('task.get-task-name')
      return this.taskList.filter((task) => {
        const name = getTaskName(task, {
          defaultName,
          maxLen: -1
        })
        return name.toLowerCase().includes(q)
      })
    },
    displayTaskList () {
      const list = [...this.filteredTaskList]
      const defaultName = this.t('task.get-task-name')
      const mul = this.sortOrder === 'asc' ? 1 : -1
      const key = this.sortKey
      list.sort((a, b) => {
        switch (key) {
          case 'name': {
            const na = getTaskName(a, { defaultName, maxLen: -1 }).toLowerCase()
            const nb = getTaskName(b, { defaultName, maxLen: -1 }).toLowerCase()
            return na.localeCompare(nb, undefined, { sensitivity: 'base' }) * mul
          }
          case 'connections':
            return ((Number(a.connections) || 0) - (Number(b.connections) || 0)) * mul
          case 'size':
            return ((Number(a.totalLength) || 0) - (Number(b.totalLength) || 0)) * mul
          case 'speed':
            return (getTaskListDisplaySpeed(a) - getTaskListDisplaySpeed(b)) * mul
          default:
            return 0
        }
      })
      return list
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
    },
    toggleSort (key) {
      if (this.sortKey === key) {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc'
      } else {
        this.sortKey = key
        this.sortOrder = key === 'name' ? 'asc' : 'desc'
      }
    },
    ariaSortFor (key) {
      if (this.sortKey !== key) {
        return 'none'
      }
      return this.sortOrder === 'asc' ? 'ascending' : 'descending'
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

/* 任务列表卡片：白底圆角容器 + 表格列 + 行内进度条式背景（见设计稿） */
.task-list-root {
  --task-table-cols: 40px minmax(120px, 1fr) 80px 128px 108px minmax(140px, auto);
  --task-table-col-gap: 10px;

  background: #ffffff;
  border-radius: 14px;
  padding: 16px 16px 20px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
}

.task-list-table {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-list-head {
  display: grid;
  grid-template-columns: var(--task-table-cols);
  column-gap: var(--task-table-col-gap);
  align-items: center;
  padding: 0 0 10px;
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.08);
  font-size: 13px;
  color: #888;
  user-select: none;
  white-space: nowrap;
}

.task-list-head-cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-list-head-cell--check {
  width: 40px;
}

.task-list-head-sort {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 4px 2px;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;

  &:hover,
  &.is-active {
    color: $--color-primary;
  }

  &:focus-visible {
    outline: 2px solid $--color-primary;
    outline-offset: 2px;
  }
}

.task-list-head-sort--end {
  justify-content: flex-end;
  text-align: right;
}

.task-list-sort-carets {
  display: inline-flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
}

.task-list-head-sort > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-list-sort-carets .caret-up,
.task-list-sort-carets .caret-down {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  opacity: 0.22;
}

.task-list-sort-carets .caret-up {
  border-bottom: 5px solid currentColor;
}

.task-list-sort-carets .caret-down {
  border-top: 5px solid currentColor;
}

.task-list-sort-carets .caret-up.on,
.task-list-sort-carets .caret-down.on {
  opacity: 1;
}

.task-list-head-cell--actions {
  min-width: 0;
}

.task-list-root .task-item--table {
  display: grid;
  grid-template-columns: var(--task-table-cols);
  column-gap: var(--task-table-col-gap);
  align-items: center;
  margin-bottom: 0;
  border-width: 1px;
  border-style: solid;
  border-color: rgba(15, 23, 42, 0.06);
  border-radius: 8px;
  overflow: hidden;
  background-color: #f8f9fb;
  background-image: linear-gradient(
    to right,
    #4cd98b 0%,
    #4cd98b var(--task-row-progress, 0%),
    #f8f9fb var(--task-row-progress, 0%),
    #f8f9fb 100%
  );
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  min-height: 56px;
  padding: 10px 0;

  &:hover {
    border-color: $--task-item-hover-border-color;
  }
}

.task-list-root .selected .task-item--table {
  border-color: $--task-item-hover-border-color;
  box-shadow: 0 0 0 1px $--task-item-hover-border-color;
}

.task-list-root .task-item-cell--check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.task-list-root .task-item-cell--name {
  min-width: 0;
}

.task-list-root .task-item-cell--connections,
.task-list-root .task-item-cell--size,
.task-list-root .task-item-cell--speed {
  font-size: 13px;
  color: #555;
  text-align: right;
  white-space: nowrap;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-list-root .task-item-cell--actions {
  justify-self: end;
  min-width: 0;
  overflow: hidden;
}

.task-list-root .task-item-cell--actions .task-item-actions {
  max-width: 100%;
}

.task-list-root .task-name {
  margin-bottom: 0;
  min-height: auto;

  & > span {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }
}

.theme-dark .task-list-root {
  background: #252526;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}

.theme-dark .task-list-head {
  border-bottom-color: rgba(255, 255, 255, 0.1);
  color: #9ca3af;
}

.theme-dark .task-list-root .task-item-cell--connections,
.theme-dark .task-list-root .task-item-cell--size,
.theme-dark .task-list-root .task-item-cell--speed {
  color: #b0b0b0;
}

.theme-dark .task-list-root .task-item--table {
  border-color: rgba(255, 255, 255, 0.08);
  background-color: #2d2d2d;
  background-image: linear-gradient(
    to right,
    #3daf7a 0%,
    #3daf7a var(--task-row-progress, 0%),
    #2d2d2d var(--task-row-progress, 0%),
    #2d2d2d 100%
  );

  &:hover {
    border-color: $--task-item-hover-border-color;
  }
}

.theme-dark .task-list-root .selected .task-item--table {
  border-color: $--task-item-hover-border-color;
  box-shadow: 0 0 0 1px $--task-item-hover-border-color;
}

@media (max-width: 1280px) {
  .task-list-root {
    --task-table-cols: 36px minmax(96px, 1fr) 64px 108px 96px minmax(120px, auto);
    --task-table-col-gap: 8px;
  }
}

@media (max-width: 1080px) {
  .task-list-root {
    --task-table-cols: 32px minmax(84px, 1fr) 56px 96px 84px minmax(100px, auto);
    --task-table-col-gap: 6px;
  }
}

@media (max-width: 920px) {
  .task-list-root {
    --task-table-cols: 30px minmax(80px, 1fr) 88px 76px minmax(92px, auto);
    --task-table-col-gap: 5px;
  }

  .task-list-head > :nth-child(3),
  .task-list-root .task-item--table > :nth-child(3) {
    display: none;
  }
}

@media (max-width: 760px) {
  .task-list-root {
    --task-table-cols: 28px minmax(72px, 1fr) 72px minmax(84px, auto);
    --task-table-col-gap: 4px;
  }

  .task-list-head > :nth-child(3),
  .task-list-root .task-item--table > :nth-child(3),
  .task-list-head > :nth-child(4),
  .task-list-root .task-item--table > :nth-child(4) {
    display: none;
  }
}
</style>
