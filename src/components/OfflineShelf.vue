<template>
  <section class="shelf" aria-label="离线音乐库">
    <header class="shelf-heading">
      <div
        ><h2>离线音乐库</h2
        ><p
          >{{ rows.length }} 个收藏 <span>·</span>
          {{ songCount }} 首可离线播放</p
        ></div
      >
      <div class="filter" aria-label="显示范围"
        ><button
          v-for="(label, i) in ['全部收藏', '仅看可离线']"
          :key="label"
          :aria-pressed="onlyReady === !!i"
          @click="
            onlyReady = !!i;
            limit = 12;
          "
          >{{ label }}</button
        ></div
      >
    </header>
    <div>
      <p v-if="error" role="status"
        >{{ error }} <button @click="load">重试</button></p
      >
      <p v-else-if="!visible.length" class="empty">{{
        loading
          ? '正在读取本地收藏…'
          : onlyReady
          ? '还没有完整缓存的歌曲。'
          : '暂无已保存的收藏。'
      }}</p>
      <article
        v-for="row in visible.slice(0, limit)"
        :key="row.key"
        class="shelf-row"
      >
        <router-link :to="'/' + row.type + '/' + row.id" class="collection">
          <img
            v-if="row.cover"
            :src="row.cover | resizeImage(224)"
            alt=""
            loading="lazy"
          /><i v-else aria-hidden="true">♫</i>
          <div
            ><small>{{ groupNames[row.group] }}</small
            ><strong>{{ row.name }}</strong
            ><span>{{
              row.known
                ? row.ready.length + ' / ' + row.total + ' 首可离线'
                : '尚无本地歌曲清单'
            }}</span></div
          >
        </router-link>
        <button
          v-if="row.ready.length"
          class="play"
          :aria-label="'播放' + row.name + '的离线歌曲'"
          @click="play(row)"
          ><svg-icon icon-class="play"
        /></button>
      </article>
      <button v-if="visible.length > limit" class="more" @click="limit += 24"
        >显示更多</button
      >
    </div>
  </section>
</template>
<script>
import { readShelf } from '@/utils/offlineShelf';
import { libraryScope } from '@/utils/offlineLibrary';
import { playableLibraryIds } from '@/utils/db';
export default {
  name: 'OfflineShelf',
  data() {
    return {
      rows: [],
      onlyReady: false,
      limit: 12,
      error: '',
      generation: 0,
      loading: true,
      groupNames: {
        likes: '我喜欢',
        created: '创建的歌单',
        saved: '收藏的歌单',
        albums: '专辑',
      },
    };
  },
  computed: {
    scope() {
      return libraryScope(this.$store.state.data);
    },
    playlists() {
      return this.$store.state.liked.playlists;
    },
    albums() {
      return this.$store.state.liked.albums;
    },
    visible() {
      return this.onlyReady ? this.rows.filter(r => r.ready.length) : this.rows;
    },
    songCount() {
      const ids = new Set();
      this.rows.forEach(row => row.ready.forEach(id => ids.add(id)));
      return ids.size;
    },
  },
  watch: {
    scope() {
      this.rows = [];
      this.load();
    },
    playlists: 'load',
    albums: 'load',
  },
  mounted() {
    this.load();
  },
  activated() {
    this.load();
  },
  beforeDestroy() {
    this.generation++;
  },
  methods: {
    async load() {
      const generation = ++this.generation;
      this.loading = true;
      this.error = '';
      try {
        const state = this.$store.state;
        const rows = await readShelf(state, this.scope);
        if (generation !== this.generation) return;
        this.rows = rows;
      } catch (_) {
        if (generation === this.generation) this.error = '无法读取本地音乐库。';
      } finally {
        if (generation === this.generation) this.loading = false;
      }
    },
    async play(row) {
      const scope = this.scope;
      try {
        const complete = await playableLibraryIds();
        if (scope !== this.scope) return;
        const ids = row.ready.filter(id => complete.has(String(id)));
        if (ids.length)
          this.$store.state.player.replacePlaylist(ids, row.id, row.type);
        else this.load();
      } catch (_) {
        this.error = '无法读取本地音频。';
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.shelf {
  color: var(--color-text);
  margin: 24px 0 36px;
}
.shelf-heading,
.shelf-row,
.collection,
.filter {
  display: flex;
  align-items: center;
}
.shelf-heading,
.shelf-row {
  justify-content: space-between;
  gap: 12px;
}
.shelf-heading {
  flex-wrap: wrap;
  padding: 22px 24px;
  border-radius: 16px;
  background: var(--color-primary-bg);
  color: var(--color-primary);
}
h2,
p {
  margin: 0;
}
.shelf-heading h2 {
  font-size: 28px;
  letter-spacing: -0.6px;
}
.shelf-heading p {
  font-size: 13px;
  margin-top: 6px;
}
.shelf-heading p span {
  margin: 0 3px;
}
.filter {
  border-radius: 10px;
  background: var(--color-body-bg);
  padding: 3px;
  gap: 2px;
}
button {
  color: var(--color-text);
  font: inherit;
}
.filter button,
.more {
  font-size: 13px;
  border-radius: 7px;
  padding: 7px 10px;
}
.filter button[aria-pressed='true'],
.play {
  color: var(--color-primary);
  background: var(--color-primary-bg);
}
.shelf-heading + div {
  margin-top: 18px;
}
.shelf-row {
  padding: 12px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.16);
}
.collection {
  min-width: 0;
  gap: 12px;
  text-decoration: none;
}
.collection {
  flex: 1;
}
.collection img,
.collection i {
  width: 62px;
  height: 62px;
  border-radius: 9px;
  object-fit: cover;
}
.collection i {
  display: grid;
  place-items: center;
  font-style: normal;
  background: var(--color-secondary-bg);
  flex: none;
}
.collection div {
  min-width: 0;
}
.collection strong,
.collection span,
.collection small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collection small,
.collection span,
.empty {
  font-size: 12px;
  opacity: 0.65;
}
.collection strong {
  margin: 3px 0;
}
.play {
  display: grid;
  place-items: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: 50%;
}
.play .svg-icon {
  width: 13px;
  height: 13px;
}
.empty {
  padding: 15px 0;
}
.more {
  margin-top: 12px;
  background: var(--color-secondary-bg);
}
@media (max-width: 680px) {
  .shelf-heading {
    padding: 16px;
  }
  .shelf-heading h2 {
    font-size: 24px;
  }
}
</style>
