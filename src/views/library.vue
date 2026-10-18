<template>
  <div v-page-reveal="show" v-show="show" ref="library" class="library-page">
    <header class="library-header"
      ><h1>
        <LibraryAvatarMenu
          :avatar="data.user.avatarUrl"
          :label="data.user.nickname || '音乐库'"
        />{{ data.user.nickname }}
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
        @click="loadData(true)"
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
          <div class="top"
            ><img
              v-if="liked.playlists[0] && liked.playlists[0].coverImgUrl"
              v-image-fade
              :src="liked.playlists[0].coverImgUrl | resizeImage(224)"
              alt="喜欢的音乐封面"
          /></div>
          <div class="bottom">
            <div class="titles">
              <div class="title">我喜欢</div>
              <div class="sub-title">
                {{ liked.songs.length }} {{ $t('common.songs') }}
              </div>
            </div>
            <div class="liked-actions">
              <button
                class="intelligence-button"
                aria-label="心动模式"
                title="心动模式"
                @click.stop="playIntelligenceList"
                ><svg-icon icon-class="heart-solid"
              /></button>
              <button
                aria-label="播放我喜欢"
                title="播放我喜欢"
                @click.stop="playLikedSongs"
                ><svg-icon icon-class="play"
              /></button>
            </div>
          </div>
        </div>
        <div class="songs">
          <TrackList
            :id="liked.playlists.length > 0 ? liked.playlists[0].id : 0"
            :tracks="liked.songsWithDetails.slice(0, 12)"
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
              :class="{ active: currentTab === 'activity' }"
              @click="updateCurrentTab('activity')"
              >动态</div
            >
            <div
              class="tab"
              :class="{ active: currentTab === 'follows' }"
              @click="updateCurrentTab('follows')"
            >
              关注
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
            :compact="liked.albums.length > 20"
            type="album"
            sub-text="artist"
            :show-play-button="true"
          />
        </div>

        <div
          v-if="ownUid && currentTab === 'activity'"
          :key="profileScope"
          class="activity-columns"
        >
          <div class="profile-column">
            <TrackingSection
              :max-age="600000"
              ref="ownProfile"
              :uid="ownUid"
              :scope="profileScope"
              :cache-enabled="true"
              section="profile"
              title="资料"
              @notice="showToast($event)"
            />
            <button
              class="person-refresh"
              :disabled="activityRefreshing"
              @click="refreshActivity"
              >{{ activityRefreshing ? '刷新中…' : '刷新' }}</button
            >
          </div>
          <TrackingSection
            :max-age="600000"
            ref="ownEvents"
            :uid="ownUid"
            :scope="profileScope"
            :cache-enabled="true"
            section="events"
            title="动态"
            @notice="showToast($event)"
          />
        </div>
        <TrackingSection
          :max-age="600000"
          v-if="ownUid && currentTab === 'follows'"
          :key="profileScope + ':follows'"
          :uid="ownUid"
          :scope="profileScope"
          :cache-enabled="true"
          section="follows"
          :extra-artists="liked.artists"
          title="关注"
          @open-user="openUser"
          @notice="showToast($event)"
        />

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
      accept="audio/*,.mp3,.flac,.m4a,.wav,.ogg"
      style="display: none"
      @change="uploadSongToCloudDisk"
    />
  </div>
</template>

<script>
import { archiveMode } from '@/utils/archiveMode';
import { libraryScope } from '@/utils/offlineLibrary';
import LibrarySearch from '@/components/LibrarySearch.vue';
import { mapActions, mapMutations, mapState } from 'vuex';
import { dailyTask } from '@/utils/common';
import { isAccountLoggedIn } from '@/utils/auth';
import { uploadSong } from '@/api/user';
import NProgress from 'nprogress';
import locale from '@/locale';

import TrackingSection from '@/components/TrackingSection.vue';
import { trackingScope } from '@/utils/trackingStore';
import LibraryAvatarMenu from '@/components/LibraryAvatarMenu.vue';
import TrackList from '@/components/TrackList.vue';
import CoverRow from '@/components/CoverRow.vue';
import SvgIcon from '@/components/SvgIcon.vue';
import MvRow from '@/components/MvRow.vue';

export default {
  name: 'Library',
  components: {
    LibrarySearch,
    LibraryAvatarMenu,
    SvgIcon,
    CoverRow,
    TrackList,
    MvRow,
    TrackingSection,
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
      activityRefreshing: false,
      likedSongs: [],
      currentTab:
        this.$store.state.data.libraryPlaylistFilter === 'liked'
          ? 'saved'
          : 'created',
      playHistoryMode: 'week',
    };
  },
  computed: {
    ownUid() {
      return String(this.data.user?.userId || '');
    },
    profileScope() {
      return trackingScope(this.data.user?.userId);
    },
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
    async loadData(force = false) {
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
        const refreshKey = 'library-refresh:' + this.accountScope;
        const refreshedAt = Number(localStorage.getItem(refreshKey)) || 0;
        if (!force && this.hasLocalData && Date.now() - refreshedAt < 600000) {
          this.offline = false;
          return;
        }
        const scope = this.accountScope;
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
        if (!this.offline && scope === this.accountScope)
          localStorage.setItem(refreshKey, String(Date.now()));
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
      if (tab === 'follows' && !archiveMode() && navigator.onLine !== false)
        this.$store
          .dispatch('fetchLikedArtists')
          .catch(() => this.showToast('艺人列表刷新失败，保留缓存'));
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
    async refreshActivity() {
      if (this.activityRefreshing) return;
      this.activityRefreshing = true;
      try {
        await Promise.allSettled(
          [this.$refs.ownProfile, this.$refs.ownEvents]
            .filter(Boolean)
            .map(section => section.load(true))
        );
      } finally {
        this.activityRefreshing = false;
      }
    },
    openUser(user) {
      if (user._artistId) {
        this.$router.push({ path: `/artist/${user._artistId}` });
        return;
      }
      if (String(user.userId) === this.ownUid) return;
      this.$router.push({
        name: 'libraryPerson',
        params: { uid: String(user.userId) },
        query: { name: user.nickname || '', avatar: user.avatarUrl || '' },
      });
    },
    selectUploadFiles() {
      this.$refs.cloudDiskUploadInput.click();
    },
    async uploadSongToCloudDisk(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        this.showToast('正在上传歌曲…');
        const result = await uploadSong(file);
        if (result?.code !== 200) throw new Error(result?.msg || '上传未成功');
        await this.$store.dispatch('fetchCloudDisk');
        this.showToast('歌曲已上传');
      } catch (error) {
        this.showToast(error.message || '上传失败，请重试');
      } finally {
        e.target.value = '';
      }
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

<style lang="scss" scoped>
.liked-songs {
  min-height: 190px;
  .top {
    padding-bottom: 16px;
    img {
      width: 76px;
      height: 76px;
      object-fit: cover;
      border-radius: 10px;
    }
  }
}
</style>

<style lang="scss" scoped>
.liked-actions {
  display: flex;
  gap: 8px;
  margin-left: 12px;
  flex-shrink: 0;
}
.liked-songs .bottom .intelligence-button .svg-icon {
  width: 21px;
  height: 21px;
  margin-left: 0;
}
.activity-columns {
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(0, 1.65fr);
  gap: 28px;
  align-items: start;
}
.profile-column {
  min-width: 0;
}
.person-refresh {
  margin: 20px 0 0;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--color-secondary-bg);
  color: var(--color-text);
}
@media (max-width: 850px) {
  .activity-columns {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
</style>
