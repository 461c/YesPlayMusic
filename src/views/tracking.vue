<template>
  <div v-page-reveal class="tracking-page">
    <header
      ><h1>跟踪</h1
      ><p
        >把在意的人放在这里。仅查看对方公开、当前账号有权访问的内容。</p
      ></header
    >
    <form class="add-user" @submit.prevent="addUser()">
      <input
        v-model="inputId"
        inputmode="numeric"
        aria-label="网易云用户 ID"
        placeholder="输入网易云用户 ID"
      />
      <button :disabled="!ready">添加</button>
    </form>
    <p v-if="notice" role="status">{{ notice }}</p>
    <div class="tracking-layout">
      <aside aria-label="跟踪列表">
        <p v-if="ready && !users.length" class="muted"
          >还没有添加用户。输入个人主页中的数字 ID 开始。</p
        >
        <div
          v-for="(user, index) in users"
          :key="user.id"
          class="person"
          :class="{ selected: selected === user.id }"
        >
          <button class="person-name" @click="selectUser(user.id)"
            ><img
              v-if="user.avatar"
              v-image-fade
              :src="user.avatar | resizeImage(96)"
              alt=""
            /><span
              >{{ user.name || user.id }}<small>ID {{ user.id }}</small></span
            ></button
          >
          <div class="person-actions">
            <button
              :disabled="index === 0"
              :aria-label="'上移 ' + (user.name || user.id)"
              @click="move(index, -1)"
              >上移</button
            >
            <button
              :disabled="index === users.length - 1"
              :aria-label="'下移 ' + (user.name || user.id)"
              @click="move(index, 1)"
              >下移</button
            >
            <button @click="remove(user.id)">删除</button>
          </div>
        </div>
      </aside>
      <section v-if="selected" class="detail">
        <div class="detail-heading"
          ><h2>{{ selectedUser.name || selected }}</h2
          ><a
            :href="'https://music.163.com/#/user/home?id=' + selected"
            target="_blank"
            rel="noopener noreferrer"
            >网易云主页</a
          ></div
        >
        <div class="tabs" role="tablist" aria-label="公开信息栏目"
          ><button
            v-for="item in sections"
            :key="item.key"
            role="tab"
            :aria-selected="tab === item.key"
            :class="{ active: tab === item.key }"
            @click="changeTab(item.key)"
            >{{ item.title }}</button
          ></div
        >
        <div class="status-line"
          ><span>{{
            updatedAt ? '上次获取：' + date(updatedAt) : '尚未获取'
          }}</span
          ><button :disabled="loading" @click="load(true)">{{
            loading ? '加载中…' : '刷新本栏'
          }}</button></div
        >
        <p v-if="error" role="status" class="muted"
          >{{ error }}。可能未公开、需要登录或服务暂时不可用。{{
            payload ? '下方保留上次获取的内容。' : ''
          }}</p
        >
        <div v-if="payload" :key="selected + tab" v-page-reveal>
          <template v-if="tab === 'profile'">
            <div class="profile-card"
              ><img
                v-if="profile.avatarUrl"
                v-image-fade
                :src="profile.avatarUrl | resizeImage(224)"
                alt="用户头像"
              /><div
                ><h2>{{ profile.nickname }}</h2
                ><p class="signature">{{
                  profile.signature || '暂无公开签名'
                }}</p
                ><p v-if="profile.description">{{ profile.description }}</p
                ><p v-if="profile.detailDescription">{{
                  profile.detailDescription
                }}</p></div
              ></div
            >
            <dl class="stats"
              ><div v-for="stat in profileStats" :key="stat.label"
                ><dt>{{ stat.label }}</dt
                ><dd>{{ stat.value }}</dd></div
              ></dl
            >
            <p v-if="payload.identify && payload.identify.imageDesc"
              >身份认证：{{ payload.identify.imageDesc }}</p
            >
            <p v-if="profile.artistId"
              ><router-link :to="'/artist/' + profile.artistId"
                >查看歌手主页</router-link
              ></p
            >
          </template>
          <template v-else-if="tab === 'playlists'">
            <p class="muted"
              >仅列出接口可见歌单，包括创建与收藏；不会主动加载歌单内部歌曲。</p
            >
            <div class="playlist-grid"
              ><router-link
                v-for="item in items"
                :key="item.id"
                class="playlist-card"
                :to="'/playlist/' + item.id"
                ><img
                  v-if="item.coverImgUrl"
                  v-image-fade
                  :src="item.coverImgUrl | resizeImage(224)"
                  loading="lazy"
                  alt=""
                /><strong>{{ item.name }}</strong
                ><small
                  >{{
                    String((item.creator || {}).userId) === selected
                      ? '创建'
                      : '收藏'
                  }}
                  · {{ item.trackCount || 0 }} 首 · 播放
                  {{ item.playCount || 0 }}</small
                ><small v-if="item.updateTime"
                  >更新于 {{ date(item.updateTime) }}</small
                ><p v-if="item.description">{{
                  item.description
                }}</p></router-link
              ></div
            >
          </template>
          <template v-else-if="tab === 'week' || tab === 'all'">
            <p class="muted"
              >这是听歌排行，不是逐次播放时间线；次数仅在接口提供时显示。</p
            >
            <div
              v-for="(item, index) in items"
              :key="item.song.id"
              class="record"
              ><span>{{ index + 1 }}</span
              ><button @click="play(item.song.id)"
                ><img
                  v-if="(item.song.al || {}).picUrl"
                  v-image-fade
                  :src="item.song.al.picUrl | resizeImage(96)"
                  loading="lazy"
                  alt=""
                /><span
                  ><strong>{{ item.song.name }}</strong
                  ><small
                    >{{ artists(item.song) }} ·
                    {{ (item.song.al || {}).name }}</small
                  ></span
                ></button
              ><small>{{
                item.playCount === undefined
                  ? '次数未公开'
                  : item.playCount + ' 次'
              }}</small></div
            >
          </template>
          <template v-else-if="tab === 'events'">
            <article v-for="item in items" :key="item.id" class="event"
              ><small>{{ date(item.eventTime || item.showTime) }}</small
              ><p>{{ eventData(item).msg || '分享了一条动态' }}</p
              ><router-link
                v-if="eventData(item).song"
                :to="'/album/' + (eventData(item).song.album || {}).id"
                >分享歌曲：{{ eventData(item).song.name }}</router-link
              ><router-link
                v-if="eventData(item).playlist"
                :to="'/playlist/' + eventData(item).playlist.id"
                >分享歌单：{{ eventData(item).playlist.name }}</router-link
              ><router-link
                v-if="eventData(item).album"
                :to="'/album/' + eventData(item).album.id"
                >分享专辑：{{ eventData(item).album.name }}</router-link
              ><div class="event-images"
                ><img
                  v-for="(pic, index) in item.pics || []"
                  :key="index"
                  v-image-fade
                  :src="(pic.originUrl || pic.squareUrl) | resizeImage(224)"
                  loading="lazy"
                  alt="动态图片" /></div
              ><small
                >赞 {{ (item.info || {}).likedCount || 0 }} · 评论
                {{ (item.info || {}).commentCount || 0 }} · 转发
                {{ (item.info || {}).shareCount || 0 }}</small
              ></article
            >
          </template>
          <template v-else-if="tab === 'follows' || tab === 'followers'">
            <div v-for="item in items" :key="item.userId" class="social-person"
              ><img
                v-if="item.avatarUrl"
                v-image-fade
                :src="item.avatarUrl | resizeImage(96)"
                loading="lazy"
                alt=""
              /><div
                ><strong>{{ item.nickname }}</strong
                ><small>ID {{ item.userId }}</small
                ><p>{{ item.signature }}</p></div
              ><button @click="addUser(String(item.userId))"
                >添加到跟踪</button
              ></div
            >
          </template>
          <template v-else-if="tab === 'radios'">
            <article v-for="item in items" :key="item.id" class="event"
              ><h3>{{ item.name }}</h3
              ><p>{{ item.desc }}</p
              ><small
                >订阅 {{ item.subCount || 0 }} · 节目
                {{ item.programCount || 0 }}</small
              ></article
            >
          </template>
          <p v-if="tab !== 'profile' && !items.length" class="muted"
            >当前没有可见内容；空列表不代表对方没有活动。</p
          >
          <button
            v-if="hasMore"
            :disabled="loading"
            class="load-more"
            @click="load(false, true)"
            >加载更多</button
          >
        </div>
      </section>
    </div>
  </div>
</template>

<script>
import { trackingSections, readTrackingSection } from '@/api/tracking';
import {
  trackingScope,
  normalizeTrackingId,
  readTrackingList,
  saveTrackingList,
  readTrackingSnapshot,
  saveTrackingSnapshot,
  deleteTrackingSnapshots,
} from '@/utils/trackingStore';

export default {
  name: 'Tracking',
  data() {
    return {
      sections: trackingSections,
      users: [],
      selected: '',
      inputId: '',
      tab: 'profile',
      payload: null,
      updatedAt: 0,
      ready: false,
      loading: false,
      error: '',
      notice: '',
      generation: 0,
      scopeGeneration: 0,
      listWrites: Promise.resolve(),
    };
  },
  computed: {
    scope() {
      return trackingScope(this.$store.state.data?.user?.userId);
    },
    selectedUser() {
      return this.users.find(user => user.id === this.selected) || {};
    },
    profile() {
      return this.payload?.profile || {};
    },
    profileStats() {
      const p = this.profile,
        d = this.payload || {};
      return [
        ['等级', d.level],
        ['累计听歌', d.listenSongs],
        ['村龄（天）', d.createDays],
        ['创建歌单', p.playlistCount],
        ['关注', p.follows],
        ['粉丝', p.followeds],
        ['动态', p.eventCount],
        [
          '公开生日',
          p.birthday > 0
            ? new Date(p.birthday).toLocaleDateString()
            : undefined,
        ],
        [
          '注册日期',
          p.createTime > 0
            ? new Date(p.createTime).toLocaleDateString()
            : undefined,
        ],
        ['公开性别', { 1: '男', 2: '女' }[p.gender]],
      ]
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([label, value]) => ({ label, value }));
    },
    items() {
      const d = this.payload || {};
      const list = {
        playlists: d.playlist,
        week: d.weekData,
        all: d.allData,
        events: d.events,
        follows: d.follow,
        followers: d.followeds,
        radios: d.djRadios,
      }[this.tab];
      return Array.isArray(list)
        ? list.filter(
            item => !['week', 'all'].includes(this.tab) || item.song?.id
          )
        : [];
    },
    hasMore() {
      return (
        ['playlists', 'events', 'follows', 'followers'].includes(this.tab) &&
        Boolean(this.payload?.more)
      );
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
  beforeDestroy() {
    this.generation++;
    this.scopeGeneration++;
  },
  methods: {
    async restore() {
      const epoch = ++this.scopeGeneration;
      this.generation++;
      this.users = [];
      this.selected = '';
      this.payload = null;
      this.ready = false;
      this.loading = false;
      this.notice = '';
      this.error = '';
      const users = await readTrackingList(this.scope);
      if (epoch !== this.scopeGeneration) return;
      this.users = users.filter(user => normalizeTrackingId(user.id));
      this.ready = true;
      if (this.users.length) this.selectUser(this.users[0].id);
    },
    persist() {
      const scope = this.scope,
        users = JSON.parse(JSON.stringify(this.users));
      this.listWrites = this.listWrites
        .catch(() => {})
        .then(() => saveTrackingList(scope, users))
        .catch(() => {
          if (scope === this.scope)
            this.notice = '无法保存列表，请检查设备存储空间';
        });
    },
    addUser(value) {
      if (!this.ready) return;
      const id = normalizeTrackingId(value || this.inputId);
      if (!id) {
        this.notice = '请输入有效的数字用户 ID';
        return;
      }
      if (this.users.some(user => user.id === id)) {
        this.notice = '该用户已在列表中';
        this.selectUser(id);
        return;
      }
      this.users.push({ id, name: '', avatar: '' });
      this.inputId = '';
      this.notice = '';
      this.persist();
      this.selectUser(id);
    },
    remove(id) {
      this.users = this.users.filter(user => user.id !== id);
      this.persist();
      deleteTrackingSnapshots(this.scope, id).catch(() => {});
      if (this.selected === id) {
        this.generation++;
        this.selected = '';
        this.payload = null;
        this.loading = false;
        if (this.users.length) this.selectUser(this.users[0].id);
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
    selectUser(id) {
      if (id === this.selected) return;
      this.selected = id;
      this.tab = 'profile';
      this.load();
    },
    changeTab(tab) {
      if (tab === this.tab) return;
      this.tab = tab;
      this.load();
    },
    async load(force = false, append = false) {
      if (!this.selected || (append && this.loading)) return;
      const epoch = ++this.generation,
        scope = this.scope,
        uid = this.selected,
        section = this.tab;
      const current = () => epoch === this.generation && scope === this.scope;
      const previous = append ? this.payload : null;
      this.loading = true;
      this.error = '';
      if (!append) {
        this.payload = null;
        this.updatedAt = 0;
      }
      try {
        if (!append) {
          const saved = await readTrackingSnapshot(scope, uid, section);
          if (!current()) return;
          if (saved) {
            this.payload = saved.data;
            this.updatedAt = saved.updatedAt;
          }
          // Re-entering a section reads its local snapshot; refresh is explicit.
          if (saved && !force) return;
        }
        const cursor = append
          ? section === 'events'
            ? { lasttime: previous.lasttime }
            : { offset: this.items.length }
          : {};
        const data = await readTrackingSection(uid, section, cursor);
        if (!current()) return;
        if (append) {
          const key = {
            playlists: 'playlist',
            events: 'events',
            follows: 'follow',
            followers: 'followeds',
          }[section];
          const seen = new Set();
          data[key] = [...(previous[key] || []), ...(data[key] || [])].filter(
            item => {
              const id = item.id || item.userId;
              if (seen.has(id)) return false;
              seen.add(id);
              return true;
            }
          );
        }
        this.payload = data;
        this.updatedAt = Date.now();
        if (section === 'profile') {
          const user = this.users.find(user => user.id === uid);
          if (user) {
            user.name = data.profile.nickname || '';
            user.avatar = data.profile.avatarUrl || '';
            this.persist();
          }
        }
        await saveTrackingSnapshot(scope, uid, section, data).catch(() => {
          if (current()) this.notice = '内容已加载，但离线副本保存失败';
        });
      } catch (error) {
        if (current()) this.error = error.message || '加载失败';
      } finally {
        if (current()) this.loading = false;
      }
    },
    date(value) {
      return value ? new Date(value).toLocaleString() : '未提供';
    },
    artists(song) {
      return (song.ar || song.artists || [])
        .map(artist => artist.name)
        .join(' / ');
    },
    eventData(item) {
      try {
        return typeof item.json === 'string'
          ? JSON.parse(item.json)
          : item.json || {};
      } catch (_) {
        return {};
      }
    },
    play(id) {
      this.$store.state.player.addTrackToPlayNext(id, true);
    },
  },
};
</script>

<style lang="scss" scoped>
.tracking-page {
  color: var(--color-text);
  padding-bottom: 32px;
}
header {
  margin: 28px 0;
  h1 {
    margin-bottom: 10px;
  }
  p {
    opacity: 0.65;
    line-height: 1.6;
  }
}
button,
input {
  color: var(--color-text);
  font: inherit;
  border-radius: 8px;
  background: var(--color-secondary-bg);
  padding: 10px 14px;
}
button {
  transition: background 0.2s, opacity 0.2s;
  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary);
  }
}
input {
  border: 1px solid transparent;
  min-width: 0;
  &:focus {
    border-color: var(--color-primary);
  }
}
.add-user {
  display: flex;
  gap: 10px;
  margin-bottom: 24px;
  input {
    flex: 1;
    max-width: 420px;
  }
}
.tracking-layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 32px;
}
aside {
  min-width: 0;
}
.person {
  padding: 10px;
  border-radius: 12px;
  margin-bottom: 8px;
  background: var(--color-secondary-bg);
  &.selected {
    box-shadow: inset 0 0 0 1px var(--color-primary);
  }
}
.person-name {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 10px;
  text-align: left;
  padding: 4px;
  overflow: hidden;
  span {
    overflow-wrap: anywhere;
  }
  img {
    width: 38px;
    height: 38px;
    border-radius: 50%;
  }
}
small {
  display: block;
  opacity: 0.65;
  margin-top: 5px;
  font-size: 12px;
}
.person-actions {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  button {
    padding: 6px 8px;
    font-size: 12px;
  }
}
.detail {
  min-width: 0;
}
.detail-heading {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 18px;
  a {
    color: var(--color-primary);
    font-size: 14px;
  }
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  .active {
    color: var(--color-primary);
    background: var(--color-primary-bg);
  }
}
.status-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  opacity: 0.7;
  margin: 18px 0;
}
.muted {
  opacity: 0.65;
  line-height: 1.7;
  margin: 16px 0;
}
.profile-card {
  display: flex;
  align-items: center;
  gap: 20px;
  margin: 22px 0;
  img {
    width: 90px;
    height: 90px;
    border-radius: 18px;
  }
  p {
    margin-top: 10px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.6;
  }
}
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 12px;
  div {
    padding: 16px;
    background: var(--color-secondary-bg);
    border-radius: 10px;
  }
  dt {
    font-size: 12px;
    opacity: 0.65;
  }
  dd {
    margin: 10px 0 0;
    font-size: 21px;
    font-weight: 700;
  }
}
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 22px;
}
.playlist-card {
  min-width: 0;
  img {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 10px;
  }
  strong {
    display: block;
    margin-top: 8px;
  }
  p {
    font-size: 12px;
    opacity: 0.6;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
}
.record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
  > small {
    white-space: nowrap;
  }
  button {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    text-align: left;
    img {
      width: 42px;
      height: 42px;
      border-radius: 6px;
    }
    span {
      overflow: hidden;
    }
    strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
.event {
  margin: 16px 0;
  padding: 18px;
  background: var(--color-secondary-bg);
  border-radius: 12px;
  p {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.7;
    margin: 12px 0;
  }
  a {
    color: var(--color-primary);
    display: block;
    margin: 10px 0;
  }
}
.event-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  img {
    width: 110px;
    height: 110px;
    object-fit: cover;
    border-radius: 8px;
  }
}
.social-person {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  img {
    width: 42px;
    height: 42px;
    border-radius: 50%;
  }
  div {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  p {
    font-size: 13px;
    opacity: 0.65;
    margin-top: 8px;
  }
  button {
    font-size: 12px;
  }
}
.load-more {
  display: block;
  margin: 24px auto;
}
@media (max-width: 850px) {
  .tracking-layout {
    grid-template-columns: 1fr;
    gap: 24px;
  }
  aside {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }
  .person {
    margin-bottom: 0;
  }
}
</style>
