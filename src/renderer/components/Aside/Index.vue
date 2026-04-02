<template>
  <el-aside width="78px" :class="['aside', 'hidden-sm-and-down', { draggable: asideDraggable }]" :style="vibrancy">
    <div class="aside-inner">
      <mo-logo-mini />
      <ul class="menu top-menu">
        <li @click="nav('/task')" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-task" width="30" height="30" />
        </li>
        <li @click="showAddTask()" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-add" width="30" height="30" />
        </li>
        <li @click="nav('/search')" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-search" width="30" height="30" />
        </li>
      </ul>
      <ul class="menu bottom-menu">
        <li @click="nav('/preference')" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-preference" width="30" height="30" />
        </li>
        <li @click="showAboutPanel" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-about" width="30" height="30" />
        </li>
      </ul>
    </div>
  </el-aside>
</template>

<script>
import is from 'electron-is'
import { mapState } from 'vuex'
import { ADD_TASK_TYPE } from '@shared/constants'
import LogoMini from '@/components/Logo/LogoMini'
import '@/components/Icons/menu-task'
import '@/components/Icons/menu-add'
import '@/components/Icons/menu-search'
import '@/components/Icons/menu-preference'
import '@/components/Icons/menu-about'

export default {
  name: 'mo-aside',
  components: {
    [LogoMini.name]: LogoMini
  },
  computed: {
    ...mapState('app', {
      currentPage: state => state.currentPage
    }),
    asideDraggable () {
      return is.macOS()
    },
    vibrancy () {
      return is.macOS()
        ? {
            backgroundColor: 'transparent'
          }
        : {}
    }
  },
  methods: {
    showAddTask (taskType = ADD_TASK_TYPE.URI) {
      this.$store.dispatch('app/showAddTaskDialog', taskType)
    },
    showAboutPanel () {
      this.$store.dispatch('app/showAboutPanel')
    },
    nav (page) {
      this.$router.push({
        path: page
      }).catch(err => {
        console.log(err)
      })
    }
  }
}
</script>

<style lang="scss">
.aside-inner {
  display: flex;
  height: 100%;
  flex-flow: column;
}
.logo-mini {
  margin-top: 40px;
}
.menu {
  list-style: none;
  padding: 0;
  margin: 0 auto;
  user-select: none;
  cursor: default;
  > li {
    width: 34px;
    height: 34px;
    margin-top: 24px;
    cursor: pointer;
    border-radius: 17px;
    transition: background-color 0.25s;
    &:hover {
      background-color: rgba(255, 255, 255, 0.15);
    }
  }
  svg {
    padding: 5px;
    color: #fff;
  }
}
.top-menu {
  flex: 1;
}
.bottom-menu {
  margin-bottom: 24px;
}
</style>
