<template>
  <div v-page-reveal class="tracking-page library-page">
    <header class="library-header">
      <h1
        ><LibraryAvatarMenu
          :avatar="managing ? ownUser.avatarUrl : selectedUser.avatar"
          :label="
            managing
              ? ownUser.nickname
              : selectedUser.alias || selectedUser.name || selected
          "
        />{{
          managing
            ? $t('tracking.manage')
            : selectedUser.alias || selectedUser.name || selected
        }}</h1
      >
      <div v-if="visiting && !managing" class="header-actions"
        ><button @click="backUser">{{ $t('tracking.back') }}</button></div
      >
    </header>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <div v-if="managing" key="management" v-page-reveal>
      <form class="add-user" @submit.prevent="addUser()"
        ><input
          v-model="inputId"
          inputmode="numeric"
          :aria-label="$t('tracking.userId')"
          :placeholder="$t('tracking.userId')"
        /><button :disabled="!ready">{{ $t('tracking.add') }}</button></form
      >
      <div v-for="(user, index) in users" :key="user.id" class="managed-user">
        <template v-if="editing === user.id">
          <form class="edit-user" @submit.prevent="saveEdit(user.id)"
            ><input
              v-model="editId"
              :aria-label="$t('tracking.userId')"
              inputmode="numeric"
              :placeholder="$t('tracking.userId')"
            /><input
              v-model="editAlias"
              :aria-label="$t('tracking.note')"
              :placeholder="$t('tracking.note')"
            /><button>{{ $t('tracking.save') }}</button
            ><button type="button" @click="editing = ''">{{
              $t('tracking.cancel')
            }}</button></form
          >
        </template>
        <template v-else>
          <div class="person"
            ><img
              v-if="user.avatar"
              v-image-fade
              :src="user.avatar | resizeImage(96)"
              alt=""
            /><span
              >{{ user.alias || user.name || user.id
              }}<small>ID {{ user.id }}</small></span
            ></div
          >
          <div class="person-actions"
            ><button @click="edit(user)">{{ $t('tracking.edit') }}</button
            ><button :disabled="index === 0" @click="move(index, -1)">{{
              $t('tracking.moveUp')
            }}</button
            ><button
              :disabled="index === users.length - 1"
              @click="move(index, 1)"
              >{{ $t('tracking.moveDown') }}</button
            ><button @click="remove(user.id)">{{
              $t('tracking.delete')
            }}</button></div
          >
        </template>
      </div>
    </div>
    <template v-else>
      <TrackingSection
        :refresh-on-open="true"
        ref="collection"
        v-if="selected"
        :key="selected"
        :uid="selected"
        :scope="scope"
        :cache-enabled="isSavedUser"
        section="playlists"
        :title="$t('library.playlists')"
        class="tracking-collection"
        @section-result="recordSection"
        @notice="notice = $event"
      >
        <template #default="{ items, loading, error, more, load }">
          <div class="section-one">
            <div
              class="liked-songs"
              :class="{ unavailable: !likedPlaylist(items) }"
              @click="openLikes(items)"
            >
              <div class="top">
                <img
                  v-if="likedPlaylist(items)"
                  v-image-fade
                  :src="likedPlaylist(items).coverImgUrl | resizeImage(224)"
                  alt=""
                />
                <p v-else>{{
                  loading
                    ? $t('tracking.loading')
                    : $t('tracking.likedUnavailable')
                }}</p>
              </div>
              <div class="bottom">
                <div class="titles">
                  <div class="title">{{ $t('tracking.likedMusic') }}</div>
                  <div v-if="likedPlaylist(items)" class="sub-title">{{
                    $t('tracking.songCount', {
                      count: likedPlaylist(items).trackCount,
                    })
                  }}</div>
                </div>
                <button
                  v-if="likedPlaylist(items)"
                  class="preview-toggle"
                  :aria-expanded="likesExpanded"
                  @click.stop="likesExpanded = !likesExpanded"
                  >{{
                    likesExpanded
                      ? $t('tracking.collapseSongs')
                      : $t('tracking.showSongs')
                  }}</button
                >
                <button
                  v-if="likedPlaylist(items)"
                  :aria-label="$t('tracking.playLiked')"
                  @click.stop="playLikes(items)"
                  ><svg-icon icon-class="play"
                /></button>
              </div>
            </div>
            <div class="songs">
              <TrackingSection
                v-if="likedPlaylist(items) && likesExpanded"
                :refresh-on-open="true"
                :uid="selected"
                :scope="scope"
                :cache-enabled="isSavedUser"
                ref="likes"
                section="likes"
                :title="$t('tracking.likedMusic')"
                :playlist-id="Number(likedPlaylist(items).id)"
                class="likes-preview"
              >
                <template
                  #default="{
                    tracks,
                    loading: likesLoading,
                    error: likesError,
                  }"
                >
                  <TrackList
                    v-if="tracks.length"
                    :id="Number(likedPlaylist(items).id)"
                    :tracks="tracks"
                    :column-number="3"
                    :single-click-play="true"
                    type="tracklist"
                    dbclick-track-func="playPlaylistByID"
                  />
                  <p v-else class="muted">{{
                    likesLoading
                      ? $t('tracking.loading')
                      : likesError || $t('tracking.noVisibleSongs')
                  }}</p>
                </template>
              </TrackingSection>
            </div>
          </div>
          <div class="section-two">
            <div class="tabs-row">
              <div
                class="tabs"
                role="tablist"
                :aria-label="$t('tracking.contentGroups')"
              >
                <button
                  v-for="item in visibleGroups"
                  :key="item.key"
                  class="tab"
                  role="tab"
                  :aria-selected="group === item.key"
                  :class="{ active: group === item.key }"
                  @click="group = item.key"
                  >{{ item.title }}</button
                >
              </div>
            </div>
            <p v-if="!visibleGroups.length" class="muted">{{
              $t('tracking.noContent')
            }}</p>
            <div :key="group" v-page-reveal>
              <div v-if="group === 'activity'" class="activity-columns">
                <div class="profile-column">
                  <TrackingSection
                    :refresh-on-open="true"
                    :uid="selected"
                    :scope="scope"
                    :cache-enabled="isSavedUser"
                    ref="profile"
                    section="profile"
                    @section-result="recordSection"
                    :title="$t('tracking.profile')"
                    @profile="updateProfile"
                    @notice="notice = $event"
                  />
                  <button
                    class="person-refresh"
                    :disabled="!selected || refreshing"
                    @click="refreshCurrent"
                    >{{
                      refreshing
                        ? $t('tracking.refreshing')
                        : $t('tracking.refresh')
                    }}</button
                  >
                </div>
                <TrackingSection
                  :refresh-on-open="true"
                  :uid="selected"
                  :scope="scope"
                  :cache-enabled="isSavedUser"
                  ref="events"
                  section="events"
                  @section-result="recordSection"
                  :title="$t('tracking.activity')"
                  @notice="notice = $event"
                />
              </div>
              <template v-else-if="group === 'created' || group === 'saved'">
                <p v-if="error" role="status" class="muted">{{ error }}</p>
                <CoverRow
                  :items="groupPlaylists(items)"
                  :compact="groupPlaylists(items).length > 20"
                  type="playlist"
                  sub-text="creator"
                  :show-play-count="true"
                />
                <p
                  v-if="!loading && !error && !groupPlaylists(items).length"
                  class="muted"
                  >{{ $t('tracking.noContent') }}</p
                >
                <button
                  v-if="more"
                  :disabled="loading"
                  class="load-more"
                  @click="load(false, true)"
                  >{{ $t('tracking.loadMore') }}</button
                >
              </template>
              <TrackingSection
                :refresh-on-open="true"
                v-else-if="['follows', 'fans'].includes(group)"
                :uid="selected"
                :scope="scope"
                :cache-enabled="isSavedUser"
                ref="people"
                @section-result="recordSection"
                :section="group === 'fans' ? 'fans' : 'follows'"
                :title="
                  group === 'fans'
                    ? $t('tracking.fans')
                    : $t('tracking.follows')
                "
                @open-user="openUser"
                @notice="notice = $event"
              />
              <template v-else-if="group === 'listening'">
                <button
                  v-if="sectionVisibility.week !== false"
                  class="playHistory-button"
                  :class="{ 'playHistory-button--selected': rank === 'week' }"
                  @click="rank = 'week'"
                  >{{ $t('tracking.latestWeek') }}</button
                >
                <button
                  v-if="sectionVisibility.all !== false"
                  class="playHistory-button"
                  :class="{ 'playHistory-button--selected': rank === 'all' }"
                  @click="rank = 'all'"
                  >{{ $t('tracking.allTime') }}</button
                >
                <TrackingSection
                  :refresh-on-open="true"
                  :uid="selected"
                  :scope="scope"
                  :cache-enabled="isSavedUser"
                  ref="ranking"
                  @section-result="recordSection"
                  :section="rank"
                  :title="$t('tracking.ranking')"
                  @notice="notice = $event"
                />
              </template>
            </div>
          </div>
        </template>
      </TrackingSection>
      <button
        v-else-if="ready && !selected"
        class="empty-add"
        @click="$router.push({ name: 'libraryPeople' })"
        >{{ $t('tracking.addUser') }}</button
      >
    </template>
  </div>
</template>
<script>
import LibraryAvatarMenu from '@/components/LibraryAvatarMenu.vue';
import { removeTrackingArtwork } from '@/utils/trackingArtwork';
import CoverRow from '@/components/CoverRow.vue';
import TrackList from '@/components/TrackList.vue';
import TrackingSection from '@/components/TrackingSection.vue';
import {
  trackingScope,
  normalizeTrackingId,
  readTrackingList,
  saveTrackingList,
  deleteTrackingSnapshots,
} from '@/utils/trackingStore';
export default {
  name: 'Tracking',
  components: { TrackingSection, CoverRow, TrackList, LibraryAvatarMenu },
  data() {
    return {
      users: [],
      selected: '',
      visiting: null,
      userHistory: [],
      refreshing: false,
      inputId: '',
      ready: false,
      notice: '',
      likesExpanded: false,
      managing: false,
      editing: '',
      editId: '',
      editAlias: '',
      group: 'activity',
      rank: 'week',
      sectionVisibility: {},
      scopeGeneration: 0,
      listWrites: Promise.resolve(),
    };
  },
  computed: {
    groups() {
      return [
        { key: 'activity', title: this.$t('tracking.activity') },
        { key: 'listening', title: this.$t('tracking.ranking') },
        { key: 'follows', title: this.$t('tracking.follows') },
        { key: 'fans', title: this.$t('tracking.fans') },
        { key: 'created', title: this.$t('tracking.created') },
        { key: 'saved', title: this.$t('tracking.saved') },
      ];
    },
    visibleGroups() {
      return this.groups.filter(
        item => this.sectionVisibility[item.key] !== false
      );
    },
    ownUser() {
      return this.$store.state.data.user || {};
    },
    scope() {
      return trackingScope(this.$store.state.data?.user?.userId);
    },
    selectedUser() {
      return (
        this.users.find(user => user.id === this.selected) ||
        this.visiting ||
        {}
      );
    },
    isSavedUser() {
      return this.users.some(user => user.id === this.selected);
    },
  },
  watch: {
    selected() {
      this.sectionVisibility = {};
    },
    visibleGroups(groups) {
      if (!groups.some(item => item.key === this.group))
        this.group = groups[0]?.key || '';
    },
    scope: {
      immediate: true,
      handler() {
        this.restore();
      },
    },
  },
  async activated() {
    if (!this.ready) return;
    const scope = this.scope;
    const users = await readTrackingList(scope);
    if (scope !== this.scope || this._isDestroyed) return;
    this.users = users
      .filter(user => normalizeTrackingId(user.id))
      .map(user => ({ alias: '', ...user }));
    this.syncRoute();
  },
  beforeDestroy() {
    this.scopeGeneration++;
  },
  methods: {
    recordSection({ uid, scope, section, data }) {
      if (uid !== this.selected || scope !== this.scope) return;
      const visibility = { ...this.sectionVisibility };
      if (section === 'profile' && data) {
        const profile = data.profile || {};
        if (profile.follows === 0) visibility.follows = false;
        if (profile.followeds === 0) visibility.fans = false;
        if (data.peopleCanSeeMyPlayRecord === false)
          visibility.listening = false;
      } else if (section === 'playlists') {
        for (const key of ['created', 'saved'])
          visibility[key] = Boolean(
            data?.more || this.groupPlaylists(data?.playlist || [], key).length
          );
      } else if (section === 'events') {
        visibility.activity = Boolean(data?.events?.length);
      } else if (section === 'week' || section === 'all') {
        visibility[section] = Boolean(
          data?.[section + 'Data']?.some(row => row.song?.id)
        );
        visibility.listening =
          visibility.week !== false || visibility.all !== false;
        if (!visibility[section])
          this.rank = section === 'week' ? 'all' : 'week';
      } else if (section === 'follows' || section === 'fans') {
        visibility[section] = Boolean(
          data?.[section === 'fans' ? 'followeds' : 'follow']?.length
        );
      }
      this.sectionVisibility = visibility;
    },
    date(value) {
      return value ? new Date(value).toLocaleString(this.$i18n.locale) : '';
    },
    syncRoute() {
      this.sectionVisibility = {};
      if (!this.$route) return;
      this.managing = this.$route.name === 'libraryPeople';
      const id = normalizeTrackingId(this.$route.params.uid);
      this.selected = id || '';
      this.visiting =
        id && !this.users.some(user => user.id === id)
          ? {
              id,
              name: this.$route.query.name || '',
              avatar: this.$route.query.avatar || '',
            }
          : null;
    },
    async refreshCurrent() {
      if (this.refreshing || !this.selected) return;
      const generation = this.scopeGeneration;
      this.refreshing = true;
      const sections = [
        'collection',
        'likes',
        'profile',
        'events',
        'ranking',
        'people',
      ]
        .map(key => this.$refs[key])
        .filter(Boolean);
      try {
        await Promise.all(sections.map(section => section.load(true)));
      } finally {
        if (generation === this.scopeGeneration) this.refreshing = false;
      }
    },
    openUser(user) {
      if (this.$router) {
        const uid = normalizeTrackingId(user.userId);
        if (uid === String(this.ownUser.userId)) {
          this.$router.push('/library');
          return;
        }
        if (uid && uid !== this.selected)
          this.$router.push({
            name: 'libraryPerson',
            params: { uid },
            query: { name: user.nickname || '', avatar: user.avatarUrl || '' },
          });
        return;
      }
      const id = normalizeTrackingId(user.userId);
      if (!id || id === this.selected) return;
      this.userHistory.push({
        id: this.selected,
        user: this.selectedUser,
        group: this.group,
        rank: this.rank,
      });
      this.visiting = {
        id,
        name: user.nickname || '',
        avatar: user.avatarUrl || '',
      };
      this.selected = id;
      this.group = 'activity';
      this.rank = 'week';
      this.notice = '';
      this.likesExpanded = false;
    },
    backUser() {
      if (this.$router) {
        this.$router.back();
        return;
      }
      const previous = this.userHistory.pop();
      if (!previous) return;
      this.selected = previous.id;
      this.visiting = previous.user;
      this.group = previous.group;
      this.rank = previous.rank;
      this.notice = '';
      this.likesExpanded = false;
    },
    likedPlaylist(items) {
      return items.find(
        item =>
          String(item.creator?.userId) === this.selected &&
          Number(item.specialType) === 5
      );
    },
    groupPlaylists(items, group = this.group) {
      const likes = this.likedPlaylist(items);
      return items.filter(
        item =>
          item !== likes &&
          (group === 'created'
            ? String(item.creator?.userId) === this.selected
            : String(item.creator?.userId) !== this.selected)
      );
    },
    openLikes(items) {
      const playlist = this.likedPlaylist(items);
      if (playlist) this.$router.push('/playlist/' + playlist.id);
    },
    playLikes(items) {
      const playlist = this.likedPlaylist(items);
      if (playlist)
        this.$store.state.player.playPlaylistByID(playlist.id, 'first', true);
    },
    async restore() {
      const epoch = ++this.scopeGeneration;
      this.users = [];
      this.selected = '';
      this.visiting = null;
      this.userHistory = [];
      this.refreshing = false;
      this.ready = false;
      this.notice = '';
      this.editing = '';
      const users = await readTrackingList(this.scope);
      if (epoch !== this.scopeGeneration) return;
      this.users = users
        .filter(user => normalizeTrackingId(user.id))
        .map(user => ({ alias: '', ...user }));
      this.ready = true;
      if (this.$route) this.syncRoute();
      else if (this.users.length) this.selectUser(this.users[0].id, false);
    },
    persist() {
      const scope = this.scope,
        users = JSON.parse(JSON.stringify(this.users));
      this.listWrites = this.listWrites
        .catch(() => {})
        .then(() => saveTrackingList(scope, users))
        .catch(() => {
          if (scope === this.scope)
            this.notice = this.$t('tracking.saveFailed');
        });
    },
    selectUser(id, navigate = true) {
      if (navigate && this.$router) {
        this.listWrites
          .catch(() => {})
          .then(() =>
            this.$router.push({ name: 'libraryPerson', params: { uid: id } })
          );
        return;
      }
      if (!this.users.some(user => user.id === id)) return;
      this.visiting = null;
      this.userHistory = [];
      this.selected = id;
      this.group = 'activity';
      this.rank = 'week';
      this.notice = '';
      this.likesExpanded = false;
    },
    addUser() {
      if (!this.ready) return;
      const id = normalizeTrackingId(this.inputId);
      if (!id) {
        this.notice = this.$t('tracking.invalidUserId');
        return;
      }
      if (this.users.some(user => user.id === id)) {
        this.notice = this.$t('tracking.alreadyAdded');
        return;
      }
      this.users.push({ id, name: '', avatar: '', alias: '' });
      this.inputId = '';
      this.persist();
      this.selectUser(id);
    },
    edit(user) {
      this.editing = user.id;
      this.editId = user.id;
      this.editAlias = user.alias || '';
      this.notice = '';
    },
    saveEdit(oldId) {
      const id = normalizeTrackingId(this.editId);
      if (!id) {
        this.notice = this.$t('tracking.invalidUserId');
        return;
      }
      if (this.users.some(user => user.id === id && user.id !== oldId)) {
        this.notice = this.$t('tracking.alreadyAdded');
        return;
      }
      const index = this.users.findIndex(user => user.id === oldId);
      if (index < 0) return;
      const old = this.users[index];
      this.$set(this.users, index, {
        id,
        name: id === oldId ? old.name : '',
        avatar: id === oldId ? old.avatar : '',
        alias: this.editAlias.trim(),
      });
      if (id !== oldId) {
        removeTrackingArtwork(this.scope, oldId);
        deleteTrackingSnapshots(this.scope, oldId).catch(() => {});
      }
      if (this.selected === oldId) this.selectUser(id);
      this.editing = '';
      this.notice = '';
      this.persist();
    },
    remove(id) {
      this.users = this.users.filter(user => user.id !== id);
      this.persist();
      removeTrackingArtwork(this.scope, id);
      deleteTrackingSnapshots(this.scope, id).catch(() => {});
      if (this.selected === id) {
        this.selected = '';
        if (this.users.length) this.selectUser(this.users[0].id, false);
      }
    },
    move(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= this.users.length) return;
      const users = this.users.slice();
      [users[index], users[next]] = [users[next], users[index]];
      this.users = users;
      this.persist();
    },
    updateProfile({ uid, profile }) {
      const user = this.users.find(user => user.id === uid);
      if (!user) {
        if (uid === this.selected)
          this.visiting = {
            id: uid,
            name: profile.nickname || '',
            avatar: profile.avatarUrl || '',
          };
        return;
      }
      user.name = profile.nickname || '';
      user.avatar = profile.avatarUrl || '';
      this.persist();
    },
  },
};
</script>
<style lang="scss" scoped>
@import '~@/assets/css/library.scss';

.tracking-page {
  color: var(--color-text);
  padding-bottom: 32px;
}
.tracking-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}
.header-actions,
.person-actions,
.add-user,
.edit-user {
  display: flex;
  align-items: center;
  gap: 8px;
}
.header-actions button,
.person-actions button,
.add-user button,
.edit-user button,
input,
select,
.collection-actions button,
.load-more,
.empty-add {
  color: var(--color-text);
  font: inherit;
  border: none;
  border-radius: 8px;
  background: var(--color-secondary-bg);
  padding: 10px 14px;
  min-width: 0;
}
button:disabled {
  opacity: 0.35;
}
select {
  max-width: 240px;
}
.add-user {
  margin: 24px 0;
  input {
    flex: 1;
    max-width: 400px;
  }
}
.managed-user {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.person {
  display: flex;
  align-items: center;
  gap: 12px;
  img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
  }
  small {
    display: block;
    font-size: 12px;
    opacity: 0.6;
    margin-top: 5px;
  }
}
.edit-user {
  flex-wrap: wrap;
  width: 100%;
  input {
    flex: 1;
  }
}
.notice,
.muted {
  margin: 12px 0;
  opacity: 0.7;
}
.empty-add {
  display: block;
  margin: 60px auto;
}
.tracking-page .tracking-collection,
.tracking-page .likes-preview {
  margin: 0;
}
.liked-songs.unavailable {
  cursor: default;
}
.collection-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}
.load-more {
  display: block;
  margin: 24px auto;
}
@media (max-width: 600px) {
  select {
    max-width: 155px;
  }
  .person-actions {
    flex-wrap: wrap;
  }
}
</style>

<style lang="scss" scoped>
.header-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
  max-width: 100%;
}
</style>

<style lang="scss" scoped>
.tracking-avatar-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  margin-right: 12px;
  border: none;
  border-radius: 50%;
  flex-shrink: 0;
  background: var(--color-secondary-bg);
  color: var(--color-text);
  cursor: pointer;
  .tracking-avatar {
    margin-right: 0;
    object-fit: cover;
  }
  span {
    font-size: 22px;
  }
}
</style>
<style lang="scss">
.context-menu.tracking-switch-menu .menu {
  width: max-content;
  max-width: min(480px, calc(100vw - 24px));
}
.context-menu.tracking-switch-menu .menu .item {
  display: block;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.context-menu.tracking-switch-menu .menu .item.selected {
  color: var(--color-primary);
  background: var(--color-primary-bg-for-transparent);
}
</style>

<style lang="scss" scoped>
.profile-column {
  min-width: 0;
}
.person-refresh {
  margin: 20px 0 0;
}
.activity-columns {
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(0, 1.65fr);
  gap: 28px;
  align-items: start;
}
.tracking-page .liked-songs .bottom button.preview-toggle {
  width: auto;
  height: auto;
  margin: 0 8px 0 0;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--color-secondary-bg);
  box-shadow: none;
  color: var(--color-text);
  font-size: 12px;
}
@media (max-width: 850px) {
  .activity-columns {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }
}
@media (max-width: 520px) {
  .tracking-page .liked-songs .bottom button.preview-toggle {
    margin-right: 5px;
    padding: 6px 8px;
  }
}
</style>

<style lang="scss">
.pswp {
  --pswp-icon-color: #fff;
  --pswp-root-z-index: 20000;
}
.pswp__top-bar {
  padding-top: env(safe-area-inset-top, 0px);
}
.pswp .pswp__button--save-photo {
  width: 60px;
  color: #fff;
  font-size: 14px;
}
</style>
