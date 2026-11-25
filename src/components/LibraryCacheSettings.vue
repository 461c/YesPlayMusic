<template>
  <section class="settings-card library-cache-settings">
    <header class="cache-header">
      <div>
        <h4>手动缓存收藏</h4>
        <p class="cache-note"
          >检查全部收藏后，可按当前音质补齐缺少的音乐和封面。</p
        >
      </div>
      <div class="cache-actions">
        <button :disabled="busy || !targets.length" @click="run('check')"
          >检查全部</button
        >
        <button
          class="primary-action"
          :disabled="busy || !markedCount"
          @click="run('update')"
          >更新已标记（{{ markedCount }}）</button
        >
      </div>
    </header>

    <div v-if="busy || manager.message" class="cache-task">
      <div class="task-details" role="status">
        <span>{{ manager.message || '正在准备缓存任务' }}</span>
        <small v-if="manager.running"
          >已处理 {{ manager.progress }} / {{ manager.total }} 项</small
        >
      </div>
      <button v-if="busy" :disabled="manager.stopped" @click="manager.stop()"
        >停止</button
      >
      <progress
        v-if="manager.running && manager.total"
        :value="manager.progress"
        :max="manager.total"
        aria-label="收藏处理进度"
      ></progress>
    </div>

    <div class="cache-groups" role="group" aria-label="选择收藏分组">
      <button
        v-for="item in groups"
        :key="item.key"
        :aria-pressed="group === item.key"
        @click="group = item.key"
      >
        {{ item.title }} <small>{{ grouped[item.key].length }}</small>
      </button>
    </div>
    <div class="group-header">
      <h5
        >{{ groupTitle }} <small>共 {{ visible.length }} 项</small></h5
      >
      <div class="cache-actions">
        <button
          :disabled="busy || !visible.length"
          @click="run('check', visible)"
          >检查本组</button
        >
        <button
          :disabled="busy || !visible.length"
          @click="run('update', visible)"
          >缓存本组</button
        >
      </div>
    </div>
    <ul v-if="visible.length" class="cache-entries">
      <li
        v-for="item in visible.slice(0, displayLimit)"
        :key="item.key"
        class="cache-entry"
      >
        <div class="cache-entry-text">
          <strong>{{ item.name || item.id }}</strong>
          <span v-if="item.archiveStatus">已移除或不可见 · 保留缓存</span>
          <span
            v-if="manager.marks[item.key]"
            :class="'cache-status-' + manager.marks[item.key].status"
          >
            {{ status(manager.marks[item.key]) }}
          </span>
          <span v-else>未检查</span>
        </div>
        <button
          :disabled="busy"
          :aria-label="'缓存' + (item.name || item.id) + '的图片和音乐'"
          @click="run('update', [item])"
          >缓存</button
        >
      </li>
    </ul>
    <p v-else class="cache-note empty-group"
      >本组暂无已保存的收藏，可先打开“我的”加载。</p
    >
    <button
      v-if="visible.length > displayLimit"
      class="show-more"
      @click="displayLimit += 30"
      >显示更多（{{ displayLimit }}/{{ visible.length }}）</button
    >
  </section>
</template>
<script>
import {
  cacheGroups,
  libraryCacheManager,
  cacheTargets,
  needsCacheUpdate,
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
    markedCount() {
      return this.targets.filter(item =>
        needsCacheUpdate(this.manager.marks[item.key])
      ).length;
    },
    grouped() {
      const result = { likes: [], created: [], saved: [], albums: [] };
      this.targets.forEach(item => result[item.group].push(item));
      return result;
    },
    groupTitle() {
      return this.groups.find(item => item.key === this.group).title;
    },
    visible() {
      return this.grouped[this.group];
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
.library-cache-settings {
  color: var(--color-text);
}
h4,
h5,
p {
  margin: 0;
}
h4 {
  font-size: 16px;
}
h5 {
  font-size: 15px;
  small {
    margin-left: 4px;
    font-size: 12px;
    font-weight: normal;
    opacity: 0.65;
  }
}
.cache-note,
.task-details small,
.cache-entry-text span {
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.7;
}
.cache-note {
  margin-top: 5px;
}
.cache-header,
.group-header,
.cache-actions,
.cache-entry {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cache-header,
.group-header {
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 12px;
}
.cache-actions {
  flex-wrap: wrap;
}
button {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 9px 12px;
  color: inherit;
  background: var(--color-secondary-bg);
  cursor: pointer;
  font-size: 13px;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:not(:disabled):hover,
.primary-action:not(:disabled),
.cache-groups button[aria-pressed='true'] {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.cache-groups button[aria-pressed='true'] {
  border-color: currentColor;
}
.cache-task {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 12px;
  border-radius: 10px;
  background: var(--color-secondary-bg);
  progress {
    grid-column: 1 / -1;
    width: 100%;
    height: 5px;
    accent-color: var(--color-primary);
  }
  button {
    border-color: rgba(128, 128, 128, 0.35);
  }
}
.task-details {
  font-size: 13px;
  overflow-wrap: anywhere;
  small {
    display: block;
  }
}
.cache-groups {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 18px 0;
  padding-top: 16px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
  small {
    opacity: 0.75;
  }
}
.cache-entries {
  margin: 8px 0;
  padding: 0;
  list-style: none;
}
.cache-entry {
  padding: 10px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.14);
}
.cache-entry-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  strong,
  span {
    display: block;
  }
  strong {
    font-size: 14px;
    font-weight: 550;
  }
  .cache-status-update,
  .cache-status-partial {
    color: var(--color-primary);
    opacity: 1;
  }
}
.empty-group,
.show-more {
  margin: 12px 0;
}
@media (max-width: 600px) {
  .cache-header {
    display: grid;
  }
  .cache-groups button {
    padding: 9px 2px;
  }
}
@media (max-width: 360px) {
  .cache-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
