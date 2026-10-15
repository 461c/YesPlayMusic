<template>
  <div ref="contextMenu" class="context-menu">
    <transition name="menu-reveal">
      <div
        v-if="showMenu"
        ref="menu"
        class="menu"
        :style="{ top, left, maxHeight: maxHeight + 'px' }"
        tabindex="-1"
        @blur="closeMenu"
        @click="closeMenu"
      >
        <slot></slot>
      </div>
    </transition>
  </div>
</template>

<script>
import { mapState } from 'vuex';

export default {
  name: 'ContextMenu',
  data() {
    return {
      showMenu: false,
      top: '0px',
      left: '0px',
      maxHeight: 480,
    };
  },
  computed: {
    ...mapState(['player']),
  },
  watch: {
    $route() {
      if (this.showMenu) this.closeMenu();
    },
  },
  methods: {
    setMenu(top, left) {
      const margin = 12;
      const bar = document.querySelector('.player');
      const bounds = bar?.getBoundingClientRect();
      const bottom =
        bounds && bounds.top > margin && bounds.top < window.innerHeight
          ? bounds.top - margin
          : window.innerHeight - margin;
      this.maxHeight = Math.max(0, bottom - margin);
      // Apply the height before measuring: a long menu must scroll inside the viewport.
      this.$refs.menu.style.maxHeight = this.maxHeight + 'px';
      const largestTop = Math.max(
        margin,
        bottom - this.$refs.menu.offsetHeight
      );
      const largestLeft = Math.max(
        margin,
        window.innerWidth - this.$refs.menu.offsetWidth - margin
      );
      this.top = Math.max(margin, Math.min(top, largestTop)) + 'px';
      this.left = Math.max(margin, Math.min(left, largestLeft)) + 'px';
    },

    closeMenu() {
      if (!this.showMenu) return;
      this.showMenu = false;
      if (this.$parent.closeMenu !== undefined) {
        this.$parent.closeMenu();
      }
      this.$store.commit('enableScrolling', !this.$store.state.showLyrics);
    },

    openMenu(e) {
      this.showMenu = true;
      this.$nextTick(
        function () {
          if (!this.showMenu || !this.$refs.menu) return;
          this.setMenu(e.y, e.x);
          this.$refs.menu.focus({ preventScroll: true });
        }.bind(this)
      );
      e.preventDefault();
      this.$store.commit('enableScrolling', false);
    },
  },
};
</script>

<style lang="scss">
// Slot content needs shared selectors; keep every rule inside this component's namespace.
.context-menu {
  width: 100%;
  height: 100%;
  user-select: none;
  .menu.menu-reveal-enter-active,
  .menu.menu-reveal-leave-active {
    transition: opacity 0.18s ease, transform 0.18s ease;
  }
  .menu-reveal-enter,
  .menu-reveal-leave-to {
    opacity: 0;
    transform: translateY(-8px);
  }
  .menu.menu-reveal-leave-active {
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .menu.menu-reveal-enter-active,
    .menu.menu-reveal-leave-active {
      transition-duration: 0.01ms;
    }
  }

  .menu {
    position: fixed;
    min-width: 136px;
    width: max-content;
    max-width: min(240px, calc(100vw - 24px));
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    list-style: none;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 6px 12px -4px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.06);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    box-sizing: border-box;
    padding: 6px;
    z-index: 1000;
    -webkit-app-region: no-drag;
    transition: background 125ms ease-out, opacity 125ms ease-out,
      transform 125ms ease-out;

    &:focus {
      outline: none;
    }
  }

  [data-theme='dark'] & {
    .menu {
      background: var(--color-secondary-bg);
      backdrop-filter: blur(16px) contrast(120%) brightness(60%);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.08);
    }
    .menu .item:hover {
      color: var(--color-primary);
    }
  }

  @supports (-moz-appearance: none) {
    .menu {
      background-color: var(--color-secondary-bg) !important;
    }
  }

  .menu .item {
    font-weight: 600;
    font-size: 14px;
    padding: 10px 14px;
    border-radius: 8px;
    cursor: default;
    color: var(--color-text);
    display: flex;
    align-items: center;
    &:hover {
      color: var(--color-primary);
      background: var(--color-primary-bg-for-transparent);
      transition: opacity 125ms ease-out, transform 125ms ease-out;
    }
    &:active {
      opacity: 0.75;
      transform: scale(0.95);
    }

    .svg-icon {
      height: 16px;
      width: 16px;
      margin-right: 5px;
      flex: 0 0 16px;
    }
  }

  hr {
    margin: 4px 10px;
    background: rgba(128, 128, 128, 0.18);
    height: 1px;
    box-shadow: none;
    border: none;
  }

  .item-info {
    padding: 10px 10px;
    display: flex;
    align-items: center;
    color: var(--color-text);
    cursor: default;
    img {
      height: 38px;
      width: 38px;
      border-radius: 4px;
      flex: 0 0 38px;
      object-fit: cover;
      display: block;
    }
    .info {
      min-width: 0;
      flex: 1;
      margin-left: 10px;
    }
    .title {
      font-size: 16px;
      font-weight: 600;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
    }
    .subtitle {
      font-size: 12px;
      opacity: 0.68;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 1;
      overflow: hidden;
      word-break: break-all;
    }
  }
}
</style>
