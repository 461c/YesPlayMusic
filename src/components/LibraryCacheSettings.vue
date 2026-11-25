<template>
  <section class="settings-card library-cache-settings">
    <header class="cache-header">
      <div>
        <h4>手动缓存收藏</h4>
        <p class="cache-note">检查本地收藏记录，按当前音质补齐音乐与封面。</p>
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

    <div
      v-if="busy || manager.message"
      class="cache-task"
      :class="{ 'task-paused': manager.paused }"
    >
      <div class="task-topline">
        <span class="task-indicator" :class="taskStateClass"></span>
        <strong>{{ taskStateLabel }}</strong>
        <span class="task-phase">{{ manager.stage }}</span>
      </div>
      <div class="task-details" role="status" aria-live="polite">
        <span>{{ manager.message || '正在准备缓存任务' }}</span>
        <span v-if="busy && manager.currentSong" class="task-current"
          >当前歌曲：{{ manager.currentSong }}</span
        >
      </div>
      <div class="task-metrics">
        <span v-if="manager.songTotal">
          {{ manager.mode === 'check' ? '已检查歌曲' : '已核对缓存状态' }}
          <b>{{ manager.songChecked }}/{{ manager.songTotal }}</b>
        </span>
        <span v-if="manager.mode === 'update' && manager.detailsTotal">
          歌曲信息 <b>{{ manager.detailsLoaded }}/{{ manager.detailsTotal }}</b>
        </span>
        <span v-if="manager.imagesTotal">
          封面 <b>{{ manager.imagesDone }}/{{ manager.imagesTotal }}</b>
          <small>已缓存 {{ manager.imagesCached }}</small>
        </span>
      </div>
      <div v-if="manager.total" class="task-progress-group">
        <div class="progress-labels">
          <span
            >全任务 <b>{{ manager.progress }} / {{ manager.total }} 项</b>
            <small v-if="busy && manager.currentTargetKey"
              >当前项
              {{ Math.round(manager.currentTargetFraction * 100) }}%</small
            ></span
          >
          <span>{{ overallPercent }}%</span>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          :aria-valuenow="overallProgressValue"
          :aria-valuemax="manager.total"
          aria-label="全任务进度"
        >
          <span :style="{ width: overallPercent + '%' }"></span>
        </div>
      </div>
      <div v-if="manager.phaseLabel" class="phase-progress-group">
        <div class="progress-labels">
          <span
            >{{ manager.phaseLabel }}
            <b v-if="manager.phaseTotal"
              >{{ manager.phaseProgress }}/{{ manager.phaseTotal }}</b
            >
          </span>
          <span v-if="manager.networkPending" class="request-pending"
            >等待响应</span
          >
          <span v-else-if="manager.phaseTotal">{{ phasePercent }}%</span>
        </div>
        <div
          v-if="manager.phaseTotal"
          class="progress-track phase-track"
          :class="{ 'is-waiting': manager.networkPending }"
          role="progressbar"
          :aria-valuenow="manager.phaseProgress"
          :aria-valuemax="manager.phaseTotal"
          aria-label="当前阶段进度"
        >
          <span :style="{ width: phasePercent + '%' }"></span>
        </div>
        <div
          v-else-if="manager.networkPending"
          class="progress-track phase-track indeterminate-track"
          aria-label="正在等待网络响应"
        >
          <span></span>
        </div>
      </div>
      <div
        v-if="manager.songTotal || manager.songChecked"
        class="task-progress-group song-progress-group"
      >
        <div class="progress-labels">
          <span
            >{{ manager.mode === 'check' ? '已检查歌曲' : '已处理歌曲' }}
            <b
              >{{
                manager.mode === 'check'
                  ? manager.songChecked
                  : manager.songDone
              }}
              / {{ manager.songTotal }}</b
            ></span
          >
          <span v-if="manager.mode === 'update' && manager.currentSong"
            >第 {{ manager.songIndex }} 首</span
          >
        </div>
        <div
          class="progress-track song-track"
          role="progressbar"
          :aria-valuenow="
            manager.mode === 'check' ? manager.songChecked : manager.songDone
          "
          :aria-valuemax="manager.songTotal"
          aria-label="歌曲处理进度"
        >
          <span :style="{ width: songPercent + '%' }"></span>
        </div>
        <div
          v-if="
            manager.mode === 'update' &&
            ['下载音乐', '下载封面', '当前文件完成后暂停'].includes(
              manager.stage
            )
          "
          class="download-progress"
        >
          <div class="progress-labels">
            <span
              >{{ manager.stage }}
              <b
                >{{ formatBytes(manager.downloadedBytes)
                }}<template v-if="manager.downloadTotalBytes">
                  / {{ formatBytes(manager.downloadTotalBytes) }}</template
                ><template v-else> · 总大小未知</template></b
              ></span
            >
            <span
              >{{ manager.downloadTotalBytes ? downloadPercent + '% · ' : ''
              }}{{ formatSpeed(manager.downloadSpeed) }}</span
            >
          </div>
          <div
            v-if="manager.downloadTotalBytes"
            class="progress-track file-track"
            role="progressbar"
            :aria-valuenow="manager.downloadedBytes"
            :aria-valuemax="manager.downloadTotalBytes"
            aria-label="当前文件下载进度"
          >
            <span :style="{ width: downloadPercent + '%' }"></span>
          </div>
          <div
            v-else
            class="progress-track file-track indeterminate-track"
            aria-label="正在接收文件，文件大小未知"
          >
            <span></span>
          </div>
        </div>
      </div>
      <div class="task-actions">
        <button v-if="busy && !manager.paused" @click="manager.pause()"
          >暂停</button
        >
        <button
          v-if="busy && manager.paused"
          class="primary-action"
          @click="manager.resume()"
          >继续</button
        >
        <button
          v-if="busy"
          class="cancel-action"
          :disabled="manager.stopped"
          @click="manager.stop()"
          >取消任务</button
        >
      </div>
      <p v-if="busy" class="task-footnote">{{
        manager.mode === 'check'
          ? '检查只读取收藏与缓存状态，不下载歌曲。'
          : '已完成的缓存会保留，取消后可从待更新项继续。'
      }}</p>
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
      <div class="group-title"
        ><h5>{{ groupTitle }}</h5
        ><small>本地收藏 {{ visible.length }} 项</small></div
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
        :class="{
          'cache-entry-active': busy && manager.currentTargetKey === item.key,
        }"
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
      @click="displayLimit += 100"
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
      displayLimit: 100,
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
    overallProgressValue() {
      return Math.min(
        this.manager.total,
        this.manager.progress + this.manager.currentTargetFraction
      );
    },
    overallPercent() {
      return this.manager.total
        ? Math.round((this.overallProgressValue / this.manager.total) * 100)
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
    songPercent() {
      if (!this.manager.songTotal) return 0;
      const completed =
        this.manager.mode === 'check'
          ? this.manager.songChecked
          : this.manager.songDone;
      const activeFraction =
        this.manager.mode === 'update' &&
        this.manager.downloadTotalBytes &&
        this.manager.activeDownloadKind === 'audio'
          ? Math.min(
              0.99,
              this.manager.downloadedBytes / this.manager.downloadTotalBytes
            )
          : 0;
      return Math.min(
        100,
        Math.round(
          ((completed + activeFraction) / this.manager.songTotal) * 100
        )
      );
    },
    downloadPercent() {
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
    taskStateLabel() {
      if (this.manager.paused) return '已暂停';
      if (this.manager.stopped && this.busy) return '正在取消';
      if (this.busy)
        return this.manager.mode === 'check' ? '正在检查' : '正在缓存';
      if (this.manager.stage === '已取消') return '任务已取消';
      if (this.manager.stage === '任务完成') return '任务完成';
      if (this.manager.stage === '部分完成') return '部分完成';
      return '任务结束';
    },
    taskStateClass() {
      return {
        'state-active':
          this.busy && !this.manager.paused && !this.manager.stopped,
        'state-paused': this.manager.paused,
        'state-complete': !this.busy && this.manager.stage === '任务完成',
        'state-warning': !this.busy && this.manager.stage === '部分完成',
        'state-cancelled':
          (this.manager.stopped && this.busy) ||
          (!this.busy && this.manager.stage === '已取消'),
      };
    },
    account() {
      return String(this.$store.state.data.user?.userId || '');
    },
  },
  watch: {
    group() {
      this.displayLimit = 100;
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
    formatBytes(value) {
      const bytes = Number(value) || 0;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },
    formatSpeed(value) {
      return value > 0 ? `${this.formatBytes(value)}/s` : '测速中';
    },
  },
};
</script>
<style lang="scss" scoped>
.library-cache-settings {
  padding: 22px 24px 12px;
  color: var(--color-text);
  background: var(--color-body-bg);
  border-color: rgba(128, 128, 128, 0.14);
}
h4,
h5,
p {
  margin: 0;
}
h4 {
  font-size: 15px;
  font-weight: 600;
}
h5 {
  font-size: 15px;
  font-weight: 600;
}
.group-title small {
  font-size: 12px;
  opacity: 0.6;
}
.cache-note,
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
  border: 1px solid rgba(128, 128, 128, 0.16);
  border-radius: 8px;
  padding: 9px 11px;
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
  gap: 12px;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(128, 128, 128, 0.16);
  border-radius: 12px;
  background: var(--color-secondary-bg);
}
.task-topline,
.task-actions,
.progress-labels {
  display: flex;
  align-items: center;
  gap: 9px;
}
.task-topline {
  font-size: 13px;
}
.task-phase {
  margin-left: auto;
  font-size: 12px;
  opacity: 0.68;
}
.task-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #e59a31;
}
.task-indicator.state-active {
  background: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-bg);
  animation: cache-pulse 1.5s ease-in-out infinite;
}
.task-indicator.state-complete {
  background: #32a36a;
}
.task-indicator.state-cancelled,
.task-indicator.state-paused,
.task-indicator.state-warning {
  background: #e59a31;
}
.task-progress-group {
  display: grid;
  gap: 6px;
}
.phase-progress-group {
  display: grid;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid rgba(128, 128, 128, 0.14);
}
.task-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  span {
    padding: 4px 8px;
    border-radius: 7px;
    background: rgba(128, 128, 128, 0.09);
    font-size: 11px;
    line-height: 1.4;
    opacity: 0.8;
  }
  b {
    margin-left: 3px;
    color: var(--color-text);
    font-weight: 600;
  }
  small {
    margin-left: 5px;
    opacity: 0.7;
  }
}
.request-pending {
  color: var(--color-primary);
  font-size: 11px;
}
.song-progress-group {
  padding-top: 10px;
  border-top: 1px solid rgba(128, 128, 128, 0.14);
}
.progress-labels {
  justify-content: space-between;
  gap: 12px;
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.78;
  b {
    font-weight: 600;
    color: var(--color-text);
  }
  span:last-child {
    flex-shrink: 0;
  }
}
.progress-track {
  width: 100%;
  height: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(128, 128, 128, 0.2);
  span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--color-primary);
    transition: width 180ms ease-out;
  }
}
.song-track {
  height: 5px;
  span {
    background: rgba(128, 128, 128, 0.8);
  }
}
.file-track {
  height: 4px;
}
.phase-track {
  position: relative;
  height: 5px;
  background: rgba(128, 128, 128, 0.15);
  span {
    background: rgba(128, 128, 128, 0.68);
  }
}
.phase-track.is-waiting::after {
  position: absolute;
  top: 0;
  left: -30%;
  width: 30%;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
  opacity: 0.45;
  content: '';
  animation: cache-wait 1.15s ease-in-out infinite;
}
.indeterminate-track span {
  width: 35%;
  animation: cache-progress 1.15s ease-in-out infinite alternate;
  background: var(--color-primary);
}
.download-progress {
  display: grid;
  gap: 6px;
  margin-top: 4px;
  padding: 9px 10px;
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.08);
}
.task-actions {
  justify-content: flex-end;
}
.cancel-action {
  color: var(--color-text);
  opacity: 0.72;
}
.task-footnote {
  margin: -6px 0 0;
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.58;
}
.task-result {
  font-weight: 550;
}
.task-details {
  display: grid;
  gap: 3px;
  font-size: 12px;
  overflow-wrap: anywhere;
}
.task-current {
  opacity: 0.68;
}
.cache-groups {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin: 16px 0 12px;
  padding: 4px;
  border-radius: 10px;
  background: var(--color-secondary-bg);
  button {
    border-color: transparent;
    background: transparent;
  }
  small {
    opacity: 0.75;
  }
}
.cache-entries {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.cache-entry {
  gap: 14px;
  padding: 11px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.14);
  transition: background-color 160ms ease;
}
.cache-entry-active {
  background: var(--color-primary-bg);
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
.show-more {
  width: 100%;
  background: transparent;
  border-color: rgba(128, 128, 128, 0.16);
}
@keyframes cache-pulse {
  50% {
    box-shadow: 0 0 0 5px transparent;
  }
}
@keyframes cache-progress {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(185%);
  }
}
@keyframes cache-wait {
  to {
    left: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .task-indicator.state-active,
  .phase-track.is-waiting::after,
  .indeterminate-track span {
    animation: none;
  }
}
@media (max-width: 600px) {
  .library-cache-settings {
    padding: 18px 16px 8px;
  }
  .cache-header {
    display: grid;
  }
  .cache-header .cache-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .cache-header button {
    padding-inline: 7px;
  }
  .group-header {
    align-items: flex-start;
  }
  .group-header .cache-actions {
    width: 100%;
  }
  .group-header .cache-actions button {
    flex: 1;
  }
  .cache-groups button {
    padding: 9px 2px;
  }
  .cache-task {
    padding: 12px;
  }
  .task-phase {
    text-align: right;
  }
}
@media (max-width: 360px) {
  .cache-groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .progress-labels {
    align-items: flex-start;
    font-size: 11px;
  }
}
</style>
