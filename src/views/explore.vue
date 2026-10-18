<template>
  <div class="explore-page">
    <div class="explore-header"
      ><h1>{{ $t('explore.explore') }}</h1
      ><ExploreSearch
    /></div>
    <div v-if="activeCategory === '全部'" class="for-you-row">
      <DailyTracksCard /><FMCard />
    </div>
    <div class="buttons">
      <div
        v-for="category in settings.enabledPlaylistCategories"
        :key="category"
        class="button"
        :class="{ active: category === activeCategory && !showCatOptions }"
        @click="goToCategory(category)"
      >
        {{ category }}
      </div>
      <div
        class="button more"
        :class="{ active: showCatOptions }"
        @click="showCatOptions = !showCatOptions"
      >
        <svg-icon icon-class="more"></svg-icon>
      </div>
    </div>

    <div v-show="showCatOptions" class="panel">
      <div v-for="bigCat in allBigCats" :key="bigCat" class="big-cat">
        <div class="name">{{ bigCat }}</div>
        <div class="cats">
          <div
            v-for="cat in getCatsByBigCat(bigCat)"
            :key="cat.name"
            class="cat"
            :class="{
              active: settings.enabledPlaylistCategories.includes(cat.name),
            }"
            @click="toggleCat(cat.name)"
            ><span>{{ cat.name }}</span></div
          >
        </div>
      </div>
    </div>

    <p v-if="error" class="explore-error" role="status"
      >{{ error }} <button @click="loadData(true)">重试</button></p
    >
    <div class="playlists">
      <CoverRow
        type="playlist"
        :items="playlists"
        :sub-text="subText"
        :show-play-button="true"
        :show-play-count="activeCategory !== '排行榜' ? true : false"
        :image-size="activeCategory !== '排行榜' ? 512 : 1024"
      />
    </div>
    <div
      v-show="['推荐歌单', '排行榜'].includes(activeCategory) === false"
      class="load-more"
    >
      <ButtonTwoTone
        v-show="showLoadMoreButton && hasMore"
        color="grey"
        :loading="loadingMore"
        @click.native="getPlaylist()"
        >{{ $t('explore.loadMore') }}</ButtonTwoTone
      >
    </div>
  </div>
</template>

<script>
import { homeContentFresh } from '@/utils/homeFreshness';
import { trackingScope } from '@/utils/trackingStore';
import { mapState, mapMutations } from 'vuex';
import NProgress from 'nprogress';
import { topPlaylist, highQualityPlaylist, toplists } from '@/api/playlist';
import { playlistCategories } from '@/utils/staticData';
import { getRecommendPlayList } from '@/utils/playList';

import ButtonTwoTone from '@/components/ButtonTwoTone.vue';
import CoverRow from '@/components/CoverRow.vue';
import SvgIcon from '@/components/SvgIcon.vue';
import ExploreSearch from '@/components/ExploreSearch.vue';
import DailyTracksCard from '@/components/DailyTracksCard.vue';
import FMCard from '@/components/FMCard.vue';

export default {
  name: 'Explore',
  components: {
    ExploreSearch,
    DailyTracksCard,
    FMCard,
    CoverRow,
    ButtonTwoTone,
    SvgIcon,
  },
  data() {
    return {
      show: false,
      active: false,
      updatedAt: 0,
      offset: 0,
      generation: 0,
      loadingPromise: null,
      error: '',
      playlists: [],
      activeCategory: this.$route.query.category || '全部',
      loadingMore: false,
      showLoadMoreButton: false,
      hasMore: true,
      allBigCats: ['语种', '风格', '场景', '情感', '主题'],
      showCatOptions: false,
    };
  },
  computed: {
    ...mapState(['settings']),
    accountScope() {
      return trackingScope(this.$store.state.data?.user?.userId);
    },
    subText() {
      if (this.activeCategory === '排行榜') return 'updateFrequency';
      if (this.activeCategory === '推荐歌单') return 'copywriter';
      return 'none';
    },
  },
  watch: {
    accountScope() {
      this.generation++;
      this.playlists = [];
      this.updatedAt = 0;
      this.offset = 0;
      this.loadingPromise = null;
      this.loadingMore = false;
      if (this.active) this.loadData();
    },
  },
  activated() {
    this.active = true;
    this.loadData();
    this.$parent.$refs.scrollbar.restorePosition();
  },
  deactivated() {
    this.active = false;
  },
  mounted() {
    document.addEventListener('visibilitychange', this.resumeExplore);
    window.addEventListener('pageshow', this.resumeExplore);
  },
  beforeDestroy() {
    this.generation++;
    document.removeEventListener('visibilitychange', this.resumeExplore);
    window.removeEventListener('pageshow', this.resumeExplore);
  },
  methods: {
    ...mapMutations(['togglePlaylistCategory']),
    resumeExplore() {
      if (this.active && !document.hidden) this.loadData();
    },
    loadData(force = false) {
      const category = this.$route.query.category || '全部';
      if (category !== this.activeCategory) {
        this.generation++;
        this.activeCategory = category;
        this.playlists = [];
        this.updatedAt = 0;
        this.offset = 0;
        this.loadingPromise = null;
      }
      if (this.loadingPromise) return this.loadingPromise;
      if (!force && homeContentFresh(this.updatedAt)) return Promise.resolve();
      return this.getPlaylist(true);
    },
    goToCategory(category) {
      this.showCatOptions = false;
      this.$router.push({ name: 'explore', query: { category } });
    },
    getPlaylist(refresh = false) {
      if (!refresh && !homeContentFresh(this.updatedAt)) refresh = true;
      if (this.loadingPromise) return this.loadingPromise;
      const generation = this.generation,
        scope = this.accountScope,
        category = this.activeCategory;
      const current = () =>
        generation === this.generation && scope === this.accountScope;
      this.loadingMore = true;
      this.error = '';
      setTimeout(() => {
        if (current() && !this.show) NProgress.start();
      }, 1000);
      const params = { timestamp: Date.now() };
      let request;
      if (category === '推荐歌单')
        request = getRecommendPlayList(100, true).then(playlists => ({
          playlists,
          more: false,
        }));
      else if (category === '排行榜')
        request = toplists(params).then(data => ({
          playlists: data.list,
          more: false,
        }));
      else if (category === '精品歌单')
        request = highQualityPlaylist({
          ...params,
          limit: 50,
          before:
            !refresh && this.playlists.length
              ? this.playlists[this.playlists.length - 1].updateTime
              : 0,
        });
      else
        request = topPlaylist({
          ...params,
          cat: category,
          offset: refresh ? 0 : this.offset,
        });
      const work = request
        .then(data => {
          if (!current()) return;
          if (!Array.isArray(data.playlists))
            throw new Error('歌单暂时无法加载');
          const seen = new Set();
          this.playlists = [
            ...(refresh ? [] : this.playlists),
            ...data.playlists,
          ].filter(item => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
          this.offset = (refresh ? 0 : this.offset) + data.playlists.length;
          if (refresh) this.updatedAt = Date.now();
          this.hasMore = Boolean(data.more);
          this.showLoadMoreButton = true;
        })
        .catch(() => {
          if (current()) this.error = '加载失败，请稍后重试';
        })
        .finally(() => {
          if (this.loadingPromise === work) this.loadingPromise = null;
          if (current()) {
            this.loadingMore = false;
            this.show = true;
            NProgress.done();
          }
        });
      this.loadingPromise = work;
      return work;
    },
    getCatsByBigCat(name) {
      return playlistCategories.filter(c => c.bigCat === name);
    },
    toggleCat(name) {
      this.togglePlaylistCategory(name);
    },
  },
};
</script>

<style lang="scss" scoped>
.for-you-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin: 24px 0 32px;
}
@media (max-width: 600px) {
  .for-you-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}

.explore-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}
@media (max-width: 650px) {
  .explore-header {
    gap: 12px;
    h1 {
      font-size: 36px;
    }
  }
}
h1 {
  color: var(--color-text);
  font-size: 56px;
}
.buttons {
  display: flex;
  flex-wrap: wrap;
}
.button {
  user-select: none;
  cursor: pointer;
  padding: 8px 16px;
  margin: 10px 16px 6px 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 600;
  font-size: 18px;
  border-radius: 10px;
  background-color: var(--color-secondary-bg);
  color: var(--color-secondary);
  transition: 0.2s;

  &:hover {
    background-color: var(--color-primary-bg);
    color: var(--color-primary);
  }
}
.button.active {
  background-color: var(--color-primary-bg);
  color: var(--color-primary);
}
.panel {
  margin-top: 10px;
  background: var(--color-secondary-bg);
  border-radius: 10px;
  padding: 8px;
  color: var(--color-text);

  .big-cat {
    display: flex;
    margin-bottom: 32px;
  }

  .name {
    font-size: 24px;
    font-weight: 700;
    opacity: 0.68;
    margin-left: 24px;
    min-width: 54px;
    height: 26px;
    margin-top: 8px;
  }
  .cats {
    margin-left: 24px;
    display: flex;
    flex-wrap: wrap;
  }
  .cat {
    user-select: none;
    margin: 4px 0px 0 0;
    display: flex;
    // justify-content: center;
    align-items: center;
    font-weight: 500;
    font-size: 16px;
    transition: 0.2s;
    min-width: 98px;

    span {
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      padding: 6px 12px;
      height: 26px;
      border-radius: 10px;
      opacity: 0.88;
      &:hover {
        opacity: 1;
        background-color: var(--color-primary-bg);
        color: var(--color-primary);
      }
    }
  }
  .cat.active {
    color: var(--color-primary);
  }
}

.playlists {
  margin-top: 24px;
}

.load-more {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

.button.more {
  .svg-icon {
    height: 24px;
    width: 24px;
  }
}
</style>

<style lang="scss" scoped>
.explore-error {
  color: var(--color-text);
  margin: 16px 0;
  opacity: 0.7;
  button {
    color: var(--color-primary);
    margin-left: 12px;
  }
}
</style>
