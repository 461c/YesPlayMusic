<template>
  <div v-page-reveal class="tracking-page library-page">
    <header>
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
            ? '管理'
            : selectedUser.alias || selectedUser.name || selected
        }}</h1
      >
      <div v-if="visiting && !managing" class="header-actions"
        ><button @click="backUser">返回</button></div
      >
    </header>
    <p v-if="notice" class="notice" role="status">{{ notice }}</p>
    <div v-if="managing" key="management" v-page-reveal>
      <form class="add-user" @submit.prevent="addUser()"
        ><input
          v-model="inputId"
          inputmode="numeric"
          aria-label="用户 ID"
          placeholder="用户 ID"
        /><button :disabled="!ready">添加</button></form
      >
      <div v-for="(user, index) in users" :key="user.id" class="managed-user">
        <template v-if="editing === user.id">
          <form class="edit-user" @submit.prevent="saveEdit(user.id)"
            ><input
              v-model="editId"
              aria-label="修改用户 ID"
              inputmode="numeric"
              placeholder="用户 ID"
            /><input
              v-model="editAlias"
              aria-label="备注"
              placeholder="备注"
            /><button>保存</button
            ><button type="button" @click="editing = ''">取消</button></form
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
            ><button @click="edit(user)">修改</button
            ><button :disabled="index === 0" @click="move(index, -1)"
              >上移</button
            ><button
              :disabled="index === users.length - 1"
              @click="move(index, 1)"
              >下移</button
            ><button @click="remove(user.id)">删除</button></div
          >
        </template>
      </div>
    </div>
    <template v-else>
      <TrackingSection
        ref="collection"
        v-if="selected"
        :key="selected"
        :uid="selected"
        :scope="scope"
        :cache-enabled="isSavedUser"
        section="playlists"
        title="歌单"
        class="tracking-collection"
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
                <p v-else>{{ loading ? '加载中…' : '喜欢的音乐暂不可见' }}</p>
              </div>
              <div class="bottom">
                <div class="titles">
                  <div class="title">喜欢的音乐</div>
                  <div v-if="likedPlaylist(items)" class="sub-title"
                    >{{ likedPlaylist(items).trackCount }} 首歌曲</div
                  >
                </div>
                <button
                  v-if="likedPlaylist(items)"
                  aria-label="播放喜欢的音乐"
                  @click.stop="playLikes(items)"
                  ><svg-icon icon-class="play"
                /></button>
              </div>
            </div>
            <div class="songs">
              <TrackingSection
                v-if="likedPlaylist(items)"
                :uid="selected"
                :scope="scope"
                :cache-enabled="isSavedUser"
                ref="likes"
                section="likes"
                title="喜欢的音乐"
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
                    likesLoading ? '加载中…' : likesError || '暂无可见歌曲'
                  }}</p>
                </template>
              </TrackingSection>
            </div>
          </div>
          <div class="section-two">
            <div class="tabs-row">
              <div class="tabs" role="tablist" aria-label="内容分组">
                <button
                  v-for="item in groups"
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
            <div :key="group" v-page-reveal>
              <div v-if="group === 'activity'" class="activity-columns">
                <div class="profile-column">
                  <TrackingSection
                    :uid="selected"
                    :scope="scope"
                    :cache-enabled="isSavedUser"
                    ref="profile"
                    section="profile"
                    title="资料"
                    @profile="updateProfile"
                    @notice="notice = $event"
                  />
                  <button
                    class="person-refresh"
                    :disabled="!selected || refreshing"
                    @click="refreshCurrent"
                    >{{ refreshing ? '刷新中…' : '刷新' }}</button
                  >
                </div>
                <TrackingSection
                  :uid="selected"
                  :scope="scope"
                  :cache-enabled="isSavedUser"
                  ref="events"
                  section="events"
                  title="动态"
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
                  >暂无内容</p
                >
                <button
                  v-if="more"
                  :disabled="loading"
                  class="load-more"
                  @click="load(false, true)"
                  >加载更多</button
                >
              </template>
              <TrackingSection
                v-else-if="['follows', 'fans'].includes(group)"
                :uid="selected"
                :scope="scope"
                :cache-enabled="isSavedUser"
                ref="people"
                :section="group === 'fans' ? 'fans' : 'follows'"
                :title="group === 'fans' ? '粉丝' : '关注'"
                @open-user="openUser"
                @notice="notice = $event"
              />
              <template v-else-if="group === 'listening'">
                <button
                  class="playHistory-button"
                  :class="{ 'playHistory-button--selected': rank === 'week' }"
                  @click="rank = 'week'"
                  >最近一周</button
                >
                <button
                  class="playHistory-button"
                  :class="{ 'playHistory-button--selected': rank === 'all' }"
                  @click="rank = 'all'"
                  >所有时间</button
                >
                <TrackingSection
                  :uid="selected"
                  :scope="scope"
                  :cache-enabled="isSavedUser"
                  ref="ranking"
                  :section="rank"
                  title="听歌排行"
                  @notice="notice = $event"
                />
              </template>
            </div>
          </div>
        </template>
      </TrackingSection>
      <button
        v-else-if="ready"
        class="empty-add"
        @click="$router.push({ name: 'libraryPeople' })"
        >添加用户</button
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
      managing: false,
      editing: '',
      editId: '',
      editAlias: '',
      group: 'activity',
      rank: 'week',
      scopeGeneration: 0,
      listWrites: Promise.resolve(),
      groups: [
        { key: 'activity', title: '动态' },
        { key: 'listening', title: '排行' },
        { key: 'follows', title: '关注' },
        { key: 'fans', title: '粉丝' },
        { key: 'created', title: '创建' },
        { key: 'saved', title: '收藏' },
      ],
    };
  },
  computed: {
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
    syncRoute() {
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
    },
    likedPlaylist(items) {
      return items.find(
        item =>
          String(item.creator?.userId) === this.selected &&
          Number(item.specialType) === 5
      );
    },
    groupPlaylists(items) {
      const likes = this.likedPlaylist(items);
      return items.filter(
        item =>
          item !== likes &&
          (this.group === 'created'
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
          if (scope === this.scope) this.notice = '列表保存失败';
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
    },
    addUser() {
      if (!this.ready) return;
      const id = normalizeTrackingId(this.inputId);
      if (!id) {
        this.notice = '请输入有效的用户 ID';
        return;
      }
      if (this.users.some(user => user.id === id)) {
        this.notice = '此用户已添加';
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
        this.notice = '请输入有效的用户 ID';
        return;
      }
      if (this.users.some(user => user.id === id && user.id !== oldId)) {
        this.notice = '此用户已添加';
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
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
header h1 {
  min-width: 0;
  overflow-wrap: anywhere;
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
.tabs button {
  background: transparent;
  font: inherit;
  text-align: left;
}
@media (max-width: 600px) {
  header {
    flex-wrap: wrap;
    gap: 12px;
  }
  header h1 {
    font-size: 26px;
  }
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
@media (max-width: 850px) {
  .activity-columns {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
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
