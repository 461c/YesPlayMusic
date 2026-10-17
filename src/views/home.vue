<template>
  <div class="home" :data-page-ready="homeReady ? 'true' : 'false'">
    <div class="home-actions"
      ><button :disabled="Boolean(loadingPromise)" @click="refreshHome">{{
        loadingPromise ? '刷新中…' : '刷新'
      }}</button></div
    >
    <p v-if="!sections.length" class="empty-home">尚未启用栏目</p>
    <section
      v-for="section in sections"
      :key="section.key"
      v-page-reveal="Boolean(rows[section.key])"
      class="index-row"
    >
      <div class="title"
        >{{ section.title
        }}<router-link v-if="section.more" :to="section.more"
          >查看更多</router-link
        ></div
      >
      <div v-if="section.type === 'forYou'" class="for-you-row"
        ><DailyTracksCard /><FMCard
      /></div>
      <template v-else-if="rows[section.key]">
        <TrackList
          v-if="section.type === 'songs' || section.type === 'newSongs'"
          :tracks="rows[section.key]"
          type="tracklist"
          :column-number="2"
          dbclick-track-func="playAList"
        />
        <CoverRow
          v-else
          :type="
            section.type === 'artist'
              ? 'artist'
              : section.type === 'album'
              ? 'album'
              : 'playlist'
          "
          :items="rows[section.key]"
          :column-number="section.type === 'artist' ? 6 : 5"
          :show-play-count="
            section.type === 'playlist' || section.type === 'recommend'
          "
        />
      </template>
      <div v-else class="section-placeholder"
        ><button v-if="errors[section.key]" @click="retry(section)"
          >加载失败，重试</button
        ><span v-else>加载中…</span></div
      >
    </section>
  </div>
</template>
<script>
import { homeContentFresh } from '@/utils/homeFreshness';
import { ensureDailyTracks } from '@/utils/dailyTracks';
import { trackingScope } from '@/utils/trackingStore';
import { homeSections } from '@/utils/homeSections';
import { fetchHomeSection } from '@/api/home';
import CoverRow from '@/components/CoverRow.vue';
import TrackList from '@/components/TrackList.vue';
import FMCard from '@/components/FMCard.vue';
import DailyTracksCard from '@/components/DailyTracksCard.vue';
export default {
  name: 'Home',
  components: { CoverRow, TrackList, FMCard, DailyTracksCard },
  data() {
    return {
      rows: {},
      updatedAt: {},
      errors: {},
      inFlight: new Set(),
      active: false,
      generation: 0,
      loadingPromise: null,
      loadingGeneration: -1,
    };
  },
  computed: {
    accountScope() {
      return trackingScope(this.$store.state.data?.user?.userId);
    },
    homeReady() {
      return (
        this.sections.length === 0 ||
        this.sections.some(
          item =>
            this.rows[item.key] ||
            this.errors[item.key] ||
            item.type === 'forYou'
        )
      );
    },
    sections() {
      return homeSections(this.$store.state.settings);
    },
    sectionKeys() {
      return this.sections.map(item => item.key).join(',');
    },
  },
  watch: {
    accountScope() {
      this.generation++;
      this.rows = {};
      this.updatedAt = {};
      this.errors = {};
      this.inFlight = new Set();
      if (this.active) this.loadData();
    },
    sectionKeys() {
      if (this.active) this.loadData();
    },
  },
  activated() {
    this.active = true;
    this.errors = {};
    this.loadData();
    this.$parent.$refs.scrollbar.restorePosition();
  },
  deactivated() {
    this.active = false;
  },
  mounted() {
    document.addEventListener('visibilitychange', this.resumeHome);
    window.addEventListener('pageshow', this.resumeHome);
  },
  beforeDestroy() {
    document.removeEventListener('visibilitychange', this.resumeHome);
    window.removeEventListener('pageshow', this.resumeHome);
  },
  methods: {
    resumeHome() {
      if (!this.active || document.hidden) return;
      this.errors = {};
      this.loadData();
    },
    refreshHome() {
      this.errors = {};
      return this.loadData(true);
    },
    async loadData(force = false) {
      // Only enabled rows; limit concurrency and never crawl playlist contents for discovery.
      const generation = this.generation;
      if (this.loadingPromise && this.loadingGeneration === generation)
        return this.loadingPromise;
      this.loadingGeneration = generation;
      const queue = this.sections.filter(
        section =>
          (force ||
            section.type === 'forYou' ||
            !this.rows[section.key] ||
            !homeContentFresh(this.updatedAt[section.key])) &&
          !this.inFlight.has(section.key) &&
          !this.errors[section.key]
      );
      const worker = async () => {
        while (queue.length && this.active && generation === this.generation) {
          const section = queue.shift();
          if (this.sections.some(item => item.key === section.key))
            await this.retry(section, force);
        }
      };
      const work = Promise.all([worker(), worker(), worker()]);
      this.loadingPromise = work;
      await work;
      if (this.loadingPromise === work) {
        this.loadingPromise = null;
        if (
          this.active &&
          this.sections.some(
            item =>
              !this.rows[item.key] &&
              !this.errors[item.key] &&
              !this.inFlight.has(item.key)
          )
        )
          this.loadData();
      }
    },
    async retry(section, force = false) {
      if (this.inFlight.has(section.key)) return;
      const generation = this.generation,
        inFlight = this.inFlight;
      inFlight.add(section.key);
      this.$delete(this.errors, section.key);
      try {
        let items;
        if (section.type === 'forYou') {
          await ensureDailyTracks(this.$store, force);
          items = [];
        } else items = await fetchHomeSection(section);
        if (generation === this.generation) {
          this.$set(this.rows, section.key, items);
          this.$set(this.updatedAt, section.key, Date.now());
        }
      } catch (_) {
        if (generation === this.generation)
          this.$set(this.errors, section.key, true);
      } finally {
        inFlight.delete(section.key);
      }
    },
  },
};
</script>
<style lang="scss" scoped>
.index-row {
  margin-top: 54px;
}
.index-row.first-row {
  margin-top: 32px;
}
.playlists {
  display: flex;
  flex-wrap: wrap;
  margin: {
    right: -12px;
    left: -12px;
  }
  .index-playlist {
    margin: 12px 12px 24px 12px;
  }
}

.title {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 20px;
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text);
  a {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.68;
  }
}

footer {
  display: flex;
  justify-content: center;
  margin-top: 48px;
}

.for-you-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
  margin-bottom: 78px;
}
</style>

<style lang="scss" scoped>
.home-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-top: 28px;
  color: var(--color-text);
  h1 {
    font-size: 32px;
  }
  a {
    font-size: 13px;
    color: var(--color-primary);
  }
}
.section-placeholder {
  min-height: 100px;
  display: flex;
  align-items: center;
  opacity: 0.55;
  color: var(--color-text);
  button {
    color: inherit;
    padding: 12px 0;
  }
}
.empty-home {
  margin: 40px 0;
  color: var(--color-text);
  opacity: 0.6;
}
</style>

<style lang="scss" scoped>
.index-row:first-of-type {
  margin-top: 32px;
}
</style>

<style lang="scss" scoped>
.home-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  button {
    color: var(--color-text);
    font: inherit;
    border: none;
    border-radius: 8px;
    background: var(--color-secondary-bg);
    padding: 10px 14px;
  }
  button:disabled {
    opacity: 0.35;
  }
}
.home-actions + .index-row {
  margin-top: 20px;
}
</style>
