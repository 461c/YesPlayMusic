<template>
  <span class="library-avatar-menu">
    <button class="avatar-trigger" aria-label="切换音乐库" @click="open"
      ><img
        v-if="avatar"
        v-image-fade
        :src="avatar | resizeImage(96)"
        alt=""
      /><span v-else>{{ label.slice(0, 1) }}</span></button
    >
    <ContextMenu ref="menu" class="library-person-menu">
      <div class="item" @click="$router.push('/library')">我的音乐库</div>
      <div
        v-for="user in users"
        :key="user.id"
        class="item"
        @click="
          $router.push({ name: 'libraryPerson', params: { uid: user.id } })
        "
        >{{ user.alias || user.name || user.id }}</div
      >
      <hr /><div class="item" @click="$router.push({ name: 'libraryPeople' })"
        >人员管理</div
      >
    </ContextMenu>
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
    label: { type: String, default: '音乐库' },
  },
  data() {
    return { users: [] };
  },
  methods: {
    async open(event) {
      const bounds = event.currentTarget.getBoundingClientRect();
      const scope = trackingScope(this.$store.state.data.user?.userId);
      this.users = await readTrackingList(scope);
      if (
        scope !== trackingScope(this.$store.state.data.user?.userId) ||
        this._isDestroyed
      )
        return;
      this.$refs.menu.openMenu({
        x: bounds.left,
        y: bounds.bottom + 6,
        preventDefault() {},
      });
    },
  },
};
</script>
<style lang="scss" scoped>
.library-avatar-menu {
  width: 44px;
  height: 44px;
  display: inline-flex;
  flex-shrink: 0;
  margin-right: 12px;
}
.avatar-trigger {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  font: inherit;
  font-size: 22px;
  cursor: pointer;
  flex-shrink: 0;
  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
  }
}
</style>
<style lang="scss">
.context-menu.library-person-menu .menu {
  width: max-content;
  max-width: min(480px, calc(100vw - 24px));
}
.context-menu.library-person-menu .item {
  white-space: normal;
  overflow-wrap: anywhere;
}
</style>

<style lang="scss" scoped>
.library-avatar-menu > .context-menu {
  width: 0;
  height: 0;
}
</style>
