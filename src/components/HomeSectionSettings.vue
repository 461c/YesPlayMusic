<template>
  <details
    id="home-sections"
    class="home-section-settings"
    :open="$route.hash === '#home-sections'"
  >
    <summary
      >首页栏目<span>已启用 {{ selected.length }} 项</span></summary
    >
    <div class="heading"
      ><strong>首页栏目</strong><button @click="reset">恢复默认</button></div
    >
    <div v-for="section in ordered" :key="section.key" class="section-option">
      <label
        ><input
          type="checkbox"
          :checked="selected.includes(section.key)"
          @change="toggle(section.key, $event.target.checked)"
        />{{ section.title }}</label
      >
      <div v-if="selected.includes(section.key)" class="order-buttons"
        ><button
          :disabled="selected.indexOf(section.key) === 0"
          :aria-label="'上移' + section.title"
          @click="move(section.key, -1)"
          >上移</button
        ><button
          :disabled="selected.indexOf(section.key) === selected.length - 1"
          :aria-label="'下移' + section.title"
          @click="move(section.key, 1)"
          >下移</button
        ></div
      >
    </div>
  </details>
</template>
<script>
import {
  homeSectionCatalog,
  normalizeHomeSections,
} from '@/utils/homeSections';
export default {
  name: 'HomeSectionSettings',
  computed: {
    selected() {
      const settings = this.$store.state.settings;
      return normalizeHomeSections(
        settings.homeSections,
        settings.showPlaylistsByAppleMusic
      );
    },
    ordered() {
      return [
        ...this.selected.map(key =>
          homeSectionCatalog.find(item => item.key === key)
        ),
        ...homeSectionCatalog.filter(item => !this.selected.includes(item.key)),
      ];
    },
  },
  methods: {
    save(value) {
      this.$store.commit('updateSettings', { key: 'homeSections', value });
    },
    toggle(key, enabled) {
      this.save(
        enabled
          ? [...this.selected, key]
          : this.selected.filter(item => item !== key)
      );
    },
    move(key, delta) {
      const next = this.selected.indexOf(key) + delta,
        current = this.selected.indexOf(key);
      if (current < 0 || next < 0 || next >= this.selected.length) return;
      const value = [...this.selected];
      [value[current], value[next]] = [value[next], value[current]];
      this.save(value);
    },
    reset() {
      this.save(normalizeHomeSections(null));
    },
  },
};
</script>
<style lang="scss" scoped>
.home-section-settings {
  margin: 28px 0 36px;
  color: var(--color-text);
  scroll-margin-top: 100px;
}
summary {
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  padding: 12px 0;
  span {
    font-size: 13px;
    opacity: 0.6;
  }
}
.heading,
.section-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.heading {
  margin-bottom: 12px;
}
.section-option {
  padding: 10px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.12);
  label {
    display: flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-size: 14px;
  }
  input {
    accent-color: var(--color-primary);
    width: 17px;
    height: 17px;
  }
}
button {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 12px;
  &:disabled {
    opacity: 0.3;
  }
}
.order-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}
</style>
