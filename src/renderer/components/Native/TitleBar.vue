<template>
  <div class="title-bar">
    <div class="title-bar-dragger"></div>
    <ul v-if="showActions" class="window-actions">
      <li @click="handleMinimize">
        <mo-icon name="win-minimize" width="12" height="12" />
      </li>
      <li @click="handleMaximize">
        <mo-icon name="win-maximize" width="12" height="12" />
      </li>
      <li @click="handleClose" class="win-close-btn">
        <mo-icon name="win-close" width="12" height="12" />
      </li>
    </ul>
  </div>
</template>

<script>
  import { getCurrentWindow } from '@electron/remote'
  import '@/components/Icons/win-minimize'
  import '@/components/Icons/win-maximize'
  import '@/components/Icons/win-close'

  export default {
    name: 'mo-title-bar',
    props: {
      showActions: {
        type: Boolean
      }
    },
    computed: {
      win () {
        return getCurrentWindow()
      }
    },
    methods: {
      handleMinimize () {
        this.win.minimize()
      },
      handleMaximize () {
        if (this.win.isMaximized()) {
          this.win.unmaximize()
        } else {
          this.win.maximize()
        }
      },
      handleClose () {
        this.win.close()
      }
    }
  }
</script>

<style lang="scss">
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 36px;
  z-index: 5000;
  .title-bar-dragger {
    margin: 5px 0 0 5px;
    flex: 1;
    user-select: none;
    -webkit-app-region: drag;
    -webkit-user-select: none;
  }
  .window-actions {
    opacity: 0.4;
    transition: $--fade-transition;
    list-style: none;
    padding: 0;
    margin: 0;
    z-index: 5100;
    font-size: 0;
    color: #fff;
    > li {
      display: inline-block;
      padding: 5px 18px;
      font-size: 16px;
      margin: 0;
      color: #fff;
      &:hover {
        background-color: $--titlebar-actions-active-background;
      }
      &.win-close-btn:hover {
        color: $--titlebar-close-active-color;
        background-color: $--titlebar-close-active-background;
      }
    }
  }
  &:hover {
    .window-actions {
      opacity: 1;
    }
  }
}
</style>
