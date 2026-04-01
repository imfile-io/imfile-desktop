<template>
  <el-container class="main panel" direction="horizontal">
    <!-- <el-aside width="200px" class="subnav hidden-xs-only">
      <router-view name="subnav" />
    </el-aside> -->
    <router-view name="form" />
  </el-container>
</template>

<script>
export default {
  name: 'mo-content-preference',
  created () {
    this.$store.dispatch('preference/fetchPreference')
  }
}
</script>

<style lang="scss">
.form-preference {
  padding: 16px 7% 64px 16px;
  /* .el-switch__core {
    background: #282828;
    border-color: #282828;
  } */
  .el-switch__label {
    font-weight: normal;
    color: $--color-text-regular;
    &.is-active {
      color: $--color-text-regular;
    }
  }
  .el-checkbox__input.is-checked + .el-checkbox__label {
    color: $--color-text-regular;
  }
  .el-form-item {
    a {
      color: $--color-text-regular;
      text-decoration: none;
      &:hover {
        color: $--color-text-primary;
        text-decoration: underline;
      }
      &:active {
        color: $--color-text-primary;
      }
    }
  }
  .el-form-item.el-form-item--mini {
    margin-bottom: 32px;
  }
  .el-form-item__content {
    color: $--color-text-regular;
  }
  .form-item-sub {
    margin-bottom: 8px;
    &:last-of-type {
      margin-bottom: 0;
    }
    .el-input__inner{
      background-color: $--background-color-gray !important;
      border: none !important;
    }
  }
  .el-form-item__content{
    .el-input__inner, .el-input-group__append, .el-textarea__inner{
      background-color: $--background-color-gray !important;
      border: none !important;
      color: $--color-text-regular;
    }
    /* .el-input-group__append{
      background-color: $--background-color-gray !important;
      border: none !important;
    } */
    .el-button.select-directory.el-button--default.el-button--mini{
      background-color: $--background-color-gray !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .el-input-number__decrease.is-disabled{
      display: none !important;
    }
    .el-input-number__increase{
      display: none !important;
    }
    .el-input-number__decrease{
      display: none !important;
    }
  }
}
.form-actions {
  position: sticky;
  bottom: 0;
  left: auto;
  z-index: 10;
  width: -webkit-fill-available;
  box-sizing: border-box;
  padding-left: 300px !important;
  .btn_discard{
    background: #282828;
    color: #cbcbcb;
    border-color: #282828;
  }
}
.action-link {
  cursor: pointer;
  color: $--link-color;
  &:hover {
    color: $--link-hover-color;
    text-decoration: underline;
  }
}

</style>
