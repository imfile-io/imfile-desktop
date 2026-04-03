<template>
  <el-aside width="78px" :class="['aside', 'hidden-sm-and-down', { draggable: asideDraggable }]" :style="vibrancy">
    <div class="aside-inner">
      <mo-logo-mini />
      <ul class="menu top-menu">
        <li @click="nav('/task')" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-task" width="30" height="30" />
        </li>
        <li @click="nav('/search')" class="flex items-center justify-center non-draggable">
          <mo-icon name="menu-search" width="30" height="30" />
        </li>
      </ul>
    </div>
  </el-aside>
</template>

<script>
import is from 'electron-is'
import { mapState } from 'vuex'
import LogoMini from '@/components/Logo/LogoMini'
import '@/components/Icons/menu-task'
import '@/components/Icons/menu-search'

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
  margin-bottom: 24px;
}
</style>
