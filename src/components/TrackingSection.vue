<template>
  <section class="tracking-section">
    <div class="section-heading"
      ><h2>{{ title }}</h2
      ><button :disabled="loading" @click="load(true)">{{
        loading ? '加载中…' : '刷新'
      }}</button></div
    >
    <p v-if="error" role="status" class="muted">{{ error }}</p>
    <div v-if="payload" v-page-reveal>
      <template v-if="tab === 'profile'">
        <div class="profile-card"
          ><img
            v-if="profile.avatarUrl"
            v-image-fade
            :src="profile.avatarUrl | resizeImage(224)"
            alt="用户头像"
          /><div
            ><h2>{{ profile.nickname }}</h2
            ><p class="signature">{{ profile.signature || '暂无公开签名' }}</p
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
            ><p v-if="item.description">{{ item.description }}</p></router-link
          ></div
        >
      </template>
      <template v-else-if="tab === 'week' || tab === 'all'">
        <div v-for="(item, index) in items" :key="item.song.id" class="record"
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
          ></div
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
      <p v-if="tab !== 'profile' && !items.length" class="muted">暂无内容</p>
      <button
        v-if="hasMore"
        :disabled="loading"
        class="load-more"
        @click="load(false, true)"
        >加载更多</button
      >
    </div>
  </section>
</template>
<script>
import { readTrackingSection } from '@/api/tracking';
import {
  readTrackingSnapshot,
  saveTrackingSnapshot,
} from '@/utils/trackingStore';
export default {
  name: 'TrackingSection',
  props: {
    uid: { type: String, required: true },
    scope: { type: String, required: true },
    section: { type: String, required: true },
    title: { type: String, required: true },
  },
  data() {
    return {
      payload: null,
      updatedAt: 0,
      loading: false,
      error: '',
      generation: 0,
    };
  },
  computed: {
    tab() {
      return this.section;
    },
    selected() {
      return this.uid;
    },
    identity() {
      return JSON.stringify([this.scope, this.uid, this.section]);
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
        ['动态', p.eventCount],
        [
          '生日',
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
        ['性别', { 1: '男', 2: '女' }[p.gender]],
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
      }[this.tab];
      return Array.isArray(list)
        ? list.filter(
            item => !['week', 'all'].includes(this.tab) || item.song?.id
          )
        : [];
    },
    hasMore() {
      return (
        ['playlists', 'events'].includes(this.tab) &&
        Boolean(this.payload?.more)
      );
    },
  },

  watch: {
    identity: {
      immediate: true,
      handler() {
        this.load();
      },
    },
  },
  beforeDestroy() {
    this.generation++;
  },
  methods: {
    async load(force = false, append = false) {
      if (!this.uid || (append && this.loading)) return;
      const epoch = ++this.generation,
        scope = this.scope,
        uid = this.uid,
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
        if (section === 'profile')
          this.$emit('profile', { uid, profile: data.profile });
        await saveTrackingSnapshot(scope, uid, section, data).catch(() => {
          if (current()) this.$emit('notice', '离线副本保存失败');
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
.tracking-section {
  margin: 24px 0 36px;
  min-width: 0;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  h2 {
    font-size: 21px;
  }
}
button {
  color: var(--color-text);
  background: var(--color-secondary-bg);
  border-radius: 8px;
  padding: 10px 14px;
  font: inherit;
  &:disabled {
    opacity: 0.35;
  }
  &:focus-visible {
    outline: 2px solid var(--color-primary);
  }
}
.muted {
  opacity: 0.6;
  margin: 12px 0;
}
small {
  display: block;
  opacity: 0.65;
  margin-top: 5px;
  font-size: 12px;
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
.load-more {
  display: block;
  margin: 24px auto;
}
</style>
