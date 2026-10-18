<template>
  <section class="tracking-section" :aria-label="title">
    <slot
      :items="items"
      :tracks="tracks"
      :payload="payload"
      :loading="loading"
      :error="error"
      :more="hasMore"
      :load="load"
    >
      <p v-if="error" role="status" class="muted">{{ error }}</p>
      <div v-if="payload" v-page-reveal>
        <template v-if="tab === 'profile'">
          <div
            v-if="profile.avatarUrl || backgroundSource"
            class="profile-photos"
          >
            <button
              v-if="backgroundSource"
              class="profile-background avatar-fallback"
              aria-label="查看背景照片"
              @click="viewPhotos([backgroundSource], 0)"
              ><img
                v-image-fade
                :src="backgroundSource | resizeImage(1024)"
                alt=""
                loading="lazy"
            /></button>
            <button
              v-if="profile.avatarUrl"
              class="profile-portrait"
              aria-label="查看头像照片"
              @click="viewPhotos([profile.avatarUrl], 0)"
              ><img
                v-image-fade
                :src="profile.avatarUrl | resizeImage(224)"
                alt="头像"
            /></button>
          </div>
          <div class="profile-identity"
            ><strong>{{ profile.nickname }}</strong
            ><span>ID {{ profile.userId || uid }}</span></div
          >
          <div v-if="profileTags.length" class="profile-tags"
            ><span v-for="tag in profileTags" :key="tag">{{ tag }}</span></div
          >
          <div class="profile-card">
            <p v-if="profile.signature">{{ profile.signature }}</p>
            <p v-if="profile.description">{{ profile.description }}</p>
            <p
              v-if="
                profile.detailDescription &&
                profile.detailDescription !== profile.description
              "
              >{{ profile.detailDescription }}</p
            >
          </div>
          <dl class="stats"
            ><div v-for="stat in profileStats" :key="stat.label"
              ><dt>{{ stat.label }}</dt
              ><dd>{{ stat.value }}</dd></div
            ></dl
          >
          <router-link
            v-if="profile.artistId"
            class="artist-link"
            :to="'/artist/' + profile.artistId"
            >查看歌手主页</router-link
          >
          <small v-if="updatedAt" class="snapshot-date"
            >保存于 {{ date(updatedAt) }}</small
          >
        </template>
        <template v-else-if="tab === 'playlists'">
          <CoverRow type="playlist" :items="items" :show-play-count="true" />
        </template>
        <template v-else-if="tab === 'follows' || tab === 'fans'">
          <CoverRow
            type="user"
            :items="displayPeople"
            :column-number="6"
            @open-user="$emit('open-user', $event)"
          />
        </template>
        <template v-else-if="tab === 'week' || tab === 'all'">
          <TrackList
            :tracks="tracks"
            :column-number="1"
            type="tracklist"
            dbclick-track-func="playAList"
          />
        </template>
        <template v-else-if="tab === 'events'">
          <article
            v-for="item in items"
            :key="item.id"
            class="event"
            :class="{ 'event-unavailable': item.archiveStatus }"
          >
            <div class="event-meta"
              ><time>{{ date(item.eventTime || item.showTime) }}</time
              ><span v-if="item.archiveStatus" class="deleted-badge"
                >已删除或不可见</span
              ><span v-if="item.topEvent || item.top">置顶</span></div
            >
            <p>{{ eventData(item).msg || item.message || '分享了一条动态' }}</p>
            <template v-for="resource in eventResources(item)">
              <button
                v-if="resource.kind === 'song'"
                :key="resource.key"
                class="event-resource"
                @click="play(resource.id)"
              >
                <img
                  v-if="resource.cover"
                  v-image-fade
                  :src="resource.cover | resizeImage(224)"
                  loading="lazy"
                  alt=""
                /><span
                  ><strong>{{ resource.name }}</strong
                  ><small>{{ resource.subtitle || '歌曲' }}</small></span
                ><span class="resource-action">播放</span>
              </button>
              <a
                v-else-if="resource.kind === 'video'"
                :key="resource.key"
                class="event-resource"
                :href="
                  'https://music.163.com/#/video?id=' +
                  encodeURIComponent(resource.id)
                "
                target="_blank"
                rel="noopener noreferrer"
                ><img
                  v-if="resource.cover"
                  v-image-fade
                  :src="resource.cover | resizeImage(224)"
                  loading="lazy"
                  alt=""
                /><span
                  ><strong>{{ resource.name }}</strong
                  ><small>视频 · 在网易云打开</small></span
                ></a
              >
              <router-link
                v-else
                :key="resource.key"
                class="event-resource"
                :to="resource.path"
                ><img
                  v-if="resource.cover"
                  v-image-fade
                  :src="resource.cover | resizeImage(224)"
                  loading="lazy"
                  alt=""
                /><span
                  ><strong>{{ resource.name }}</strong
                  ><small>{{ resource.subtitle }}</small></span
                ></router-link
              >
            </template>
            <div v-if="eventData(item).event" class="forwarded-event"
              ><strong>{{
                (eventData(item).event.user || {}).nickname || '转发动态'
              }}</strong
              ><p>{{ eventData(eventData(item).event).msg }}</p
              ><div class="event-images"
                ><button
                  v-for="(pic, index) in eventData(item).event.pics || []"
                  :key="index"
                  :aria-label="'查看转发图片 ' + (index + 1)"
                  @click="viewPhotos(eventData(item).event.pics, index)"
                  ><img
                    v-image-fade
                    :src="(pic.originUrl || pic.squareUrl) | resizeImage(224)"
                    loading="lazy"
                    alt="转发图片" /></button></div
            ></div>
            <div class="event-images"
              ><button
                v-for="(pic, index) in item.pics || []"
                :key="index"
                :aria-label="'查看图片 ' + (index + 1)"
                @click="viewPhotos(item.pics, index)"
                ><img
                  v-image-fade
                  :src="(pic.originUrl || pic.squareUrl) | resizeImage(224)"
                  loading="lazy"
                  alt="动态图片" /></button
            ></div>
            <div class="event-footer"
              ><span v-if="item.rcmdInfo && item.rcmdInfo.reason">{{
                item.rcmdInfo.reason
              }}</span
              ><span
                >赞 {{ (item.info || {}).likedCount || 0 }} · 评论
                {{ (item.info || {}).commentCount || 0 }} · 转发
                {{ (item.info || {}).shareCount || 0 }}</span
              ></div
            >
          </article>
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
    </slot>
  </section>
</template>
<script>
import { retainTracks } from '@/utils/retainedTracks';
import { retainCollection, entryId } from '@/utils/retainedCollections';
import { cacheTrackDetail } from '@/utils/db';
import { archiveMode, archiveError } from '@/utils/archiveMode';
import { openPhotos, closePhotos } from '@/utils/photoLightbox';
import { eventData, mergeTrackingEvents } from '@/utils/trackingEvents';
import { mapTrackPlayableStatus } from '@/utils/common';
import { observeTrackingArtwork } from '@/utils/trackingArtwork';
import CoverRow from '@/components/CoverRow.vue';
import TrackList from '@/components/TrackList.vue';
import { readTrackingSection } from '@/api/tracking';
import {
  readTrackingSnapshot,
  saveTrackingSnapshot,
} from '@/utils/trackingStore';
export default {
  name: 'TrackingSection',
  components: { CoverRow, TrackList },
  props: {
    uid: { type: String, required: true },
    scope: { type: String, required: true },
    section: { type: String, required: true },
    title: { type: String, required: true },
    playlistId: { type: Number, default: 0 },
    cacheEnabled: { type: Boolean, default: false },
    extraArtists: { type: Array, default: () => [] },
    refreshOnOpen: { type: Boolean, default: false },
    maxAge: { type: Number, default: Infinity },
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
    displayPeople() {
      if (this.tab !== 'follows') return this.items;
      const users = this.items;
      const extra = (this.extraArtists || [])
        .filter(
          artist =>
            !users.some(
              user =>
                (artist.accountId > 0 &&
                  String(user.userId) === String(artist.accountId)) ||
                (user.artistId > 0 &&
                  String(user.artistId) === String(artist.id))
            )
        )
        .map(artist => ({
          userId: 'artist-' + artist.id,
          nickname: artist.name,
          avatarUrl: artist.picUrl || artist.img1v1Url,
          _artistId: artist.id,
          archiveStatus: artist.archiveStatus,
        }));
      return [...users, ...extra];
    },
    tracks() {
      const tracks = this.items.map(item => {
        const song = { ...(item.song || item) };
        delete song.playCount;
        return {
          ...song,
          al: song.al || song.album || {},
          ar: song.ar || song.artists || [],
          dt: song.dt || song.duration || 0,
        };
      });
      return mapTrackPlayableStatus(tracks, this.payload?.privileges || []);
    },
    tab() {
      return this.section;
    },
    selected() {
      return this.uid;
    },
    identity() {
      return JSON.stringify([
        this.scope,
        this.uid,
        this.section,
        this.playlistId,
        this.cacheEnabled,
      ]);
    },
    profile() {
      return this.payload?.profile || {};
    },
    backgroundSource() {
      return this.profile.avatarUrl;
    },
    profileTags() {
      const tags = [
        ...(this.profile.expertTags || []),
        ...(this.profile.allAuthTypes || []).map(
          item => item.desc || item.name
        ),
      ];
      const identity = this.payload?.identify?.imageDesc;
      if (identity) tags.unshift(identity);
      return [
        ...new Set(tags.filter(value => typeof value === 'string' && value)),
      ];
    },
    profileStats() {
      const p = this.profile,
        d = this.payload || {};
      return [
        ['等级', d.level],
        ['累计听歌', d.listenSongs],
        ['村龄（天）', d.createDays],
        ['歌单', p.playlistCount],
        ['收藏', p.playlistBeSubscribedCount],
        [
          '听歌排行',
          d.peopleCanSeeMyPlayRecord === false ? '不公开' : undefined,
        ],
        ['动态', p.eventCount],
        ['关注', p.follows],
        ['粉丝', p.followeds],
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
        likes: d.playlist?.tracks?.slice(0, 12),
        follows: d.follow,
        fans: d.followeds,
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
        ['playlists', 'events', 'follows', 'fans'].includes(this.tab) &&
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
  activated() {
    if (
      (this.refreshOnOpen || Date.now() - this.updatedAt > this.maxAge) &&
      this.updatedAt &&
      !this.loading
    )
      this.load(true);
  },
  beforeDestroy() {
    closePhotos();
    this.generation++;
  },
  methods: {
    async load(force = false, append = false) {
      if (
        !this.uid ||
        (this.tab === 'likes' && !this.playlistId) ||
        ((append || force) && this.loading)
      )
        return;
      const epoch = ++this.generation,
        scope = this.scope,
        uid = this.uid,
        section = this.tab,
        snapshotKey =
          section === 'likes' ? `likes:${this.playlistId}` : section;
      const current = () => epoch === this.generation && scope === this.scope;
      let previous = append || force ? this.payload : null;
      this.loading = true;
      this.error = '';
      if (!append) {
        if (!force) {
          this.payload = null;
          this.updatedAt = 0;
        }
      }
      try {
        if (!append) {
          const saved = this.cacheEnabled
            ? await readTrackingSnapshot(scope, uid, snapshotKey)
            : null;
          if (!current()) return;
          if (saved) {
            previous = saved.data;
            this.payload = saved.data;
            this.updatedAt = saved.updatedAt;
            observeTrackingArtwork(scope, uid, section, saved.data);
          }
          // Render the saved snapshot immediately, then apply the page refresh policy.
          if (
            saved &&
            !force &&
            !this.refreshOnOpen &&
            Date.now() - saved.updatedAt < this.maxAge
          ) {
            if (section === 'profile')
              this.$emit('profile', { uid, profile: saved.data.profile });
            return;
          }
        }
        if (archiveMode()) {
          if (!this.payload) this.error = archiveError().message;
          return;
        }
        const cursor = append
          ? section === 'events'
            ? { lasttime: previous.lasttime }
            : { offset: previous?.__liveCount ?? this.items.length }
          : {};
        const data = await readTrackingSection(
          uid,
          section,
          section === 'likes' ? { id: this.playlistId, s: 0 } : cursor
        );
        if (!current() || archiveMode()) return;
        const collectionKey = {
          playlists: 'playlist',
          follows: 'follow',
          fans: 'followeds',
        }[section];
        if (collectionKey) {
          const page = data[collectionKey] || [];
          data.__liveCount =
            (append ? previous?.__liveCount || 0 : 0) + page.length;
          data.__liveIds = [
            ...new Set([
              ...(append ? previous?.__liveIds || [] : []),
              ...page.map(entryId),
            ]),
          ];
        }
        if (section === 'events' && this.cacheEnabled) {
          Object.assign(data, mergeTrackingEvents(previous, data, cursor));
        } else if (append) {
          const key = {
            playlists: 'playlist',
            events: 'events',
            follows: 'follow',
            fans: 'followeds',
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
        if (this.cacheEnabled && collectionKey) {
          const live = new Set(data.__liveIds);
          const fresh = (data[collectionKey] || []).filter(item =>
            live.has(entryId(item))
          );
          data[collectionKey] = retainCollection(
            fresh,
            previous?.[collectionKey] || [],
            !data.more
          );
        }
        if (this.cacheEnabled && section === 'likes') {
          data.playlist.tracks = await retainTracks(
            mapTrackPlayableStatus(
              data.playlist.tracks || [],
              data.privileges || []
            ),
            previous?.playlist?.tracks || [],
            data.playlist.trackIds || null
          );
        } else if (this.cacheEnabled && ['week', 'all'].includes(section)) {
          const key = section === 'week' ? 'weekData' : 'allData';
          const rows = new Map(
            [...(previous?.[key] || []), ...(data[key] || [])].map(row => [
              String(row.song.id),
              row,
            ])
          );
          const songs = await retainTracks(
            mapTrackPlayableStatus(
              (data[key] || []).map(row => row.song),
              data.privileges || []
            ),
            (previous?.[key] || []).map(row => row.song),
            null,
            'not-listed'
          );
          data[key] = songs.map(song => ({
            ...rows.get(String(song.id)),
            song,
          }));
        }
        if (!current() || archiveMode()) return;
        this.payload = data;
        this.updatedAt = Date.now();
        if (section === 'profile')
          this.$emit('profile', { uid, profile: data.profile });
        if (this.cacheEnabled) {
          observeTrackingArtwork(scope, uid, section, data);
          if (['likes', 'week', 'all'].includes(section)) {
            for (const track of this.tracks)
              cacheTrackDetail(
                track,
                (data.privileges || []).find(item => item.id === track.id)
              );
          }
          await saveTrackingSnapshot(scope, uid, snapshotKey, data).catch(
            () => {
              if (current()) this.$emit('notice', '离线副本保存失败');
            }
          );
        }
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
    eventData,
    viewPhotos: openPhotos,
    eventResources(item) {
      const data = eventData(item),
        output = [];
      for (const kind of ['song', 'playlist', 'album', 'mv', 'video']) {
        const value = data[kind];
        if (!value || !(value.id || value.vid)) continue;
        const id = value.id || value.vid;
        const album = value.al || value.album || {};
        output.push({
          kind,
          id,
          key: kind + ':' + id,
          name: value.name || value.title || '分享内容',
          cover:
            value.coverImgUrl ||
            value.picUrl ||
            value.coverUrl ||
            value.imgurl ||
            album.picUrl,
          subtitle:
            kind === 'song'
              ? this.artists(value)
              : { playlist: '歌单', album: '专辑', mv: 'MV', video: '视频' }[
                  kind
                ],
          path: '/' + kind + '/' + id,
        });
      }
      return output;
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

<style lang="scss" scoped>
.profile-card {
  display: block;
  margin: 12px 0 20px;
  padding: 20px 24px;
  color: var(--color-primary);
  background: var(--color-primary-bg);
  border-radius: 16px;
  p {
    margin: 0 0 8px;
  }
  p:last-child {
    margin-bottom: 0;
  }
  &:empty {
    display: none;
  }
}
.stats {
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  div {
    background: var(--color-secondary-bg);
    border-radius: 10px;
    padding: 16px;
  }
  dd {
    font-size: 24px;
  }
}
</style>

<style lang="scss" scoped>
.section-heading {
  justify-content: flex-end;
  margin-bottom: 10px;
}
</style>

<style lang="scss" scoped>
.stats {
  grid-template-columns: repeat(6, minmax(0, 1fr));
  div,
  dt,
  dd {
    min-width: 0;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  dd {
    font-size: 21px;
    line-height: 1.35;
  }
}
@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<style lang="scss" scoped>
.profile-photos {
  position: relative;
  margin-bottom: 20px;
  padding-bottom: 16px;
}
.profile-background {
  display: block;
  width: 100%;
  padding: 0;
  overflow: hidden;
  border-radius: 14px;
  img {
    display: block;
    width: 100%;
    height: 150px;
    object-fit: cover;
  }
}
.profile-portrait {
  position: relative;
  display: block;
  width: 72px;
  height: 72px;
  padding: 0;
  margin: -35px 0 0 16px;
  border: 4px solid var(--color-body-bg, #fff);
  border-radius: 50%;
  overflow: hidden;
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
.profile-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  strong {
    font-size: 22px;
    overflow-wrap: anywhere;
  }
  span {
    font-size: 12px;
    opacity: 0.5;
  }
}
.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
  span {
    padding: 5px 8px;
    background: var(--color-secondary-bg);
    border-radius: 6px;
    font-size: 12px;
    overflow-wrap: anywhere;
  }
}
.profile-card {
  padding: 16px;
}
.stats {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  dd {
    font-size: 18px;
  }
  div {
    padding: 14px;
  }
}
.artist-link {
  display: inline-block;
  color: var(--color-primary);
  margin-top: 18px;
}
.snapshot-date {
  margin-top: 18px;
}
.event {
  margin-top: 0;
  margin-bottom: 18px;
  padding: 22px;
}
.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  color: var(--color-text);
  time {
    opacity: 0.55;
  }
}
.deleted-badge {
  padding: 4px 7px;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 5px;
}
.event-unavailable {
  border: 1px dashed rgba(128, 128, 128, 0.35);
}
.event-resource {
  display: flex !important;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px;
  text-align: left;
  box-sizing: border-box;
  border-radius: 10px;
  background: rgba(128, 128, 128, 0.08);
  color: var(--color-text) !important;
  img {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 7px;
    flex-shrink: 0;
  }
  > span {
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 14px;
    overflow-wrap: anywhere;
  }
  .resource-action {
    margin-left: auto;
    font-size: 12px;
    opacity: 0.55;
    flex-shrink: 0;
  }
}
.forwarded-event {
  padding: 14px;
  margin: 12px 0;
  border-left: 2px solid rgba(128, 128, 128, 0.3);
  strong {
    font-size: 13px;
  }
}
.event-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
  button {
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
    background: none;
  }
  img {
    display: block;
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    object-fit: cover;
    cursor: zoom-in;
  }
}
.event-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  opacity: 0.55;
  margin-top: 14px;
  line-height: 1.6;
}
@media (max-width: 600px) {
  .event {
    padding: 16px;
  }
}
</style>

<style lang="scss" scoped>
.profile-background.avatar-fallback {
  overflow: hidden;
  img {
    filter: blur(9px);
    transform: scale(1.18);
    opacity: 0.72;
  }
}
</style>
