<template>
  <div class="app-info">
    <div class="app-version">
      <mo-logo :width="40" :height="34" style="vertical-align: middle;" />
      <span>Version {{version}}</span>
    </div>
    <div class="engine-info" v-if="!!engine">
      <h4>{{ $t('about.engine-version') }} {{engine.version}}</h4>
      <h4>electron {{version_electron}}</h4>
      <h4>chrome {{version_chrome}}</h4>
      <ul v-if="!isMas()">
        <li
          v-for="(feature, index) in engine.enabledFeatures"
          v-bind:key="`feature-${index}`">
          {{ feature }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import is from 'electron-is'
import Logo from '@/components/Logo/Logo'

export default {
  name: 'mo-app-info',
  components: {
    [Logo.name]: Logo
  },
  props: {
    version: {
      type: String,
      default: ''
    },
    version_chrome: {
      type: String,
      default: process.versions.chrome
    },
    version_electron: {
      type: String,
      default: process.versions.electron
    },
    engine: {
      type: Object,
      default () {
        return {
          version: '',
          enabledFeatures: []
        }
      }
    }
  },
  methods: {
    isMas: is.mas
  }
}
</script>

<style lang="scss">
.app-info {
  background: $--panel-background;
  position: relative;
  margin: 8px 0;
  .app-version{
    span {
      display: inline-block;
      vertical-align: middle;
      font-size: $--font-size-large;
      margin-left: 0px;
      color: #CBCBCB;
      line-height: 18px;
    }
  }
  .app-icon {
    position: absolute;
    top: 0;
    right: 0;
    background: transparent url('~@/assets/app-icon.png') center center no-repeat;
    background-size: 128px 128px;
    width: 128px;
    height: 128px;
  }
  .engine-info {
    margin: 20px 35% 0 8px;
    h4 {
      font-size: $--font-size-base;
      font-weight: normal;
      color: #CBCBCB;
    }
    ul {
      font-size: 12px;
      color: $--app-engine-info-color;
      list-style: none;
      padding: 0;
      line-height: 25px;
      @include clearfix();
      li {
        color: $--app-engine-title-color;
        float: left;
        width: 50%;
      }
    }
  }
}
.theme-dark {
  .app-info {
    background: $--dk-panel-background;
    .app-version{
      span {
        color: #CBCBCB;
      }
    }
    .engine-info {
      ul {
        color: $--app-engine-info-color;
        li {
          color: $--app-engine-title-color;
        }
      }
    }
  }
}
</style>
