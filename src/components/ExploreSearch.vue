<template>
  <form class="explore-search" role="search" @submit.prevent="doSearch">
    <label class="page-search">
      <svg-icon icon-class="search" />
      <input
        ref="searchInput"
        v-model="keywords"
        type="search"
        :placeholder="$t('nav.search')"
        aria-label="搜索音乐"
      />
    </label>
  </form>
</template>
<script>
export default {
  name: 'ExploreSearch',
  data() {
    return { keywords: '' };
  },
  mounted() {
    this.$root.$on('focus-explore-search', this.focus);
  },
  beforeDestroy() {
    this.$root.$off('focus-explore-search', this.focus);
  },
  methods: {
    focus() {
      if (this.$route.name === 'explore') this.$refs.searchInput.focus();
    },
    doSearch() {
      const keywords = this.keywords.trim();
      if (!keywords) return;
      if (
        this.$route.name === 'search' &&
        this.$route.params.keywords === this.keywords
      ) {
        return;
      }
      this.$router.push({
        name: 'search',
        params: { keywords },
      });
    },
  },
};
</script>
<style lang="scss" scoped>
@import '~@/assets/css/pageSearch.scss';
.explore-search {
  margin: 0;
}
</style>
