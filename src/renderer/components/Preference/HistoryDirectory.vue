<template>
  <div class="mo-history-directory">
    <el-popover
      popper-class="mo-directory-popper"
      trigger="hover"
      :placement="placement"
      :width="width"
    >
      <el-empty class="mo-directory-empty" :image-size="48" v-if="empty" />
      <ul class="mo-directory-list" v-if="favoriteDirectories.length > 0">
        <li
          v-for="directory in favoriteDirectories"
          :key="directory"
          @click.stop="() => handleSelectItem(directory)"
        >
          <span class="mo-directory-path" :title="directory">{{directory}}</span>
          <span class="mo-directory-actions">
            <el-icon
              class="icon-history-favorited"
              @click.stop="() => handleCancelFavoriteItem(directory)"
            ><Star /></el-icon>
            <el-icon
              class="icon-history-remove"
              @click.stop="() => handleRemoveItem(directory)"
            ><Delete /></el-icon>
          </span>
        </li>
      </ul>
      <div class="mo-directory-divider" v-if="showDivider" />
      <ul class="mo-directory-list" v-if="historyDirectories.length > 0">
        <li
          v-for="directory in historyDirectories"
          :key="directory"
          @click.stop="() => handleSelectItem(directory)"
        >
          <span class="mo-directory-path" :title="directory">{{directory}}</span>
          <span class="mo-directory-actions">
            <el-icon
              v-if="showFavoriteAction"
              class="icon-history-favorite"
              @click.stop="() => handleFavoriteItem(directory)"
            ><Star /></el-icon>
            <el-icon
              class="icon-history-remove"
              @click.stop="() => handleRemoveItem(directory)"
            ><Delete /></el-icon>
          </span>
        </li>
      </ul>
      <template v-slot:reference>
<el-button

        :disabled="popoverDisabled"
      >
        <el-icon><Clock /></el-icon>
      </el-button>
</template>
    </el-popover>
  </div>
</template>

<script>
  import { Clock, Delete, Star } from '@element-plus/icons-vue'
  import { mapState } from 'vuex'
  import { MAX_NUM_OF_DIRECTORIES } from '@shared/constants'
  import { cloneArray } from '@shared/utils'

  export default {
    name: 'mo-history-directory',
    components: {
      Clock,
      Delete,
      Star
    },
    props: {
      width: {
        type: Number,
        default: 360
      },
      placement: {
        type: String,
        default: 'bottom-start'
      }
    },
    data () {
      return {
        visible: false
      }
    },
    computed: {
      ...mapState('preference', {
        historyDirectories: state => {
          return cloneArray(state.config.historyDirectories, true)
        },
        favoriteDirectories: state => {
          return cloneArray(state.config.favoriteDirectories, true)
        }
      }),
      empty () {
        const { favoriteDirectories, historyDirectories } = this
        return favoriteDirectories.length + historyDirectories.length === 0
      },
      popoverDisabled () {
        const { favoriteDirectories, historyDirectories } = this
        return favoriteDirectories.length === 0 &&
          historyDirectories.length === 0
      },
      showDivider () {
        const { favoriteDirectories, historyDirectories } = this
        return favoriteDirectories.length > 0 &&
          historyDirectories.length > 0
      },
      showFavoriteAction () {
        const { favoriteDirectories } = this
        return favoriteDirectories.length < MAX_NUM_OF_DIRECTORIES
      }
    },
    methods: {
      handleIconClick () {
        if (this.popoverDisabled) {
          return
        }

        const { visible } = this
        this.visible = !visible
      },
      handleSelectItem (directory) {
        this.$emit('selected', directory.trim())
        this.visible = false
      },
      handleFavoriteItem (directory) {
        console.log('handleFavoriteItem==>', directory)
        this.$store.dispatch('preference/favoriteDirectory', directory)
      },
      handleCancelFavoriteItem (directory) {
        console.log('handleCancelFavoriteItem==>', directory)
        this.$store.dispatch('preference/cancelFavoriteDirectory', directory)
      },
      handleRemoveItem (directory) {
        console.log('handleRemoveItem==>', directory)
        this.$store.dispatch('preference/removeDirectory', directory)
      }
    }
  }
</script>

<style lang="scss">
.el-popover.mo-directory-popper {
  padding: $--popover-padding 0;
}
.el-empty.mo-directory-empty {
  padding: 20px 0;
}
.el-form-item__content .el-button.el-button--default.el-button--mini{
    border-radius: 0;
  }
.mo-directory-divider {
  padding: 0 $--popover-padding;
  margin: 6px 0;
  &::after {
    content: ' ';
    display: block;
    height: 1px;
    width: 100%;
    background: $--border-color-base;
  }
}
.mo-directory-list {
  padding: 0;
  margin: 0;
  list-style: none;
  &> li {
    display: flex;
    align-items: center;
    list-style: none;
    line-height: $--font-line-height-primary;
    margin: 0;
    font-size: $--font-size-small;
    color: $--color-text-regular;
    cursor: pointer;
    outline: none;
    padding: 6px 6px 6px $--popover-padding;
    &:focus, &:hover {
      background-color: $--background-color-base;
      color: $--color-primary-light-2;
    }
  }
  .mo-directory-path {
    display: inline-block;
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .mo-directory-actions {
    min-width: 40px;
    text-align: right;
    &> i {
      padding: 3px;
      margin-right: 3px;
      display: inline-block;
    }
  }
  .icon-history-favorite {
    &:focus, &:hover {
      color: $--color-warning;
    }
  }
  .icon-history-favorited {
    color: $--color-warning;
  }
  .icon-history-remove {
    &:focus, &:hover {
      color: $--color-danger;
    }
  }
}
.theme-dark {
  .el-input-group__prepend{
    border-color: $--dk--background-color-gray !important;
  }
  .mo-directory-divider {
    &::after {
      background: $--border-color-base;
    }
  }
  .mo-directory-list {
    &> li {
      color: $--color-text-regular;
      &:focus, &:hover {
        background-color:  $--dk--background-color-gray;
        color: $--color-primary-light-2;
      }
    }
    .icon-history-favorite {
      &:focus, &:hover {
        color: $--color-warning;
      }
    }
    .icon-history-favorited {
      color: $--color-warning;
    }
    .icon-history-remove {
      &:focus, &:hover {
        color: $--color-danger;
      }
    }
  }
}

</style>
