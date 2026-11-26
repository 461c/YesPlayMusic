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
      <button v-if="active" @click="manager.stop()">取消缓存</button>
    </div>
    <div v-if="active" class="cache-progress" role="status" aria-live="polite">
      <div class="progress-labels">
        <span>
          <strong>{{ manager.stage }}</strong>
          <template v-if="manager.currentSong">
            · {{ manager.currentSong }}
          </template>
        </span>
        <span v-if="manager.networkPending">等待网络响应</span>
        <span v-else-if="manager.songTotal">
          已检查 {{ manager.songChecked }} 首 · 已处理 {{ manager.songDone }} /
          {{ manager.songTotal }} 首
        </span>
      </div>
      <div
        v-if="manager.songTotal"
        class="progress-track"
        role="progressbar"
        :aria-valuenow="manager.songDone"
        :aria-valuemax="manager.songTotal"
        aria-label="歌单缓存进度"
      >
        <span :style="{ width: songPercent + '%' }"></span>
      </div>
      <div v-if="manager.phaseTotal" class="phase-progress">
        <div class="progress-labels">
          <span>{{ manager.phaseLabel }}</span>
          <span>{{ manager.phaseProgress }} / {{ manager.phaseTotal }}</span>
        </div>
        <div class="progress-track phase-track" role="progressbar">
          <span :style="{ width: phasePercent + '%' }"></span>
        </div>
      </div>
      <div v-if="manager.activeDownloadKind === 'audio'" class="file-progress">
        <div class="progress-labels">
          <span>
            下载 {{ formatBytes(manager.downloadedBytes) }}
            <template v-if="manager.downloadTotalBytes">
              / {{ formatBytes(manager.downloadTotalBytes) }}
            </template>
          </span>
          <span>
            {{
              manager.downloadSpeed ? formatSpeed(manager.downloadSpeed) : ''
            }}
          </span>
        </div>
        <div
          v-if="manager.downloadTotalBytes"
          class="progress-track file-track"
        >
          <span :style="{ width: filePercent + '%' }"></span>
        </div>
        <div v-else class="progress-track indeterminate-track">
          <span></span>
        </div>
      </div>
      <div
        v-else-if="manager.currentTargetImagesTotal"
        class="progress-labels image-progress"
      >
        <span
          >封面 {{ manager.currentTargetImagesDone }} /
          {{ manager.currentTargetImagesTotal }}</span
        >
        <span v-if="manager.stage.includes('下载')">{{ manager.stage }}</span>
      </div>
    </div>
    <p v-else-if="busy" class="cache-progress" role="status"
      >正在处理其他缓存任务：{{ manager.currentSong || manager.stage }}</p
    >
    <p v-else-if="message" role="status">{{ message }}</p>
    <template v-if="expanded && known"
      ><p>{{ missing.length ? '待缓存歌曲' : '所有歌曲均可离线播放' }}</p
      ><ul v-if="missing.length"
        ><li v-for="trackId in missing.slice(0, limit)" :key="trackId">{{
          names[trackId] || '歌曲 ' + trackId
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
    name: { type: String, default: '' },
    cover: { type: String, default: '' },
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
      requesting: false,
      online: navigator.onLine,
      generation: 0,
    };
  },
  computed: {
    supported() {
      return !!(window.YesPlayMusicAndroid || process.env.IS_ELECTRON);
    },
    target() {
      return (
        cacheTargets(this.$store.state).find(
          t => t.key === this.type + ':' + this.id
        ) || {
          key: this.type + ':' + this.id,
          id: this.id,
          type: this.type,
          group: 'saved',
          name: this.name,
          cover: this.cover,
        }
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
      return (
        this.busy &&
        (this.requesting || this.manager.currentTargetKey === this.target?.key)
      );
    },
    offline() {
      return !this.online || this.$store.state.settings.archiveMode;
    },
    songPercent() {
      if (!this.manager.songTotal) return 0;
      const activeFraction =
        this.manager.activeDownloadKind === 'audio' &&
        this.manager.downloadTotalBytes
          ? Math.min(
              0.99,
              this.manager.downloadedBytes / this.manager.downloadTotalBytes
            )
          : 0;
      return Math.round(
        Math.min(
          100,
          ((this.manager.songDone + activeFraction) / this.manager.songTotal) *
            100
        )
      );
    },
    filePercent() {
      return this.manager.downloadTotalBytes
        ? Math.min(
            100,
            Math.round(
              (this.manager.downloadedBytes / this.manager.downloadTotalBytes) *
                100
            )
          )
        : 0;
    },
    phasePercent() {
      return this.manager.phaseTotal
        ? Math.min(
            100,
            Math.round(
              (this.manager.phaseProgress / this.manager.phaseTotal) * 100
            )
          )
        : 0;
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
      this.requesting = true;
      try {
        await this.manager.run('update', [this.target]);
        this.message = this.manager.message;
      } catch (e) {
        this.message = e.message;
      } finally {
        this.requesting = false;
        this.$emit('complete');
      }
    },
    formatBytes(value) {
      const bytes = Number(value) || 0;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    },
    formatSpeed(value) {
      const speed = Number(value) || 0;
      return speed >= 1024 * 1024
        ? `${(speed / 1024 / 1024).toFixed(1)} MB/s`
        : `${(speed / 1024).toFixed(0)} KB/s`;
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
.cache-progress {
  margin-top: 12px;
}
.progress-labels {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  opacity: 0.78;
}
.progress-labels span:first-child {
  min-width: 0;
  overflow-wrap: anywhere;
}
.progress-track {
  height: 5px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-body-bg);
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary-gradient);
  transition: width 160ms linear;
}
.file-progress {
  margin-top: 10px;
}
.phase-progress {
  margin-top: 10px;
}
.phase-track {
  height: 3px;
}
.file-track {
  height: 3px;
}
.indeterminate-track span {
  width: 35%;
  animation: cache-progress 1s ease-in-out infinite alternate;
}
@keyframes cache-progress {
  to {
    transform: translateX(185%);
  }
}
</style>
