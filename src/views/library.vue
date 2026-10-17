<template>
  <div v-page-reveal="show" v-show="show" ref="library" class="library-page">
    <header class="library-header"
      ><h1>
        <img
          v-image-fade
          class="avatar"
          :src="data.user.avatarUrl | resizeImage"
          loading="lazy"
        />{{ data.user.nickname }}{{ $t('library.sLibrary') }}
      </h1>
      <div class="library-search" :class="{ expanded: searchOpen }">
        <button
          aria-label="搜索音乐库"
          :aria-expanded="searchOpen"
          @click="toggleSearch"
          ><svg-icon icon-class="search"
        /></button>
        <div class="search-input"
          ><input
            ref="librarySearch"
            v-model="searchInput"
            aria-label="搜索音乐库"
            placeholder="搜索音乐库"
            @keydown.esc="closeSearch"
        /></div>
        <button
          v-if="searchOpen"
          class="search-close"
          aria-label="关闭搜索"
          @click="closeSearch"
          >×</button
        >
      </div>
    </header>
    <div v-if="offline" class="offline-note">
      {{
        $store.state.settings.archiveMode
          ? '纪念模式：正在显示本地保存的音乐库。'
          : hasLocalData
          ? '当前离线，正在显示本地保存的音乐库。'
          : '暂无本地音乐库数据，请联网打开一次。'
      }}
      <button
        v-if="!$store.state.settings.archiveMode"
        :disabled="refreshing"
        @click="loadData"
        >重试</button
      >
    </div>
    <LibrarySearch
      v-if="searchQuery"
      :key="accountScope"
      :liked="liked"
      :scope="accountScope"
      :query="searchQuery"
    />
    <div v-show="!searchQuery">
      <div class="section-one">
        <div class="liked-songs" @click="goToLikedSongsList">
          <div class="top">
            <p>
              <span
                v-for="(line, index) in pickedLyric"
                v-show="line !== ''"
                :key="`${line}${index}`"
                >{{ line }}<br
              /></span>
            </p>
          </div>
          <div class="bottom">
            <div class="titles">
              <div class="title">{{ $t('library.likedSongs') }}</div>
              <div class="sub-title">
                {{ liked.songs.length }} {{ $t('common.songs') }}
              </div>
            </div>
            <button @click.stop="openPlayModeTabMenu">
              <svg-icon icon-class="play" />
            </button>
          </div>
        </div>
        <div class="songs">
          <TrackList
            :id="liked.playlists.length > 0 ? liked.playlists[0].id : 0"
            :tracks="liked.songsWithDetails"
            :column-number="3"
            type="tracklist"
            dbclick-track-func="playPlaylistByID"
          />
        </div>
      </div>

      <div class="section-two">
        <div class="tabs-row">
          <div class="tabs">
            <div
              class="tab"
              :class="{ active: currentTab === 'created' }"
              @click="updateCurrentTab('created')"
              >创建</div
            >
            <div
              class="tab"
              :class="{ active: currentTab === 'saved' }"
              @click="updateCurrentTab('saved')"
              >收藏</div
            >
            <div
              class="tab"
              :class="{ active: currentTab === 'albums' }"
              @click="updateCurrentTab('albums')"
            >
              {{ $t('library.albums') }}
            </div>
            <div
              class="tab"
              :class="{ active: currentTab === 'artists' }"
              @click="updateCurrentTab('artists')"
            >
              歌手
            </div>
            <div
              class="tab"
              :class="{ active: currentTab === 'mvs' }"
              @click="updateCurrentTab('mvs')"
            >
              视频
            </div>
            <div
              class="tab"
              :class="{ active: currentTab === 'cloudDisk' }"
              @click="updateCurrentTab('cloudDisk')"
            >
              {{ $t('library.cloudDisk') }}
            </div>
            <div
              class="tab"
              :class="{ active: currentTab === 'playHistory' }"
              @click="updateCurrentTab('playHistory')"
            >
              排行
            </div>
          </div>
          <button
            v-show="currentTab === 'created'"
            class="tab-button"
            @click="openAddPlaylistModal"
            ><svg-icon icon-class="plus" />{{ $t('library.newPlayList') }}
          </button>
          <button
            v-show="currentTab === 'cloudDisk'"
            class="tab-button"
            @click="selectUploadFiles"
            ><svg-icon icon-class="arrow-up-alt" />{{
              $t('library.uploadSongs')
            }}
          </button>
        </div>

        <div v-show="currentTab === 'created' || currentTab === 'saved'">
          <div v-if="liked.playlists.length > 1">
            <CoverRow
              :items="filterPlaylists"
              :compact="filterPlaylists.length > 20"
              type="playlist"
              sub-text="creator"
              :show-play-button="true"
            />
          </div>
        </div>

        <div v-show="currentTab === 'albums'">
          <CoverRow
            :items="liked.albums"
            type="album"
            sub-text="artist"
            :show-play-button="true"
          />
        </div>

        <div v-show="currentTab === 'artists'">
          <CoverRow
            :items="liked.artists"
            type="artist"
            :show-play-button="true"
          />
        </div>

        <div v-show="currentTab === 'mvs'">
          <MvRow :mvs="liked.mvs" />
        </div>

        <div v-show="currentTab === 'cloudDisk'">
          <TrackList
            :id="-8"
            :tracks="liked.cloudDisk"
            :column-number="3"
            type="cloudDisk"
            dbclick-track-func="playCloudDisk"
            :extra-context-menu-item="['removeTrackFromCloudDisk']"
          />
        </div>

        <div v-show="currentTab === 'playHistory'">
          <button
            :class="{
              'playHistory-button': true,
              'playHistory-button--selected': playHistoryMode === 'week',
            }"
            @click="playHistoryMode = 'week'"
          >
            {{ $t('library.playHistory.week') }}
          </button>
          <button
            :class="{
              'playHistory-button': true,
              'playHistory-button--selected': playHistoryMode === 'all',
            }"
            @click="playHistoryMode = 'all'"
          >
            {{ $t('library.playHistory.all') }}
          </button>
          <TrackList
            :tracks="playHistoryList"
            :column-number="1"
            type="tracklist"
          />
        </div>
      </div>
    </div>
    <input
      ref="cloudDiskUploadInput"
      type="file"
      style="display: none"
      @change="uploadSongToCloudDisk"
    />

    <ContextMenu ref="playModeTabMenu">
      <div class="item" @click="playLikedSongs">{{
        $t('library.likedSongs')
      }}</div>
      <hr />
      <div class="item" @click="playIntelligenceList">{{
        $t('contextMenu.cardiacMode')
      }}</div>
    </ContextMenu>
  </div>
</template>

<script>
import { archiveMode } from '@/utils/archiveMode';
import { libraryScope } from '@/utils/offlineLibrary';
import LibrarySearch from '@/components/LibrarySearch.vue';
import { mapActions, mapMutations, mapState } from 'vuex';
import { randomNum, dailyTask } from '@/utils/common';
import { isAccountLoggedIn } from '@/utils/auth';
import { uploadSong } from '@/api/user';
import { getLyric } from '@/api/track';
import NProgress from 'nprogress';
import locale from '@/locale';

import ContextMenu from '@/components/ContextMenu.vue';
import TrackList from '@/components/TrackList.vue';
import CoverRow from '@/components/CoverRow.vue';
import SvgIcon from '@/components/SvgIcon.vue';
import MvRow from '@/components/MvRow.vue';

/**
 * Pick the lyric part from a string formed in `[timecode] lyric`.
 *
 * @param {string} rawLyric The raw lyric string formed in `[timecode] lyric`
 * @returns {string} The lyric part
 */
function extractLyricPart(rawLyric) {
  return rawLyric.split(']').pop().trim();
}

export default {
  name: 'Library',
  components: {
    LibrarySearch,
    SvgIcon,
    CoverRow,
    TrackList,
    MvRow,
    ContextMenu,
  },
  data() {
    return {
      searchOpen: false,
      searchInput: '',
      searchQuery: '',
      searchTimer: null,
      show: false,
      offline: navigator.onLine === false,
      refreshing: false,
      likedSongs: [],
      lyric: undefined,
      currentTab:
        this.$store.state.data.libraryPlaylistFilter === 'liked'
          ? 'saved'
          : 'created',
      playHistoryMode: 'week',
    };
  },
  computed: {
    ...mapState(['data', 'liked']),
    accountScope() {
      return libraryScope(this.data);
    },
    hasLocalData() {
      return [
        'playlists',
        'songsWithDetails',
        'albums',
        'artists',
        'mvs',
        'cloudDisk',
      ].some(name => this.liked[name].length > 0);
    },
    /**
     * @returns {string[]}
     */
    pickedLyric() {
      /** @type {string?} */
      const lyric = this.lyric;

      // Returns [] if we got no lyrics.
      if (!lyric) return [];

      const lyricLine = lyric
        .split('\n')
        .filter(line => !line.includes('作词') && !line.includes('作曲'));

      // Pick 3 or fewer lyrics based on the lyric lines.
      const lyricsToPick = Math.min(lyricLine.length, 3);

      // The upperBound of the lyric line to pick
      const randomUpperBound = lyricLine.length - lyricsToPick;
      const startLyricLineIndex = randomNum(0, randomUpperBound - 1);

      // Pick lyric lines to render.
      return lyricLine
        .slice(startLyricLineIndex, startLyricLineIndex + lyricsToPick)
        .map(extractLyricPart);
    },
    filterPlaylists() {
      const playlists = this.liked.playlists.slice(1);
      const userId = String(this.data.user.userId);
      return playlists.filter(p =>
        this.currentTab === 'created'
          ? String(p.creator?.userId) === userId
          : String(p.creator?.userId) !== userId
      );
    },
    playHistoryList() {
      if (this.show && this.playHistoryMode === 'week') {
        return this.liked.playHistory.weekData;
      }
      if (this.show && this.playHistoryMode === 'all') {
        return this.liked.playHistory.allData;
      }
      return [];
    },
  },
  watch: {
    searchInput(value) {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchQuery = value.trim();
      }, 160);
    },
    accountScope() {
      this.closeSearch();
    },
  },
  beforeDestroy() {
    clearTimeout(this.searchTimer);
  },
  created() {
    setTimeout(() => {
      if (!this.show) NProgress.start();
    }, 1000);
    this.loadData();
  },
  activated() {
    this.$parent.$refs.scrollbar.restorePosition();
    this.loadData();
    dailyTask();
  },
  methods: {
    toggleSearch() {
      this.searchOpen = !this.searchOpen;
      if (this.searchOpen)
        this.$nextTick(() => this.$refs.librarySearch.focus());
      else this.closeSearch();
    },
    closeSearch() {
      clearTimeout(this.searchTimer);
      this.searchInput = '';
      this.searchQuery = '';
      this.searchOpen = false;
    },
    ...mapActions(['showToast']),
    ...mapMutations(['updateModal', 'updateData']),
    async loadData() {
      if (this.refreshing) return;
      this.refreshing = true;
      try {
        await this.$store.dispatch('restoreLibrary');
        this.show = true;
        NProgress.done();
        if (archiveMode() || navigator.onLine === false) {
          this.offline = true;
          return;
        }
        const actions = [
          'fetchLikedSongs',
          'fetchLikedAlbums',
          'fetchLikedArtists',
          'fetchLikedMVs',
          'fetchCloudDisk',
          'fetchPlayHistory',
        ];
        const results = await Promise.allSettled([
          this.$store
            .dispatch('fetchLikedPlaylist')
            .then(() => this.$store.dispatch('fetchLikedSongsWithDetails')),
          ...actions.map(action => this.$store.dispatch(action)),
        ]);
        this.offline = results.some(result => result.status === 'rejected');
        if (!this.offline) this.getRandomLyric();
      } finally {
        this.refreshing = false;
        this.show = true;
        NProgress.done();
      }
    },
    playLikedSongs() {
      if (!this.liked.playlists[0])
        return this.showToast('暂无本地歌单信息，请联网加载一次');
      this.$store.state.player.playPlaylistByID(
        this.liked.playlists[0].id,
        'first',
        true
      );
    },
    playIntelligenceList() {
      if (!this.liked.playlists[0])
        return this.showToast('暂无本地歌单信息，请联网加载一次');
      this.$store.state.player.playIntelligenceListById(
        this.liked.playlists[0].id,
        'first',
        true
      );
    },
    updateCurrentTab(tab) {
      if (!isAccountLoggedIn() && !['created', 'saved'].includes(tab)) {
        this.showToast(locale.t('toast.needToLogin'));
        return;
      }
      this.currentTab = tab;
      if (['created', 'saved'].includes(tab)) {
        this.updateData({
          key: 'libraryPlaylistFilter',
          value: tab === 'created' ? 'mine' : 'liked',
        });
      }
      this.$parent.$refs.main.scrollTo({ top: 375, behavior: 'smooth' });
    },
    goToLikedSongsList() {
      this.$router.push({ path: '/library/liked-songs' });
    },
    getRandomLyric() {
      if (this.liked.songs.length === 0) return;
      getLyric(this.liked.songs[randomNum(0, this.liked.songs.length - 1)])
        .then(data => {
          if (data.lrc !== undefined) {
            const isInstrumental = data.lrc.lyric
              .split('\n')
              .filter(l => l.includes('纯音乐，请欣赏'));
            if (isInstrumental.length === 0) {
              this.lyric = data.lrc.lyric;
            }
          }
        })
        .catch(() => {});
    },
    openAddPlaylistModal() {
      if (!isAccountLoggedIn()) {
        this.showToast(locale.t('toast.needToLogin'));
        return;
      }
      this.updateModal({
        modalName: 'newPlaylistModal',
        key: 'show',
        value: true,
      });
    },
    openPlayModeTabMenu(e) {
      this.$refs.playModeTabMenu.openMenu(e);
    },
    selectUploadFiles() {
      this.$refs.cloudDiskUploadInput.click();
    },
    uploadSongToCloudDisk(e) {
      const files = e.target.files;
      uploadSong(files[0]).then(result => {
        if (result.code === 200) {
          let newCloudDisk = this.liked.cloudDisk;
          newCloudDisk.unshift(result.privateCloud);
          this.$store.commit('updateLikedXXX', {
            name: 'cloudDisk',
            data: newCloudDisk,
          });
        }
      });
    },
  },
};
</script>

<style lang="scss" scoped>
@import '~@/assets/css/library.scss';
</style>

<style lang="scss" scoped>
.library-page {
  position: relative;
}
.library-header {
  position: relative;
  min-height: 48px;
  h1 {
    padding-right: 48px;
  }
}
.library-search {
  position: absolute;
  right: 0;
  top: 8px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  color: var(--color-text);
  background: var(--color-secondary-bg-for-transparent);
  -webkit-app-region: no-drag;
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    padding: 0;
    color: inherit;
    background: none;
    .svg-icon {
      width: 16px;
      height: 16px;
    }
  }
  .search-input {
    width: 0;
    overflow: hidden;
    transition: width 0.14s ease;
  }
  input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 15px;
    outline: none;
  }
  &.expanded {
    background: var(--color-secondary-bg);
    .search-input {
      width: 210px;
    }
  }
  .search-close {
    font-size: 22px;
  }
}
@media (max-width: 600px) {
  .library-header h1 {
    font-size: 26px;
  }
  .library-search.expanded .search-input {
    width: min(190px, calc(100vw - 150px));
  }
}
@media (prefers-reduced-motion: reduce) {
  .library-search .search-input {
    transition: none;
  }
}
</style>
