<template>
  <svg
    version="1.1"
    :class="klass"
    :role="label ? 'img' : 'presentation'"
    :aria-label="label"
    :x="x"
    :y="y"
    :width="width"
    :height="height"
    :viewBox="box"
    :style="style"
  >
    <slot>
      <template v-if="icon && icon.paths">
        <path v-for="(path, i) in icon.paths" :key="`path-${i}`" v-bind="path" />
      </template>
      <template v-if="icon && icon.polygons">
        <polygon v-for="(polygon, i) in icon.polygons" :key="`polygon-${i}`" v-bind="polygon" />
      </template>
      <template v-if="icon && icon.raw"><g v-bind="icon.g" v-html="raw" /></template>
    </slot>
  </svg>
</template>

<script>
import { getCurrentInstance } from 'vue'
import { icons, registerIcons, getIcon, hasIcon } from './iconRegistry'

function getIconChildComponents (instance) {
  const result = []
  const root = instance && instance.subTree
  if (!root) {
    return result
  }

  const visit = (vnode) => {
    if (!vnode) {
      return
    }
    if (vnode.component && vnode.component.proxy) {
      result.push(vnode.component.proxy)
    }
    const children = vnode.children
    if (Array.isArray(children)) {
      children.forEach(visit)
    } else if (children && typeof children === 'object') {
      Object.values(children).forEach((child) => {
        if (Array.isArray(child)) {
          child.forEach(visit)
        } else {
          visit(child)
        }
      })
    }
  }

  visit(root)
  return result
}

export default {
  name: 'mo-icon',
  props: {
    name: {
      type: String,
      validator (val) {
        if (val && !hasIcon(val)) {
          console.warn(`Invalid prop: prop "name" is referring to an unregistered icon "${val}".` +
              '\nPlease make sure you have imported this icon before using it.')
          return false
        }
        return true
      }
    },
    scale: [Number, String],
    spin: Boolean,
    inverse: Boolean,
    pulse: Boolean,
    flip: {
      validator (val) {
        return val === 'horizontal' || val === 'vertical'
      }
    },
    label: String
  },
  data () {
    return {
      x: undefined,
      y: undefined,
      childrenWidth: 0,
      childrenHeight: 0,
      outerScale: 1
    }
  },
  computed: {
    normalizedScale () {
      let scale = this.scale
      scale = typeof scale === 'undefined' ? 1 : Number(scale)
      if (isNaN(scale) || scale <= 0) {
        console.warn('Invalid prop: prop "scale" should be a number over 0.', this)
        return this.outerScale
      }
      return scale * this.outerScale
    },
    klass () {
      return {
        'mo-icon': true,
        'mo-spin': this.spin,
        'mo-flip-horizontal': this.flip === 'horizontal',
        'mo-flip-vertical': this.flip === 'vertical',
        'mo-inverse': this.inverse,
        'mo-pulse': this.pulse,
        [this.$options.name]: true
      }
    },
    icon () {
      if (this.name) {
        return getIcon(this.name)
      }
      return null
    },
    box () {
      if (this.icon) {
        return `0 0 ${this.icon.width} ${this.icon.height}`
      }
      return `0 0 ${this.width} ${this.height}`
    },
    ratio () {
      if (!this.icon) {
        return 1
      }
      const { width, height } = this.icon
      return Math.max(width, height) / 16
    },
    width () {
      return this.childrenWidth || (this.icon && this.icon.width / this.ratio * this.normalizedScale) || 0
    },
    height () {
      return this.childrenHeight || (this.icon && this.icon.height / this.ratio * this.normalizedScale) || 0
    },
    style () {
      if (this.normalizedScale === 1) {
        return false
      }
      return {
        fontSize: this.normalizedScale + 'em'
      }
    },
    raw () {
      // generate unique id for each icon's SVG element with ID
      if (!this.icon || !this.icon.raw) {
        return null
      }
      let raw = this.icon.raw
      const ids = {}
      raw = raw.replace(/\s(?:xml:)?id=(["']?)([^"')\s]+)\1/g, (match, quote, id) => {
        const uniqueId = getId()
        ids[id] = uniqueId
        return ` id="${uniqueId}"`
      })
      raw = raw.replace(/#(?:([^'")\s]+)|xpointer\(id\((['"]?)([^')]+)\2\)\))/g, (match, rawId, _, pointerId) => {
        const id = rawId || pointerId
        if (!id || !ids[id]) {
          return match
        }

        return `#${ids[id]}`
      })

      return raw
    }
  },
  mounted () {
    // Vue 3 已移除 $children，改从 subTree 收集子组件实例
    const children = getIconChildComponents(getCurrentInstance())
    if (!this.name && children.length === 0) {
      console.warn('Invalid prop: prop "name" is required.')
      return
    }

    if (this.icon) {
      return
    }

    let width = 0
    let height = 0
    children.forEach((child) => {
      child.outerScale = this.normalizedScale

      width = Math.max(width, child.width)
      height = Math.max(height, child.height)
    })
    this.childrenWidth = width
    this.childrenHeight = height
    children.forEach((child) => {
      child.x = (width - child.width) / 2
      child.y = (height - child.height) / 2
    })
  },
  // 兼容现有 Icon.register(...) 侧效导入
  register: registerIcons,
  icons
}

let cursor = 0xD4937
function getId () {
  return `mo-${(cursor++).toString(16)}`
}
</script>

<style>
.mo-icon {
  display: inline-block;
  fill: currentColor;
  stroke: currentColor;
}

.mo-flip-horizontal {
  transform: scale(-1, 1);
}

.mo-flip-vertical {
  transform: scale(1, -1);
}

.mo-spin {
  animation: mo-spin 0.5s 0s infinite linear;
}

.mo-inverse {
  color: #fff;
}

.mo-pulse {
  animation: mo-spin 1s infinite steps(8);
}

@keyframes mo-spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
