<template>
  <section class="library-search-results" aria-label="音乐库搜索结果">
    <div class="search-summary"
      ><h2
        >搜索结果 <span>“{{ query }}”</span></h2
      ><p v-if="loading">正在检索本地音乐库…</p
      ><p v-else
        >已保存 {{ results.coverage.saved }}/{{
          results.coverage.total
        }}
        个创建歌单的内容 · {{ results.coverage.songs }} 首歌曲可检索</p
      ></div
    >
    <p v-if="error" role="status">{{ error }}</p>
    <nav class="result-filters" aria-label="结果分类"
      ><button
        v-for="category in categories"
        :key="category.key"
        :class="{ active: filter === category.key }"
        @click="filter = category.key"
        >{{ category.name }} <span>{{ count(category.key) }}</span></button
      ></nav
    >
    <div
      v-if="visible('playlists') && results.playlists.length"
      class="result-group"
      ><h3
        >歌单 <span>{{ results.playlists.length }}</span></h3
      ><CoverRow
        :items="results.playlists"
        type="playlist"
        sub-text="creator"
        :show-play-button="true"
    /></div>
    <div v-if="visible('songs') && results.songs.length" class="result-group">
      <h3
        >歌曲 <span>{{ results.songs.length }}</span></h3
      >
      <article
        v-for="entry in results.songs.slice(0, songLimit)"
        :key="entry.song.id"
        class="song-result"
      >
        <button
          class="song-main"
          :aria-label="'播放 ' + entry.song.name"
          @click="play(entry)"
          ><img
            v-if="cover(entry.song)"
            v-image-fade
            :src="cover(entry.song) | resizeImage(224)"
            loading="lazy"
            alt="" /><span class="song-cover-placeholder" v-else>♪</span
          ><span class="song-info"
            ><strong
              >{{ entry.song.name
              }}<span
                v-if="entry.song.localOnly || entry.song.archiveStatus"
                class="local-status"
                >{{ entry.song.localOnly ? '仅本地' : '已移除' }}</span
              ></strong
            ><small
              >{{ artists(entry.song)
              }}<template v-if="album(entry.song)">
                · {{ album(entry.song) }}</template
              ></small
            ></span
          ><svg-icon icon-class="play"
        /></button>
        <div class="song-sources"
          ><span class="source-label">归属</span
          ><template v-for="source in entry.sources"
            ><router-link
              v-if="source.path"
              :key="source.key"
              :to="source.path"
              >{{ source.name }}</router-link
            ><span v-else :key="source.key" class="source-chip">{{
              source.name
            }}</span></template
          ></div
        >
      </article>
      <button
        v-if="results.songs.length > songLimit"
        class="more-results"
        @click="songLimit += 50"
        >显示更多歌曲</button
      >
    </div>
    <div v-if="visible('albums') && results.albums.length" class="result-group"
      ><h3
        >专辑 <span>{{ results.albums.length }}</span></h3
      ><CoverRow
        :items="results.albums"
        :compact="results.albums.length > 20"
        type="album"
        sub-text="artist"
        :show-play-button="true"
    /></div>
    <div
      v-if="visible('artists') && results.artists.length"
      class="result-group"
      ><h3
        >歌手 <span>{{ results.artists.length }}</span></h3
      ><CoverRow :items="results.artists" type="artist"
    /></div>
    <div v-if="visible('mvs') && results.mvs.length" class="result-group"
      ><h3
        >视频 <span>{{ results.mvs.length }}</span></h3
      ><MvRow :mvs="results.mvs"
    /></div>
    <p v-if="!loading && !count(filter)" class="empty-results"
      >本地音乐库中没有匹配的内容</p
    >
  </section>
</template>
<script>
import CoverRow from '@/components/CoverRow.vue';
import MvRow from '@/components/MvRow.vue';
import SvgIcon from '@/components/SvgIcon.vue';
import { readSavedPlaylists } from '@/utils/offlineLibrary';
import { getSavedTrackDetails, getSavedAlbums } from '@/utils/db';
import {
  buildLibraryIndex,
  queryLibrary,
  libraryTrackIds,
} from '@/utils/librarySearch';
export default {
  name: 'LibrarySearch',
  components: { CoverRow, MvRow, SvgIcon },
  props: {
    liked: { type: Object, required: true },
    scope: { type: String, default: null },
    query: { type: String, required: true },
  },
  data() {
    return {
      saved: [],
      albums: [],
      tracks: [],
      loading: false,
      error: '',
      filter: 'all',
      generation: 0,
      songLimit: 50,
      categories: [
        { key: 'all', name: '全部' },
        { key: 'playlists', name: '歌单' },
        { key: 'songs', name: '歌曲' },
        { key: 'albums', name: '专辑' },
      ],
    };
  },
  computed: {
    index() {
      return buildLibraryIndex(
        this.liked,
        this.saved,
        this.tracks,
        this.$store.state.data.user?.userId,
        this.albums
      );
    },
    results() {
      return queryLibrary(this.index, this.query);
    },
  },
  watch: {
    scope: {
      immediate: true,
      handler() {
        this.load();
      },
    },
    query() {
      this.songLimit = 50;
    },
    liked() {
      this.load();
    },
    'liked.playlists'() {
      this.load();
    },
    'liked.albums'() {
      this.load();
    },
    'liked.songs'() {
      this.load();
    },
  },
  beforeDestroy() {
    this.generation++;
  },
  methods: {
    async load() {
      const epoch = ++this.generation;
      this.saved = [];
      this.tracks = [];
      this.albums = [];
      this.loading = true;
      this.error = '';
      try {
        const [saved, albums] = await Promise.all([
          readSavedPlaylists(this.scope),
          getSavedAlbums((this.liked.albums || []).map(item => item.id)),
        ]);
        const tracks = await getSavedTrackDetails(
          libraryTrackIds(
            this.liked,
            saved,
            this.$store.state.data.user?.userId
          )
        );
        if (epoch !== this.generation) return;
        this.saved = saved;
        this.albums = albums;
        this.tracks = tracks;
      } catch (_) {
        if (epoch === this.generation) this.error = '部分本地条目暂时无法读取';
      } finally {
        if (epoch === this.generation) this.loading = false;
      }
    },
    visible(key) {
      return this.filter === 'all' || this.filter === key;
    },
    count(key) {
      return key === 'all'
        ? ['playlists', 'songs', 'albums', 'artists', 'mvs'].reduce(
            (sum, type) => sum + this.results[type].length,
            0
          )
        : this.results[key].length;
    },
    artists(song) {
      return (
        (song.ar || song.artists || []).map(item => item.name).join(' / ') ||
        song.artist ||
        ''
      );
    },
    album(song) {
      return (
        song.al?.name ||
        song.album?.name ||
        (typeof song.album === 'string' ? song.album : '')
      );
    },
    cover(song) {
      return song.al?.picUrl || song.album?.picUrl || song.cover;
    },
    play(entry) {
      if (
        (entry.song.localOnly || entry.song.archiveStatus === 'removed') &&
        !entry.song.localPlayable
      ) {
        this.$store.dispatch(
          'showToast',
          entry.song.reason || '本地音频未完整缓存'
        );
        return;
      }
      if (entry.sources.some(source => source.key === 'cloud'))
        this.$store.state.player.replacePlaylist(
          [entry.song.id],
          -8,
          'cloudDisk',
          entry.song.id
        );
      else this.$store.state.player.addTrackToPlayNext(entry.song.id, true);
    },
  },
};
</script>
<style lang="scss" scoped>
.library-search-results {
  padding: 28px 0 48px;
  color: var(--color-text);
}
.search-summary {
  margin-bottom: 22px;
  h2 {
    font-size: 24px;
    overflow-wrap: anywhere;
    span {
      font-weight: 400;
      opacity: 0.65;
    }
  }
  p {
    font-size: 13px;
    opacity: 0.55;
    margin-top: 10px;
  }
}
.result-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 32px;
  button {
    background: var(--color-secondary-bg);
    color: var(--color-text);
    padding: 9px 13px;
    font: inherit;
    font-size: 14px;
    border-radius: 8px;
    span {
      opacity: 0.45;
      margin-left: 4px;
    }
    &.active {
      background: var(--color-primary-bg);
      color: var(--color-primary);
    }
  }
}
.result-group {
  margin-bottom: 36px;
  h3 {
    font-size: 20px;
    margin-bottom: 18px;
    span {
      font-size: 13px;
      opacity: 0.45;
      font-weight: 400;
      margin-left: 6px;
    }
  }
}
.song-result {
  padding: 14px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.song-main {
  display: flex;
  gap: 14px;
  align-items: center;
  width: 100%;
  color: var(--color-text);
  background: none;
  text-align: left;
  padding: 0;
  img,
  .song-cover-placeholder {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 52px;
    height: 52px;
    border-radius: 8px;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--color-secondary-bg);
  }
  .svg-icon {
    width: 16px;
    height: 16px;
    margin-left: auto;
    opacity: 0.55;
    flex-shrink: 0;
  }
}
.song-info {
  min-width: 0;
  strong {
    display: block;
    font-size: 16px;
    overflow-wrap: anywhere;
  }
  small {
    display: block;
    font-size: 13px;
    opacity: 0.55;
    margin-top: 7px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
}
.song-sources {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin: 10px 24px 0 66px;
  font-size: 12px;
  .source-label {
    opacity: 0.45;
    margin-right: 3px;
  }
  a,
  .source-chip {
    background: var(--color-secondary-bg);
    color: var(--color-text);
    border-radius: 5px;
    padding: 4px 7px;
    overflow-wrap: anywhere;
  }
  a:hover {
    color: var(--color-primary);
  }
}
.more-results {
  margin: 24px auto;
  display: block;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  padding: 10px 16px;
  border-radius: 8px;
}
.empty-results {
  text-align: center;
  opacity: 0.5;
  padding: 48px 0;
}
@media (max-width: 600px) {
  .song-sources {
    margin-left: 0;
  }
  .search-summary h2 {
    font-size: 21px;
  }
}
</style>

<style lang="scss" scoped>
.local-status {
  font-size: 11px;
  margin-left: 7px;
  opacity: 0.55;
}
</style>
