<template>
  <el-row class="copyright">
    <el-col :span="6" class="copyright-left">
      <a target="_blank" rel="noopener noreferrer" href="https://imfile.org/">
        &copy;{{ year }} imFile
      </a>
    </el-col>
    <!-- <el-col :span="18" class="copyright-right">
      <a target="_blank" rel="noopener noreferrer" href="https://imfile.org/license">
        {{ $t('about.license') }}
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://imfile.org/about">
        {{ $t('about.about') }}
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://imfile.org/support">
        {{ $t('about.support') }}
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://imfile.org/release">
        {{ $t('about.release') }}
      </a>
    </el-col> -->
  </el-row>
</template>

<script>
  export default {
    name: 'mo-copyright',
    data () {
      const year = new Date().getFullYear()
      return {
        year
      }
    }
  }
</script>

<style lang="scss">

.copyright {
  background: $--panel-background;
  width: 100%;
  font-size: $--font-size-small;
  a {
    color: $--app-copyright-color;
    text-decoration: none;
  }
}
.copyright-left {
  text-align: left;
}

.copyright-right {
  text-align: right;
  a {
    margin-left: 30px;
  }
}
.theme-dark {
  .copyright {
    background: $--dk-panel-background;
    a {
      color: $--app-copyright-color;
    }
  }
}
</style>
