<template>
  <div v-page-reveal="show" v-show="show" ref="library" class="library-page">
    <header class="library-header"
      ><h1>
        <LibraryAvatarMenu
          :avatar="data.user.avatarUrl"
          :label="data.user.nickname || $t('library.localTitle')"
        />{{ data.user.nickname }}
      </h1>
      <label class="page-search">
        <svg-icon icon-class="search" />
        <input
          v-model="searchInput"
          type="search"
          :aria-label="$t('nav.search')"
          :placeholder="$t('nav.search')"
          @keydown.esc="closeSearch"
        />
      </label>
    </header>
    <div v-if="offline || refreshFailed" class="offline-note">
      {{
        $store.state.settings.archiveMode
          ? $t('library.offlineArchive')
          : !offline
          ? $t('common.loadFailed')
          : hasLocalData
          ? $t('library.offlineAvailable')
          : $t('library.offlineEmpty')
      }}
      <button
        v-if="!$store.state.settings.archiveMode"
        :disabled="refreshing"
        @click="loadData(true)"
        >{{ $t('library.retry') }}</button
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
              :alt="$t('library.likedCover')"
          /></div>
          <div class="bottom">
            <div class="titles">
              <div class="title">{{ $t('library.liked') }}</div>
              <div class="sub-title">
                {{ liked.songs.length }} {{ $t('common.songs') }}
              </div>
            </div>
            <div class="liked-actions">
              <button
                class="intelligence-button"
                :aria-label="$t('library.heartMode')"
                :title="$t('library.heartMode')"
                @click.stop="playIntelligenceList"
                ><svg-icon icon-class="heart-solid"
              /></button>
              <button
                :aria-label="$t('library.playLiked')"
                :title="$t('library.playLiked')"
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
          <div
            v-if="visibleTabs.length"
            class="tabs"
            role="tablist"
            :aria-label="$t('tracking.contentGroups')"
          >
            <button
              v-for="tab in visibleTabs"
              :key="tab.key"
              class="tab"
              role="tab"
              :aria-selected="currentTab === tab.key"
              :class="{ active: currentTab === tab.key }"
              @click="updateCurrentTab(tab.key)"
              >{{ $t('library.' + tab.label) }}</button
            >
          </div>
          <button
            v-show="
              currentTab === 'created' ||
              (ownUid && !visibleTabs.some(tab => tab.key === 'created'))
            "
            class="tab-button"
            @click="openAddPlaylistModal"
            ><svg-icon icon-class="plus" />{{ $t('library.newPlayList') }}
          </button>
          <button
            v-show="
              currentTab === 'cloudDisk' || (ownUid && !liked.cloudDisk.length)
            "
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
              :disabled-ids="offlineDisabledPlaylistIds"
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
              :title="$t('tracking.profile')"
              @notice="showToast($event)"
            />
            <button
              class="person-refresh"
              :disabled="activityRefreshing"
              @click="refreshActivity"
              >{{
                activityRefreshing
                  ? $t('library.refreshing')
                  : $t('library.refresh')
              }}</button
            >
          </div>
          <TrackingSection
            :max-age="600000"
            ref="ownEvents"
            :uid="ownUid"
            :scope="profileScope"
            :cache-enabled="true"
            section="events"
            @section-result="recordSection"
            :title="$t('library.activity')"
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
          @section-result="recordSection"
          :extra-artists="liked.artists"
          :title="$t('library.follows')"
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
            v-if="liked.playHistory.weekData.length"
            :class="{
              'playHistory-button': true,
              'playHistory-button--selected': playHistoryMode === 'week',
            }"
            @click="playHistoryMode = 'week'"
          >
            {{ $t('library.playHistory.week') }}
          </button>
          <button
            v-if="liked.playHistory.allData.length"
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
import { libraryScope, readSavedPlaylists } from '@/utils/offlineLibrary';
import { playableLibraryIds } from '@/utils/db';
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
      searchInput: '',
      searchQuery: '',
      searchTimer: null,
      show: false,
      offline: navigator.onLine === false,
      refreshFailed: false,
      refreshing: false,
      activityRefreshing: false,
      likedSongs: [],
      currentTab: 'created',
      playHistoryMode: 'week',
      socialVisibility: {},
      disabledPlaylistIds: [],
      offlinePlaylistStatusReady: false,
    };
  },
  computed: {
    visibleTabs() {
      const mine = list => String(list.creator?.userId) === this.ownUid;
      const lists = this.liked.playlists.slice(1);
      const history = this.liked.playHistory;
      const user = this.data.user || {};
      const signedIn = this.ownUid && isAccountLoggedIn();
      return [
        ['created', 'created', lists.some(mine)],
        ['saved', 'saved', lists.some(list => !mine(list))],
        ['albums', 'albums', signedIn && this.liked.albums.length],
        [
          'activity',
          'activity',
          signedIn && (this.socialVisibility.events ?? user.eventCount !== 0),
        ],
        [
          'follows',
          'follows',
          signedIn &&
            (this.liked.artists.length ||
              (this.socialVisibility.follows ?? user.follows !== 0)),
        ],
        ['mvs', 'videos', signedIn && this.liked.mvs.length],
        ['cloudDisk', 'cloudDisk', signedIn && this.liked.cloudDisk.length],
        [
          'playHistory',
          'ranking',
          signedIn && (history.weekData.length || history.allData.length),
        ],
      ]
        .filter(([, , visible]) => visible)
        .map(([key, label]) => ({ key, label }));
    },
    offlineDisabledPlaylistIds() {
      if (!this.offline) return [];
      if (!this.offlinePlaylistStatusReady)
        return this.filterPlaylists.map(playlist => String(playlist.id));
      return this.disabledPlaylistIds;
    },
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
    visibleTabs(tabs) {
      if (!tabs.some(tab => tab.key === this.currentTab))
        this.currentTab = tabs[0]?.key || '';
    },
    playHistoryList(list) {
      if (!list?.length && this.liked.playHistory.allData.length)
        this.playHistoryMode = 'all';
      else if (!list?.length && this.liked.playHistory.weekData.length)
        this.playHistoryMode = 'week';
    },
    searchInput(value) {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.searchQuery = value.trim();
      }, 160);
    },
    accountScope() {
      this.socialVisibility = {};
      this.closeSearch();
    },
  },
  beforeDestroy() {
    clearTimeout(this.searchTimer);
    window.removeEventListener('online', this.updateNetworkState);
    window.removeEventListener('offline', this.updateNetworkState);
  },
  created() {
    window.addEventListener('online', this.updateNetworkState);
    window.addEventListener('offline', this.updateNetworkState);
    setTimeout(() => {
      if (!this.show) NProgress.start();
    }, 1000);
    this.loadData();
  },
  activated() {
    this.$parent.$refs.scrollbar.restorePosition();
    this.loadData();
    if (navigator.onLine !== false && !archiveMode()) dailyTask();
  },
  methods: {
    recordSection({ uid, scope, section, data }) {
      if (uid !== this.ownUid || scope !== this.profileScope) return;
      this.$set(
        this.socialVisibility,
        section,
        Boolean(data?.[section === 'events' ? 'events' : 'follow']?.length)
      );
    },
    closeSearch() {
      clearTimeout(this.searchTimer);
      this.searchInput = '';
      this.searchQuery = '';
    },
    ...mapActions(['showToast']),
    ...mapMutations(['updateModal', 'updateData']),
    async loadData(force = false) {
      if (this.refreshing) return;
      this.refreshing = true;
      this.refreshFailed = false;
      try {
        await this.$store.dispatch('restoreLibrary');
        this.show = true;
        NProgress.done();
        this.offline = archiveMode() || navigator.onLine === false;
        if (this.offline) return;
        const refreshKey = 'library-refresh:' + this.accountScope;
        const refreshedAt = Number(localStorage.getItem(refreshKey)) || 0;
        if (!force && this.hasLocalData && Date.now() - refreshedAt < 600000) {
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
        if (scope !== this.accountScope) return;
        this.refreshFailed = results.some(
          result => result.status === 'rejected'
        );
        if (!this.refreshFailed && !this.offline)
          localStorage.setItem(refreshKey, String(Date.now()));
      } finally {
        await this.refreshOfflinePlaylistStatus();
        this.refreshing = false;
        this.show = true;
        NProgress.done();
      }
    },
    updateNetworkState() {
      this.offline = navigator.onLine === false || archiveMode();
      this.refreshOfflinePlaylistStatus();
    },
    async refreshOfflinePlaylistStatus() {
      const scope = this.accountScope;
      this.offlinePlaylistStatusReady = false;
      if (!this.offline) return;
      try {
        const [playableIds, snapshots] = await Promise.all([
          playableLibraryIds(),
          readSavedPlaylists(scope),
        ]);
        if (scope !== this.accountScope) return;
        const saved = new Map(
          snapshots.map(snapshot => [
            String(snapshot.playlist.id),
            snapshot.playlist,
          ])
        );
        this.disabledPlaylistIds = this.liked.playlists
          .filter(playlist => {
            const local = saved.get(String(playlist.id));
            const tracks =
              playlist.trackIds?.length || playlist.tracks?.length
                ? playlist.trackIds || playlist.tracks
                : local?.trackIds || local?.tracks || [];
            return !tracks.some(track =>
              playableIds.has(String(track.id || track))
            );
          })
          .map(playlist => String(playlist.id));
        this.offlinePlaylistStatusReady = true;
      } catch (_) {
        this.disabledPlaylistIds = this.liked.playlists.map(playlist =>
          String(playlist.id)
        );
        this.offlinePlaylistStatusReady = true;
      }
    },
    playLikedSongs() {
      if (!this.liked.playlists[0])
        return this.showToast(this.$t('library.noLocalPlaylists'));
      this.$store.state.player.playPlaylistByID(
        this.liked.playlists[0].id,
        'first',
        true
      );
    },
    playIntelligenceList() {
      if (!this.liked.playlists[0])
        return this.showToast(this.$t('library.noLocalPlaylists'));
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
          .catch(() => this.showToast(this.$t('library.artistRefreshFailed')));
      if (['created', 'saved'].includes(tab)) {
        this.updateData({
          key: 'libraryPlaylistFilter',
          value: tab === 'created' ? 'mine' : 'liked',
        });
      }
      this.$nextTick(() =>
        this.$refs.library
          .querySelector('.tabs-row')
          ?.scrollIntoView({ block: 'nearest' })
      );
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
        this.showToast(this.$t('library.uploadInProgress'));
        const result = await uploadSong(file);
        if (result?.code !== 200)
          throw new Error(result?.msg || this.$t('library.uploadUnsuccessful'));
        await this.$store.dispatch('fetchCloudDisk');
        this.showToast(this.$t('library.uploadSucceeded'));
      } catch (error) {
        this.showToast(error.message || this.$t('library.uploadFailed'));
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
@import '~@/assets/css/pageSearch.scss';
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
