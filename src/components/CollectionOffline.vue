<template>
  <section v-if="target && supported" class="collection-offline">
    <div class="actions">
      <button
        class="count"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
        >{{
          known
            ? ready.length + ' / ' + ids.length + ' 首可离线'
            : '正在读取离线状态'
        }}
        ▾</button
      >
      <button v-if="ready.length" @click="play">播放离线歌曲</button>
      <button v-if="missing.length" :disabled="busy || offline" @click="cache"
        >缓存剩余 {{ missing.length }} 首</button
      >
      <template v-if="active"
        ><button @click="manager.paused ? manager.resume() : manager.pause()">{{
          manager.paused ? '继续' : '暂停'
        }}</button
        ><button @click="manager.stop()">取消</button></template
      >
    </div>
    <p v-if="active" role="status"
      >{{ manager.stage }} · {{ manager.songDone }} / {{ manager.songTotal }} 首
      <span v-if="manager.downloadSpeed"
        >{{ (manager.downloadSpeed / 1024).toFixed(0) }} KB/s</span
      ></p
    >
    <p v-else-if="message" role="status">{{ message }}</p>
    <template v-if="expanded && known"
      ><p>{{ missing.length ? '待缓存歌曲' : '所有歌曲均可离线播放' }}</p
      ><ul v-if="missing.length"
        ><li v-for="id in missing.slice(0, limit)" :key="id">{{
          names[id] || '歌曲 ' + id
        }}</li></ul
      ><button v-if="limit < missing.length" @click="limit += 100"
        >显示更多</button
      ></template
    >
  </section>
</template>
<script>
import { playableLibraryIds } from '@/utils/db';
import { libraryCacheManager, cacheTargets } from '@/utils/libraryCache';
export default {
  props: {
    id: { type: [Number, String], required: true },
    type: { type: String, required: true },
    members: { type: Array, required: true },
    tracks: { type: Array, required: true },
  },
  data() {
    return {
      manager: libraryCacheManager(this.$store),
      available: new Set(),
      known: false,
      expanded: false,
      limit: 100,
      message: '',
      online: navigator.onLine,
      generation: 0,
    };
  },
  computed: {
    supported() {
      return !!(window.YesPlayMusicAndroid || process.env.IS_ELECTRON);
    },
    target() {
      return cacheTargets(this.$store.state).find(
        t => t.key === this.type + ':' + this.id
      );
    },
    ids() {
      return this.members.map(t => Number(t.id ?? t));
    },
    names() {
      return Object.fromEntries(this.tracks.map(t => [t.id, t.name]));
    },
    ready() {
      return this.ids.filter(id => this.available.has(String(id)));
    },
    missing() {
      return this.known
        ? this.ids.filter(id => !this.available.has(String(id)))
        : [];
    },
    busy() {
      return this.manager.running || this.manager.starting;
    },
    active() {
      return this.busy && this.manager.currentTargetKey === this.target?.key;
    },
    offline() {
      return !this.online || this.$store.state.settings.archiveMode;
    },
  },
  watch: {
    id: 'read',
    busy(value) {
      if (!value) this.read();
    },
  },
  mounted() {
    this.read();
    window.addEventListener('online', this.network);
    window.addEventListener('offline', this.network);
  },
  beforeDestroy() {
    this.generation++;
    window.removeEventListener('online', this.network);
    window.removeEventListener('offline', this.network);
  },
  methods: {
    network() {
      this.online = navigator.onLine;
    },
    async read() {
      const version = ++this.generation;
      this.known = false;
      this.available = new Set();
      try {
        const ids = await playableLibraryIds();
        if (version === this.generation) {
          this.available = ids;
          this.known = true;
        }
      } catch (_) {
        this.message = '无法读取本地音频状态';
      }
    },
    async play() {
      await this.read();
      if (this.ready.length)
        this.$store.state.player.replacePlaylist(
          this.ready,
          this.id,
          this.type
        );
    },
    async cache() {
      if (!this.target || this.busy || this.offline) return;
      try {
        await this.manager.run('update', [this.target]);
        this.message = this.manager.message;
      } catch (e) {
        this.message = e.message;
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.collection-offline {
  margin: 20px 0;
  padding: 14px 18px;
  border-radius: 12px;
  color: var(--color-text);
  background: var(--color-secondary-bg);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.collection-offline button {
  padding: 7px 11px;
  border-radius: 8px;
  background: var(--color-body-bg);
  color: inherit;
}
.collection-offline .count {
  margin-right: auto;
  background: transparent;
  font-weight: 600;
}
.collection-offline p,
.collection-offline li {
  font-size: 13px;
}
.collection-offline ul {
  max-height: 220px;
  overflow: auto;
}
.collection-offline button:disabled {
  opacity: 0.5;
}
</style>
