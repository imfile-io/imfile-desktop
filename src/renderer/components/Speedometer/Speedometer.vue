<template>
  <div
    ref="root"
    class="mo-speedometer"
    :class="{ stopped: stat.numActive === 0, dragging }"
    :style="positionStyle"
    @pointerdown="onPointerDown"
  >
    <div
      class="mode"
      @click="onModeClick"
    >
      <i>
        <mo-icon name="speedometer" width="24" height="24" />
      </i>
      <em>{{ engineMode }}</em>
    </div>
    <div class="value" v-if="stat.numActive > 0">
      <em>{{ bytesToSize(stat.uploadSpeed) }}/s</em>
      <span>{{ bytesToSize(stat.downloadSpeed) }}/s</span>
    </div>
  </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import { bytesToSize } from '@shared/utils'
import '@/components/Icons/speedometer'

const STORAGE_KEY = 'imfile-speedometer-position'
const DRAG_THRESHOLD_PX = 5

export default {
  name: 'mo-speedometer',
  data () {
    return {
      /** @type {{ left: number, top: number } | null} */
      pos: null,
      dragging: false,
      suppressModeClick: false,
      /** @type {{ x: number, y: number } | null} */
      dragPointerStart: null,
      dragBeyondThreshold: false,
      /** @type {{ x: number, y: number } | null} */
      dragPointerOffset: null,
      dragMoveHandler: null,
      dragUpHandler: null
    }
  },
  computed: {
    ...mapState('app', [
      'stat'
    ]),
    ...mapState('preference', [
      'engineMode'
    ]),
    positionStyle () {
      if (!this.pos) {
        return {}
      }
      return {
        left: `${this.pos.left}px`,
        top: `${this.pos.top}px`,
        right: 'auto',
        bottom: 'auto'
      }
    }
  },
  mounted () {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const p = JSON.parse(raw)
        if (
          typeof p.left === 'number' &&
          typeof p.top === 'number' &&
          Number.isFinite(p.left) &&
          Number.isFinite(p.top)
        ) {
          this.pos = { left: p.left, top: p.top }
        }
      }
    } catch (e) {
      // ignore
    }
  },
  beforeUnmount () {
    this.teardownDragListeners()
  },
  methods: {
    bytesToSize,
    ...mapActions('preference', [
      'toggleEngineMode'
    ]),
    teardownDragListeners () {
      if (this.dragMoveHandler) {
        window.removeEventListener('pointermove', this.dragMoveHandler)
        this.dragMoveHandler = null
      }
      if (this.dragUpHandler) {
        window.removeEventListener('pointerup', this.dragUpHandler)
        this.dragUpHandler = null
      }
    },
    clampToViewport (left, top, el) {
      const w = el.offsetWidth
      const h = el.offsetHeight
      const maxL = Math.max(0, window.innerWidth - w)
      const maxT = Math.max(0, window.innerHeight - h)
      return {
        left: Math.max(0, Math.min(left, maxL)),
        top: Math.max(0, Math.min(top, maxT))
      }
    },
    onPointerDown (e) {
      if (e.button !== 0) {
        return
      }
      this.dragPointerStart = { x: e.clientX, y: e.clientY }
      this.dragBeyondThreshold = false
      this.dragMoveHandler = (ev) => this.onPointerMove(ev)
      this.dragUpHandler = (ev) => this.onPointerUp(ev)
      window.addEventListener('pointermove', this.dragMoveHandler)
      window.addEventListener('pointerup', this.dragUpHandler)
    },
    onPointerMove (e) {
      if (!this.dragPointerStart) {
        return
      }
      const dx = e.clientX - this.dragPointerStart.x
      const dy = e.clientY - this.dragPointerStart.y
      const dist = Math.hypot(dx, dy)
      if (!this.dragBeyondThreshold) {
        if (dist <= DRAG_THRESHOLD_PX) {
          return
        }
        this.dragBeyondThreshold = true
        this.dragging = true
        const el = this.$refs.root
        const rect = el.getBoundingClientRect()
        this.dragPointerOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        }
        if (!this.pos) {
          this.pos = { left: rect.left, top: rect.top }
        }
      }
      const el = this.$refs.root
      const left = e.clientX - this.dragPointerOffset.x
      const top = e.clientY - this.dragPointerOffset.y
      this.pos = this.clampToViewport(left, top, el)
      e.preventDefault()
    },
    onPointerUp () {
      this.teardownDragListeners()
      if (this.dragBeyondThreshold) {
        this.suppressModeClick = true
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pos))
        } catch (err) {
          // ignore
        }
        setTimeout(() => {
          this.suppressModeClick = false
        }, 400)
      }
      this.dragging = false
      this.dragBeyondThreshold = false
      this.dragPointerStart = null
      this.dragPointerOffset = null
    },
    onModeClick (e) {
      if (this.suppressModeClick) {
        e.preventDefault()
        e.stopPropagation()
        return
      }
      this.toggleEngineMode()
    }
  }
}
</script>

<style lang="scss">
  .mo-speedometer {
    font-size: 12px;
    position: fixed;
    right: 16px;
    bottom: 50px;
    display: inline-block;
    box-sizing: border-box;
    width: 150px;
    height: 40px;
    padding: 5px 10px 5px 48px;
    border-radius: 100px;
    transition: $--all-transition;
    border: 1px solid $--speedometer-border-color;
    background: $--speedometer-background;
    z-index: 20;
    touch-action: none;
    user-select: none;
    cursor: grab;
    &:hover {
      border-color: $--speedometer-hover-border-color;
    }
    &.dragging {
      cursor: grabbing;
      transition: none;
    }
    &.stopped {
      width: 40px;
      padding: 0;
      cursor: grab;
      .mode i {
        color: $--speedometer-stopped-color;
      }
      .mode em {
        display: none;
      }
    }
    &.stopped.dragging {
      cursor: grabbing;
    }
    em {
      font-style: normal;
    }
    .mode {
      font-size: 0;
      position: absolute;
      top: 5px;
      left: 5px;
    }
    .mode i {
      font-size: 20px;
      font-style: normal;
      line-height: 28px;
      display: inline-block;
      box-sizing: border-box;
      width: 28px;
      height: 28px;
      padding: 2px;
      text-align: center;
      vertical-align: top;
      color: $--speedometer-primary-color;
    }
    .mode em {
      display: inline-block;
      width: 0;
      height: 8px;
      margin-left: 4px;
      font-size: 16px;
      line-height: 15px;
      transform: scale(.5);
      vertical-align: top;
      color: $--speedometer-primary-color;
    }
    .mode.mode-auto em {
      color: $--speedometer-text-color;
    }
    .mode.mode-max em {
      color: $--speedometer-primary-color;
    }
    .value {
      font-size: 0;
      overflow: hidden;
      width: 100%;
      text-align: right;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .value em {
      font-size: 16px;
      line-height: 12px;
      display: block;
      width: 120%;
      transform: scale(.625);
      color: $--speedometer-text-color;
    }
    .value span {
      font-size: 13px;
      line-height: 14px;
      display: block;
      margin-top: 2px;
      color: $--speedometer-primary-color;
    }
    .no-active {
      font-size: 14px;
      line-height: 28px;
      color: $--speedometer-primary-color;
    }
  }
</style>
