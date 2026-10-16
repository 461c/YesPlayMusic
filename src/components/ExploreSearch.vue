<template>
  <form class="explore-search" role="search" @submit.prevent="doSearch">
    <div class="search-box">
      <div class="container" :class="{ active: inputFocus }">
        <svg-icon icon-class="search" />
        <div class="input">
          <input
            ref="searchInput"
            v-model="keywords"
            type="search"
            :placeholder="inputFocus ? '' : $t('nav.search')"
            aria-label="搜索音乐"
            @focus="inputFocus = true"
            @blur="inputFocus = false"
          />
        </div>
      </div>
    </div>
  </form>
</template>
<script>
export default {
  name: 'ExploreSearch',
  data() {
    return { keywords: '', inputFocus: false };
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
.explore-search {
  margin: 0;
}
.search-box {
  display: flex;
  justify-content: flex-end;
  -webkit-app-region: no-drag;

  .container {
    display: flex;
    align-items: center;
    height: 32px;
    background: var(--color-secondary-bg-for-transparent);
    border-radius: 8px;
    width: 200px;
  }

  .svg-icon {
    height: 15px;
    width: 15px;
    color: var(--color-text);
    opacity: 0.28;
    margin: {
      left: 8px;
      right: 4px;
    }
  }

  input {
    font-size: 16px;
    border: none;
    background: transparent;
    width: 96%;
    font-weight: 600;
    margin-top: -1px;
    color: var(--color-text);
  }

  .active {
    background: var(--color-primary-bg-for-transparent);
    input,
    .svg-icon {
      opacity: 1;
      color: var(--color-primary);
    }
  }
}

[data-theme='dark'] {
  .search-box {
    .active {
      input,
      .svg-icon {
        color: var(--color-text);
      }
    }
  }
}

@media (max-width: 650px) {
  .search-box .container {
    width: 170px;
  }
}
</style>
