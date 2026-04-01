<template>
  <el-dialog
    class="app-about-dialog"
    width="61.8vw"
    :model-value="visible"
    @open="handleOpen"
    :before-close="handleClose"
    @closed="handleClosed">
    <mo-app-info :version="version" :engine="engineInfo" />
    <template v-slot:footer>
<mo-copyright  />
</template>
  </el-dialog>
</template>

<script>
  import { mapState } from 'vuex'
  import AppInfo from '@/components/About/AppInfo'
  import Copyright from '@/components/About/Copyright'
  import { app } from '@electron/remote'

  export default {
    name: 'mo-about-panel',
    components: {
      [AppInfo.name]: AppInfo,
      [Copyright.name]: Copyright
    },
    props: {
      visible: {
        type: Boolean,
        default: false
      }
    },
    data () {
      const version = app.getVersion()
      return {
        version
      }
    },
    computed: {
      ...mapState('app', {
        engineInfo: state => state.engineInfo
      })
    },
    methods: {
      handleOpen () {
        this.$store.dispatch('app/fetchEngineInfo')
      },
      handleClose (done) {
        this.$store.dispatch('app/hideAboutPanel')
        done()
      },
      handleClosed () {
      }
    }
  }
</script>

<style lang="scss">
.el-dialog.app-about-dialog{
  background: $--panel-background;
  border: 1px solid $--color-text-primary;
  border-radius: 8px;
}
.app-about-dialog {
  max-width: 470px;
  min-width: 380px;
  .el-dialog__header {
    padding-top: 0;
    padding-bottom: 0;
  }
}
.theme-dark{
  .el-dialog.app-about-dialog{
    background: $--dk-panel-background;
    border: 1px solid $--color-text-primary;
  }
}
</style>
