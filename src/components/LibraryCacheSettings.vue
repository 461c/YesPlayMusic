<template>
  <section class="settings-card library-cache-settings">
    <h4 class="card-heading">手动缓存收藏</h4>
    <div class="cache-actions">
      <button :disabled="busy || !targets.length" @click="run('check')"
        >检查全部</button
      >
      <button :disabled="busy || !targets.length" @click="run('update')"
        >更新已标记</button
      >
      <button v-if="busy" @click="manager.stop()">停止</button>
    </div>
    <p class="cache-note"
      >保存图片和完整音乐，使用当前音质；已有缓存直接复用。更新串行进行，遇到验证或限流暂停，删除与失效内容只标记、保留。</p
    >
    <div class="cache-groups" role="tablist" aria-label="缓存分组">
      <button
        v-for="item in groups"
        :key="item.key"
        role="tab"
        :aria-selected="group === item.key"
        :class="{ active: group === item.key }"
        @click="group = item.key"
        >{{ item.title }}
        <small>{{
          targets.filter(target => target.group === item.key).length
        }}</small></button
      >
    </div>
    <div class="group-actions">
      <button :disabled="busy || !visible.length" @click="run('check', visible)"
        >检查本组</button
      >
      <button
        :disabled="busy || !visible.length"
        @click="run('update', visible)"
        >缓存本组图片和音乐</button
      >
    </div>
    <p v-if="manager.message" class="cache-progress" role="status"
      >{{ manager.message
      }}<span v-if="busy">
        · {{ manager.progress }}/{{ manager.total }}</span
      ></p
    >
    <div class="cache-entries">
      <div
        v-for="item in visible.slice(0, displayLimit)"
        :key="item.key"
        class="cache-entry"
      >
        <div class="cache-entry-text"
          ><strong>{{ item.name || item.id }}</strong
          ><span v-if="item.archiveStatus">已移除或不可见 · 保留缓存</span
          ><span
            v-if="manager.marks[item.key]"
            :class="'cache-status-' + manager.marks[item.key].status"
            >{{ status(manager.marks[item.key]) }}</span
          ><span v-else>未检查</span></div
        >
        <button
          :disabled="busy"
          :aria-label="'缓存' + (item.name || item.id) + '的图片和音乐'"
          @click="run('update', [item])"
          >缓存</button
        >
      </div>
    </div>
    <button v-if="visible.length > displayLimit" @click="displayLimit += 30"
      >显示更多（{{ displayLimit }}/{{ visible.length }}）</button
    >
    <p v-if="!visible.length" class="cache-note"
      >暂无已保存的内容，可先打开“我的”加载收藏。</p
    >
  </section>
</template>
<script>
import {
  cacheGroups,
  libraryCacheManager,
  cacheTargets,
} from '@/utils/libraryCache';
export default {
  name: 'LibraryCacheSettings',
  data() {
    return {
      group: 'likes',
      displayLimit: 30,
      groups: cacheGroups,
      manager: libraryCacheManager(this.$store),
    };
  },
  computed: {
    targets() {
      return cacheTargets(this.$store.state);
    },
    visible() {
      return this.targets.filter(item => item.group === this.group);
    },
    busy() {
      return this.manager.running || this.manager.starting;
    },
    account() {
      return String(this.$store.state.data.user?.userId || '');
    },
  },
  watch: {
    group() {
      this.displayLimit = 30;
    },
    busy: {
      immediate: true,
      handler(value) {
        this.$emit('busy', value);
      },
    },
    account() {
      this.manager.stop();
      this.manager.restore().catch(() => {});
    },
  },
  created() {
    this.manager.restore().catch(() => {
      this.manager.message = '无法读取缓存检查记录';
    });
  },
  activated() {
    this.manager.restore().catch(() => {});
  },
  methods: {
    run(mode, items) {
      this.manager.run(mode, items).catch(error => {
        this.manager.message = error.message || '缓存任务失败，原缓存保留';
      });
    },
    status(mark) {
      const label =
        {
          cached: '已缓存',
          update: '待更新',
          partial: '部分缓存',
          unavailable: '不可见 · 保留缓存',
          error: '检查或缓存失败',
        }[mark.status] || '未检查';
      const count =
        mark.songs === undefined
          ? ''
          : ` · 音乐 ${mark.cached || 0}/${mark.songs}`;
      return label + count + (mark.reason ? ' · ' + mark.reason : '');
    },
  },
};
</script>
<style lang="scss" scoped>
.card-heading {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
}
.cache-actions,
.group-actions,
.cache-groups {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
button {
  border: 0;
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--color-text);
  background: var(--color-secondary-bg);
  cursor: pointer;
  font-size: 13px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
button:not(:disabled):hover,
.cache-groups .active {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.cache-note {
  font-size: 12px;
  line-height: 1.7;
  opacity: 0.6;
  margin: 14px 0;
}
.cache-groups {
  margin: 20px 0 12px;
  small {
    opacity: 0.55;
  }
}
.group-actions {
  margin-bottom: 14px;
}
.cache-progress {
  font-size: 13px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.cache-entries {
  min-width: 0;
}
.cache-entry {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.12);
}
.cache-entry:last-child {
  border-bottom: 0;
}
.cache-entry-text {
  flex: 1;
  min-width: 0;
  strong {
    display: block;
    font-size: 14px;
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  span {
    display: block;
    font-size: 12px;
    line-height: 1.5;
    opacity: 0.65;
    margin-top: 4px;
    overflow-wrap: anywhere;
  }
}
.cache-entry button {
  flex-shrink: 0;
}
.cache-entry .cache-status-update {
  color: var(--color-primary);
  opacity: 1;
}
</style>
