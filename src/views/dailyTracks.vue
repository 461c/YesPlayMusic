<template>
  <div v-page-reveal="show" v-show="show">
    <div class="special-playlist">
      <div class="title gradient"> 每日歌曲推荐 </div>
      <div class="subtitle">根据你的音乐口味生成 · 每天6:00更新</div>
      <div class="buttons">
        <select
          v-model="category"
          aria-label="每日推荐分类"
          @change="selectCategory"
        >
          <option value="">每日推荐</option>
          <option
            v-for="group in categories"
            :key="group.key"
            :value="group.key"
            >{{ group.title }}</option
          >
        </select>
        <button
          v-if="!categories.length"
          :disabled="categoryLoading"
          @click="loadCategories"
          >{{ categoryLoading ? '加载中…' : '分类推荐' }}</button
        >
        <ButtonTwoTone
          class="play-button"
          icon-class="play"
          color="grey"
          @click.native="playDailyTracks()"
        >
          {{ $t('common.play') }}
        </ButtonTwoTone>
      </div>
    </div>

    <TrackList
      :tracks="displayTracks"
      type="playlist"
      dbclick-track-func="playAList"
    />
  </div>
</template>

<script>
import { mapState } from 'vuex';
import NProgress from 'nprogress';
import { fetchDailyCategories, categoryTracks } from '@/utils/dailyCategories';
import { trackingScope } from '@/utils/trackingStore';
import { ensureDailyTracks } from '@/utils/dailyTracks';

import ButtonTwoTone from '@/components/ButtonTwoTone.vue';
import TrackList from '@/components/TrackList.vue';

export default {
  name: 'DailyTracks',
  components: {
    ButtonTwoTone,
    TrackList,
  },
  data() {
    return {
      show: false,
      categories: [],
      category: '',
      selectedTracks: [],
      categoryLoading: false,
      categoryGeneration: 0,
    };
  },
  computed: {
    ...mapState(['player', 'data', 'dailyTracks']),
    displayTracks() {
      return this.category ? this.selectedTracks : this.dailyTracks;
    },
  },
  watch: {
    'data.user.userId'() {
      this.categoryGeneration++;
      this.category = '';
      this.categories = [];
      this.selectedTracks = [];
      this.loadDailyTracks();
    },
  },
  created() {
    this.show = this.dailyTracks.length > 0;
    setTimeout(() => {
      if (!this.show) NProgress.start();
    }, 1000);
    this.loadDailyTracks();
    this.$parent.$refs.main.scrollTo(0, 0);
  },
  methods: {
    async loadCategories() {
      if (this.categoryLoading) return;
      const scope = trackingScope(this.data?.user?.userId);
      this.categoryLoading = true;
      try {
        const groups = await fetchDailyCategories();
        if (scope === trackingScope(this.data?.user?.userId))
          this.categories = groups;
      } catch (error) {
        this.$store.dispatch('showToast', error.message);
      } finally {
        this.categoryLoading = false;
      }
    },
    async selectCategory() {
      const epoch = ++this.categoryGeneration;
      const scope = trackingScope(this.data?.user?.userId);
      if (!this.category) return;
      const group = this.categories.find(group => group.key === this.category);
      this.selectedTracks = [];
      try {
        const tracks = await categoryTracks(group);
        if (
          epoch === this.categoryGeneration &&
          scope === trackingScope(this.data?.user?.userId)
        )
          this.selectedTracks = tracks;
      } catch (error) {
        this.$store.dispatch('showToast', '分类歌曲加载失败');
      }
    },
    async loadDailyTracks() {
      try {
        await ensureDailyTracks(this.$store);
      } catch (_) {
        this.$store.dispatch('showToast', '每日推荐加载失败，请稍后重试');
      } finally {
        NProgress.done();
        this.show = true;
      }
    },
    async playDailyTracks() {
      if (!this.category) await this.loadDailyTracks();
      if (!this.displayTracks.length) return;
      let trackIDs = this.displayTracks.map(t => t.id);
      this.$store.state.player.replacePlaylist(
        trackIDs,
        '/daily/songs',
        'url',
        this.displayTracks[0].id
      );
    },
  },
};
</script>

<style lang="scss" scoped>
.buttons {
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  select,
  > button {
    padding: 12px 16px;
    border: 0;
    border-radius: 10px;
    background: var(--color-secondary-bg);
    color: var(--color-text);
    cursor: pointer;
    max-width: 100%;
  }
}
@media (max-width: 600px) {
  .special-playlist {
    margin: 72px 0 48px;
    .title {
      font-size: 40px;
    }
  }
}

.special-playlist {
  margin-top: 192px;
  margin-bottom: 128px;
  border-radius: 1.25em;
  text-align: center;

  @keyframes letterSpacing4 {
    from {
      letter-spacing: 0px;
    }

    to {
      letter-spacing: 4px;
    }
  }

  @keyframes letterSpacing1 {
    from {
      letter-spacing: 0px;
    }

    to {
      letter-spacing: 1px;
    }
  }

  .title {
    font-size: 84px;
    line-height: 1.05;
    font-weight: 700;
    text-transform: uppercase;

    letter-spacing: 4px;
    animation-duration: 0.8s;
    animation-name: letterSpacing4;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    // background-image: linear-gradient(
    //   225deg,
    //   var(--color-primary),
    //   var(--color-primary)
    // );

    img {
      height: 78px;
      border-radius: 0.125em;
      margin-right: 24px;
    }
  }
  .subtitle {
    font-size: 18px;
    letter-spacing: 1px;
    margin: 28px 0 54px 0;
    animation-duration: 0.8s;
    animation-name: letterSpacing1;
    text-transform: uppercase;
    color: var(--color-text);
  }
  .buttons {
    margin-top: 32px;
    display: flex;
    justify-content: center;
    button {
      margin-right: 16px;
    }
  }
}

.gradient {
  background: linear-gradient(to left, #dd2476, #ff512f);
}
</style>
