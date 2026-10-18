<template>
  <span
    ref="root"
    class="library-avatar-menu"
    @pointerdown="press"
    @pointermove="move"
    @pointerup="cancelPress"
    @pointercancel="cancelPress"
    @pointerleave="cancelPress"
    @contextmenu.prevent="manageMenu"
  >
    <button
      ref="trigger"
      class="avatar-stack"
      aria-label="用户头像"
      :aria-expanded="expanded"
      aria-controls="library-person-picker"
      @click="toggle"
    >
      <span
        v-for="(person, index) in stack"
        :key="person.key"
        class="stack-face"
        :style="{
          transform: 'translateX(0)',
          zIndex: stack.length - index,
        }"
        ><img
          v-if="person.avatar"
          v-image-fade
          :src="person.avatar | resizeImage(96)"
          alt=""
        /><span v-else>{{ person.name.slice(0, 1) }}</span></span
      >
    </button>
    <transition name="people-expand">
      <div
        v-if="expanded"
        id="library-person-picker"
        class="people-picker"
        :style="{
          gridTemplateColumns:
            'repeat(' + Math.min(stack.length, pickerColumns) + ', 72px)',
        }"
        aria-label="选择用户"
        @keydown.esc.stop="escape"
      >
        <button
          v-for="person in stack"
          :key="person.key"
          class="person-option"
          :class="{ current: person.key === currentKey }"
          :aria-current="person.key === currentKey ? 'page' : null"
          @click="select(person)"
        >
          <span class="person-face"
            ><img
              v-if="person.avatar"
              v-image-fade
              :src="person.avatar | resizeImage(96)"
              alt=""
            /><span v-else>{{ person.name.slice(0, 1) }}</span></span
          >
          <span class="person-name">{{ person.name }}</span>
        </button>
      </div>
    </transition>
    <ContextMenu ref="menu" class="library-person-menu"
      ><div class="item" @click="$router.push({ name: 'libraryPeople' })"
        >管理</div
      ></ContextMenu
    >
  </span>
</template>
<script>
import ContextMenu from '@/components/ContextMenu.vue';
import { trackingScope, readTrackingList } from '@/utils/trackingStore';
export default {
  name: 'LibraryAvatarMenu',
  components: { ContextMenu },
  props: {
    avatar: { type: String, default: '' },
    label: { type: String, default: '我的' },
  },
  data() {
    return {
      users: [],
      expanded: false,
      pressTimer: null,
      suppressClickUntil: 0,
      generation: 0,
      pickerColumns: 8,
    };
  },
  computed: {
    scope() {
      return trackingScope(this.$store.state.data.user?.userId);
    },
    currentKey() {
      return this.$route.name === 'libraryPerson'
        ? String(this.$route.params.uid)
        : 'self';
    },
    people() {
      const own = this.$store.state.data.user || {};
      const people = [
        {
          key: 'self',
          name: '我(' + (own.nickname || '未登录') + ')',
          avatar: own.avatarUrl || '',
        },
        ...this.users
          .filter(user => String(user.id) !== String(own.userId))
          .map(user => ({
            key: String(user.id),
            name: user.alias || user.name || String(user.id),
            avatar: user.avatar || '',
          })),
      ];
      if (
        this.currentKey !== 'self' &&
        !people.some(person => person.key === this.currentKey)
      )
        people.push({
          key: this.currentKey,
          name: this.label,
          avatar: this.avatar,
        });
      return people.map(person =>
        person.key === this.currentKey
          ? {
              ...person,
              avatar: this.avatar || person.avatar,
              name:
                person.key === 'self' ? person.name : this.label || person.name,
            }
          : person
      );
    },
    stack() {
      return [
        ...this.people.filter(person => person.key === this.currentKey),
        ...this.people.filter(person => person.key !== this.currentKey),
      ];
    },
  },
  watch: {
    scope: {
      immediate: true,
      handler() {
        this.users = [];
        this.close();
        this.reload();
      },
    },
    $route() {
      this.close();
    },
  },
  mounted() {
    this.measurePicker();
    window.addEventListener('resize', this.measurePicker);
    document.addEventListener('pointerdown', this.outside);
    document.addEventListener('keydown', this.escape);
  },
  activated() {
    this.reload();
  },
  deactivated() {
    this.close();
    this.generation++;
    this.$refs.menu?.closeMenu();
  },
  beforeDestroy() {
    this.$refs.menu?.closeMenu();
    this.close();
    this.generation++;
    window.removeEventListener('resize', this.measurePicker);
    document.removeEventListener('pointerdown', this.outside);
    document.removeEventListener('keydown', this.escape);
  },
  methods: {
    measurePicker() {
      const left = this.$el.getBoundingClientRect().left - 10;
      this.pickerColumns = Math.max(
        1,
        Math.min(
          8,
          Math.floor(
            (window.innerWidth - Math.max(12, left) - 12 - 18 + 8) / 80
          )
        )
      );
    },
    async reload() {
      const generation = ++this.generation,
        scope = this.scope;
      const users = await readTrackingList(scope);
      if (
        generation === this.generation &&
        scope === this.scope &&
        !this._isDestroyed
      )
        this.users = users;
    },
    toggle() {
      if (
        Date.now() < this.suppressClickUntil ||
        !this.users.some(
          user =>
            String(user.id) !== String(this.$store.state.data.user?.userId)
        )
      )
        return;
      this.measurePicker();
      this.expanded = !this.expanded;
      if (this.expanded) {
        this.reload();
        this.$nextTick(() =>
          this.$el
            .querySelector('.person-option')
            ?.focus({ preventScroll: true })
        );
      }
    },
    close() {
      this.expanded = false;
      this.cancelPress();
    },
    outside(event) {
      if (!this.$el.contains(event.target)) this.close();
    },
    escape(event) {
      if (event.key === 'Escape' && this.expanded) {
        this.close();
        this.$refs.trigger.focus({ preventScroll: true });
      }
    },
    select(person) {
      if (Date.now() < this.suppressClickUntil) return;
      this.close();
      this.$router.push(
        person.key === 'self'
          ? '/library'
          : { name: 'libraryPerson', params: { uid: person.key } }
      );
    },
    press(event) {
      if (event.button !== 0) return;
      this.cancelPress();
      this.pressOrigin = { x: event.clientX, y: event.clientY };
      this.pressTimer = setTimeout(() => this.manageMenu(), 500);
    },
    move(event) {
      if (
        this.pressOrigin &&
        Math.hypot(
          event.clientX - this.pressOrigin.x,
          event.clientY - this.pressOrigin.y
        ) > 10
      )
        this.cancelPress();
    },
    cancelPress() {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
      this.pressOrigin = null;
    },
    manageMenu() {
      this.close();
      this.suppressClickUntil = Date.now() + 800;
      const bounds = this.$refs.trigger.getBoundingClientRect();
      this.$refs.menu.openMenu({
        x: bounds.left,
        y: bounds.bottom + 8,
        preventDefault() {},
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.library-avatar-menu {
  position: relative;
  display: inline-flex;
  height: 52px;
  align-items: center;
  flex-shrink: 0;
  margin-right: 14px;
  font-size: 14px;
  font-weight: 500;
  z-index: 5;
}
.avatar-stack {
  position: relative;
  z-index: 1;
  height: 44px;
  width: 44px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  touch-action: pan-y;
  user-select: none;
  -webkit-touch-callout: none;
}
.stack-face,
.person-face {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  color: var(--color-text);
  background: var(--color-secondary-bg);
  font-size: 20px;
  overflow: hidden;
  box-sizing: border-box;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.stack-face {
  position: absolute;
  right: 0;
  top: 0;
  border: none;
  box-shadow: none;
}
.people-picker {
  position: absolute;
  z-index: 2;
  top: -8px;
  left: -10px;
  width: max-content;
  max-height: min(440px, 65vh);
  overflow-y: auto;
  overscroll-behavior: contain;
  display: grid;
  gap: 8px;
  padding: 8px;
  box-sizing: border-box;
  border-radius: 18px;
  background: var(--color-body-bg);
  color: var(--color-text);
  border: 1px solid rgba(128, 128, 128, 0.2);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.16);
}
.person-option {
  width: 72px;
  box-sizing: border-box;
  min-width: 0;
  padding: 8px 4px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  font: inherit;
  &:hover,
  &:focus-visible {
    background: var(--color-secondary-bg);
  }
  &.current {
    background: var(--color-primary-bg);
    color: var(--color-primary);
  }
}
.person-name {
  max-width: 100%;
  line-height: 1.4;
  overflow-wrap: anywhere;
  text-align: center;
  font-size: 13px;
}
.people-expand-enter-active,
.people-expand-leave-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.people-expand-enter,
.people-expand-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
.library-avatar-menu > .context-menu {
  width: 0;
  height: 0;
}
@media (prefers-reduced-motion: reduce) {
  .people-expand-enter-active,
  .people-expand-leave-active {
    transition: none;
  }
}
</style>
