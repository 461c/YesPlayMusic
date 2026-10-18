<template>
  <div
    v-show="visible && !blocked"
    class="playlist-scroll-handle"
    :style="{ top: top + 'px', height: height + 'px' }"
    role="slider"
    tabindex="0"
    aria-label="歌单滚动位置"
    aria-orientation="vertical"
    :aria-valuenow="Math.round(progress * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
    @pointerdown="start"
    @keydown="key"
  >
    <div class="rail"></div
    ><div
      class="thumb"
      :class="{ dragging }"
      :style="{
        height: thumbSize + 'px',
        transform:
          'translateY(' + progress * Math.max(0, height - thumbSize) + 'px)',
      }"
    ></div>
  </div>
</template>
<script>
export default {
  name: 'PlaylistScrollHandle',
  data() {
    return {
      active: true,
      top: 100,
      height: 300,
      thumbSize: 40,
      progress: 0,
      visible: false,
      dragging: false,
      frame: null,
    };
  },
  computed: {
    blocked() {
      return this.$store.state.showLyrics || !this.$store.state.enableScrolling;
    },
  },
  mounted() {
    this.scroller = this.$parent.$parent.$refs.main;
    document.body.appendChild(this.$el);
    this.scroller.addEventListener('scroll', this.schedule, { passive: true });
    window.addEventListener('resize', this.schedule);
    this.resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(this.schedule)
        : null;
    this.resizeObserver?.observe(this.$parent.$el);
    this.fallbackTimer = this.resizeObserver
      ? null
      : setInterval(this.schedule, 750);
    this.$nextTick(this.update);
  },
  activated() {
    this.active = true;
    this.schedule();
  },
  deactivated() {
    this.active = false;
    this.visible = false;
    this.finish();
  },
  beforeDestroy() {
    this.finish();
    this.scroller?.removeEventListener('scroll', this.schedule);
    window.removeEventListener('resize', this.schedule);
    this.resizeObserver?.disconnect();
    clearInterval(this.fallbackTimer);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.$el.remove();
  },
  methods: {
    schedule() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = null;
        this.update();
      });
    },
    update() {
      if (!this.scroller) return;
      const navbar = document.querySelector('nav'),
        player = document.querySelector('.player');
      const nav = navbar?.getBoundingClientRect(),
        bar = player?.getBoundingClientRect();
      this.top = Math.max(80, nav?.bottom || 0) + 14;
      const bottom =
        bar && bar.top > this.top ? bar.top - 16 : window.innerHeight - 30;
      this.height = Math.max(80, bottom - this.top);
      const max = this.scroller.scrollHeight - this.scroller.clientHeight;
      this.visible = this.active && this.$parent.show && max > 40;
      this.thumbSize = Math.max(
        36,
        Math.min(
          this.height,
          (this.height * this.scroller.clientHeight) /
            Math.max(1, this.scroller.scrollHeight)
        )
      );
      this.progress =
        max > 0 ? Math.max(0, Math.min(1, this.scroller.scrollTop / max)) : 0;
    },
    move(event) {
      if (!this.dragging) return;
      event.preventDefault();
      const value = Math.max(
        0,
        Math.min(
          1,
          (event.clientY - this.top - this.thumbSize / 2) /
            Math.max(1, this.height - this.thumbSize)
        )
      );
      this.scroller.scrollTop =
        value * (this.scroller.scrollHeight - this.scroller.clientHeight);
      this.schedule();
    },
    start(event) {
      if (this.blocked) return;
      event.preventDefault();
      this.dragging = true;
      this.update();
      this.move(event);
      document.addEventListener('pointermove', this.move, { passive: false });
      document.addEventListener('pointerup', this.finish);
      document.addEventListener('pointercancel', this.finish);
    },
    finish() {
      this.dragging = false;
      document.removeEventListener('pointermove', this.move);
      document.removeEventListener('pointerup', this.finish);
      document.removeEventListener('pointercancel', this.finish);
    },
    key(event) {
      const actions = {
        ArrowDown: 80,
        ArrowUp: -80,
        PageDown: this.scroller.clientHeight * 0.8,
        PageUp: -this.scroller.clientHeight * 0.8,
        Home: -Infinity,
        End: Infinity,
      };
      if (!(event.key in actions)) return;
      event.preventDefault();
      const value = actions[event.key];
      this.scroller.scrollTop =
        value === Infinity
          ? this.scroller.scrollHeight
          : value === -Infinity
          ? 0
          : this.scroller.scrollTop + value;
    },
  },
};
</script>
<style lang="scss" scoped>
.playlist-scroll-handle {
  position: fixed;
  right: calc(3px + var(--android-inset-right, 0px));
  width: 24px;
  z-index: 90;
  touch-action: none;
  cursor: ns-resize;
  user-select: none;
  outline: none;
}
.rail {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 11px;
  width: 2px;
  border-radius: 2px;
  background: rgba(128, 128, 128, 0.15);
}
.thumb {
  position: absolute;
  top: 0;
  left: 8px;
  width: 8px;
  border-radius: 6px;
  background: rgba(128, 128, 128, 0.55);
  transition: width 0.12s, left 0.12s, background 0.12s;
}
.playlist-scroll-handle:hover .thumb,
.playlist-scroll-handle:focus .thumb,
.thumb.dragging {
  width: 12px;
  left: 6px;
  background: var(--color-primary);
}
</style>
