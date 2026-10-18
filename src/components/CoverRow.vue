<template>
  <div class="cover-row" :class="{ compact }" :style="rowStyles">
    <div
      v-for="item in items"
      :key="item.id || item.userId"
      class="item"
      :class="{ artist: type === 'artist' || type === 'user' }"
    >
      <a
        v-if="type === 'user'"
        class="user-cover"
        :href="userLink(item)"
        @click.prevent="$emit('open-user', item)"
      >
        <img
          v-image-fade
          :src="item.avatarUrl | resizeImage(512)"
          loading="lazy"
          :alt="item.nickname"
        />
      </a>
      <Cover
        v-else
        :id="item.id"
        :fixed-size="compact ? 64 : 0"
        :radius="compact ? 8 : 12"
        :image-url="getImageUrl(item)"
        :type="type"
        :play-button-size="type === 'artist' ? 26 : playButtonSize"
      />
      <div class="text">
        <div
          v-if="
            showPlayCount &&
            playCount(item) != null &&
            $store.state.settings.showPlayCounts !== false
          "
          class="info"
        >
          <span class="play-count"
            ><svg-icon icon-class="play" />{{
              playCount(item) | formatPlayCount
            }}
          </span>
        </div>
        <div class="title" :style="{ fontSize: subTextFontSize }">
          <span v-if="isExplicit(item)" class="explicit-symbol"
            ><ExplicitSymbol
          /></span>
          <span v-if="isPrivacy(item)" class="lock-icon">
            <svg-icon icon-class="lock"
          /></span>
          <a
            v-if="type === 'user'"
            :href="userLink(item)"
            @click.prevent="$emit('open-user', item)"
            >{{ item.nickname }}</a
          >
          <router-link v-else :to="getTitleLink(item)">{{
            item.name
          }}</router-link>
        </div>
        <div v-if="compact" class="info"
          >{{
            (item.trackCount ?? item.size ?? item.songCount) != null
              ? (item.trackCount ?? item.size ?? item.songCount) + ' 首'
              : ''
          }}<span v-if="item.creator && item.creator.nickname">
            · {{ item.creator.nickname }}</span
          ></div
        >
        <div
          v-if="
            !compact && !['artist', 'user'].includes(type) && subText !== 'none'
          "
          class="info"
        >
          <span v-html="getSubText(item)"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Cover from '@/components/Cover.vue';
import ExplicitSymbol from '@/components/ExplicitSymbol.vue';

export default {
  name: 'CoverRow',
  components: {
    Cover,
    ExplicitSymbol,
  },
  props: {
    items: { type: Array, required: true },
    compact: { type: Boolean, default: false },
    type: { type: String, required: true },
    subText: { type: String, default: 'none' },
    subTextFontSize: { type: String, default: '16px' },
    showPlayCount: { type: Boolean, default: false },
    columnNumber: { type: Number, default: 5 },
    gap: { type: String, default: '44px 24px' },
    playButtonSize: { type: Number, default: 22 },
  },
  computed: {
    rowStyles() {
      if (this.compact)
        return {
          'grid-template-columns': 'repeat(3, minmax(0, 1fr))',
          gap: '14px 22px',
        };
      return {
        'grid-template-columns': `repeat(${this.columnNumber}, 1fr)`,
        gap: this.gap,
      };
    },
  },
  methods: {
    userLink(item) {
      if (item._artistId) return `/artist/${item._artistId}`;
      return `https://music.163.com/#/user/home?id=${encodeURIComponent(
        item.userId
      )}`;
    },
    playCount(item) {
      return item.playCount ?? item.playcount;
    },
    getSubText(item) {
      if (this.subText === 'copywriter') return item.copywriter;
      if (this.subText === 'description') return item.description;
      if (this.subText === 'updateFrequency') return item.updateFrequency;
      if (this.subText === 'creator') return 'by ' + item.creator.nickname;
      if (this.subText === 'releaseYear')
        return new Date(item.publishTime).getFullYear();
      if (this.subText === 'artist') {
        if (item.artist !== undefined)
          return `<a href="/artist/${item.artist.id}">${item.artist.name}</a>`;
        if (item.artists !== undefined)
          return `<a href="/artist/${item.artists[0].id}">${item.artists[0].name}</a>`;
      }
      if (this.subText === 'albumType+releaseYear') {
        let albumType = item.type;
        if (item.type === 'EP/Single') {
          albumType = item.size === 1 ? 'Single' : 'EP';
        } else if (item.type === 'Single') {
          albumType = 'Single';
        } else if (item.type === '专辑') {
          albumType = 'Album';
        }
        return `${albumType} · ${new Date(item.publishTime).getFullYear()}`;
      }
      if (this.subText === 'appleMusic') return 'by Apple Music';
    },
    isPrivacy(item) {
      return this.type === 'playlist' && item.privacy === 10;
    },
    isExplicit(item) {
      return this.type === 'album' && (item.mark & 1048576) === 1048576;
    },
    getTitleLink(item) {
      return `/${this.type}/${item.id}`;
    },
    getImageUrl(item) {
      if (item.img1v1Url) {
        let img1v1ID = item.img1v1Url.split('/');
        img1v1ID = img1v1ID[img1v1ID.length - 1];
        if (img1v1ID === '5639395138885805.jpg') {
          // 没有头像的歌手，网易云返回的img1v1Url并不是正方形的 😅😅😅
          return 'https://p2.music.126.net/VnZiScyynLG7atLIZ2YPkw==/18686200114669622.jpg?param=512y512';
        }
      }
      let img = item.img1v1Url || item.picUrl || item.coverImgUrl;
      return `${img?.replace('http://', 'https://')}?param=512y512`;
    },
  },
};
</script>

<style lang="scss" scoped>
.user-cover {
  display: block;
  img {
    display: block;
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 50%;
  }
}
.cover-row {
  display: grid;
}

.item {
  color: var(--color-text);
  .text {
    margin-top: 8px;
    .title {
      font-size: 16px;
      font-weight: 600;
      line-height: 20px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      word-break: break-all;
    }
    .info {
      font-size: 12px;
      opacity: 0.68;
      line-height: 18px;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      word-break: break-word;
    }
  }
}

.item.artist {
  display: flex;
  flex-direction: column;
  text-align: center;
  .cover {
    display: flex;
  }
  .title {
    margin-top: 4px;
  }
}

@media (max-width: 834px) {
  .item .text .title {
    font-size: 14px;
  }
}

.explicit-symbol {
  opacity: 0.28;
  color: var(--color-text);
  float: right;
  .svg-icon {
    margin-bottom: -3px;
  }
}

.lock-icon {
  opacity: 0.28;
  color: var(--color-text);
  margin-right: 4px;
  // float: right;
  .svg-icon {
    height: 12px;
    width: 12px;
  }
}

.play-count {
  font-weight: 600;
  opacity: 0.58;
  color: var(--color-text);
  font-size: 12px;
  .svg-icon {
    margin-right: 3px;
    height: 8px;
    width: 8px;
  }
}
</style>

<style lang="scss" scoped>
.cover-row.compact {
  gap: 22px 28px !important;
  .item {
    display: flex;
    align-items: center;
    gap: 13px;
    min-width: 0;
    padding: 0;
    background: transparent;
  }
  .cover {
    flex: 0 0 64px;
    width: 64px;
    min-width: 64px;
  }
  .text {
    min-width: 0;
    margin-top: 0;
    flex: 1;
  }
  .text .title {
    font-size: 15px;
    line-height: 1.5;
    word-break: break-word;
  }
  .info {
    margin-top: 3px;
  }
}
@media (max-width: 1000px) {
  .cover-row.compact {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}
@media (max-width: 600px) {
  .cover-row.compact {
    grid-template-columns: minmax(0, 1fr) !important;
    gap: 18px !important;
  }
}
</style>
