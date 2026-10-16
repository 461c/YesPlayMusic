<template>
  <div id="app" :class="{ 'user-select-none': userSelectNone }">
    <Scrollbar v-show="!showLyrics" ref="scrollbar" />
    <Navbar v-show="showNavbar" ref="navbar" :scrolled="pageScrolled" />
    <main
      ref="main"
      :style="{ overflow: enableScrolling ? 'auto' : 'hidden' }"
      @scroll="handleScroll"
    >
      <transition name="page" mode="out-in" @before-enter="restorePagePosition">
        <keep-alive
          include="Home,Artist,ArtistMV,Next,Search,Explore,Library,Tracking"
        >
          <router-view :key="$route.fullPath" />
        </keep-alive>
      </transition>
    </main>
    <transition name="slide-up">
      <Player v-if="enablePlayer" v-show="showPlayer" ref="player" />
    </transition>
    <Toast />
    <ModalAddTrackToPlaylist v-if="isAccountLoggedIn" />
    <ModalNewPlaylist v-if="isAccountLoggedIn" />
    <transition v-if="enablePlayer" name="slide-up">
      <Lyrics v-show="showLyrics" />
    </transition>
  </div>
</template>

<script>
import ModalAddTrackToPlaylist from './components/ModalAddTrackToPlaylist.vue';
import ModalNewPlaylist from './components/ModalNewPlaylist.vue';
import Scrollbar from './components/Scrollbar.vue';
import Navbar from './components/Navbar.vue';
import Player from './components/Player.vue';
import Toast from './components/Toast.vue';
import { ipcRenderer } from './electron/ipcRenderer';
import { isAccountLoggedIn, isLooseLoggedIn } from '@/utils/auth';
import Lyrics from './views/lyrics.vue';
import { mapState } from 'vuex';
import { installPageTransitions } from '@/utils/pageTransitions';

export default {
  name: 'App',
  components: {
    Navbar,
    Player,
    Toast,
    ModalAddTrackToPlaylist,
    ModalNewPlaylist,
    Lyrics,
    Scrollbar,
  },
  data() {
    return {
      isElectron: process.env.IS_ELECTRON, // true || undefined
      userSelectNone: false,
      pageScrolled: false,
      removePageTransitions: null,
    };
  },
  computed: {
    ...mapState(['showLyrics', 'settings', 'player', 'enableScrolling']),
    isAccountLoggedIn() {
      return isAccountLoggedIn();
    },
    showPlayer() {
      return (
        [
          'mv',
          'loginUsername',
          'login',
          'loginAccount',
          'lastfmCallback',
        ].includes(this.$route.name) === false
      );
    },
    enablePlayer() {
      return this.player.enabled && this.$route.name !== 'lastfmCallback';
    },
    showNavbar() {
      return this.$route.name !== 'lastfmCallback';
    },
  },
  created() {
    if (this.isElectron) ipcRenderer(this);
    window.addEventListener('keydown', this.handleKeydown);
    this.fetchData();
  },
  mounted() {
    this.removePageTransitions = installPageTransitions(this.$router, this);
  },
  beforeDestroy() {
    this.removePageTransitions?.();
    window.removeEventListener('keydown', this.handleKeydown);
  },
  methods: {
    handleKeydown(e) {
      if (e.code === 'Space') {
        if (e.target.tagName === 'INPUT') return false;
        if (this.$route.name === 'mv') return false;
        e.preventDefault();
        this.player.playOrPause();
      }
    },
    async fetchData() {
      if (!isLooseLoggedIn()) return;
      await this.$store.dispatch('restoreLibrary');
      const tasks = ['fetchLikedSongs'];
      if (isAccountLoggedIn())
        tasks.push(
          'fetchLikedAlbums',
          'fetchLikedArtists',
          'fetchLikedMVs',
          'fetchCloudDisk'
        );
      for (const action of tasks) this.$store.dispatch(action).catch(() => {});
      this.$store
        .dispatch('fetchLikedPlaylist')
        .then(() => this.$store.dispatch('fetchLikedSongsWithDetails'))
        .catch(() => {});
    },
    restorePagePosition() {
      this.$refs.scrollbar.restorePosition();
      this.$nextTick(() => this.updatePageScroll());
    },
    updatePageScroll() {
      this.pageScrolled = this.$refs.main.scrollTop > 1;
    },
    handleScroll() {
      this.updatePageScroll();
      this.$refs.scrollbar.handleScroll();
    },
  },
};
</script>

<style lang="scss">
#app {
  width: 100%;
  transition: all 0.4s;
}

main {
  position: fixed;
  top: 0;
  bottom: 0;
  right: 0;
  left: 0;
  overflow: auto;
  padding: 64px 10vw calc(96px + var(--player-bottom-gap)) 10vw;
  box-sizing: border-box;
}

body:not([data-platform='android']) main {
  scrollbar-width: none; // firefox
}

@media (max-width: 1336px) {
  main {
    padding: 64px 5vw calc(96px + var(--player-bottom-gap)) 5vw;
  }
}

body:not([data-platform='android']) main::-webkit-scrollbar {
  width: 0px;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.page-enter {
  opacity: 0;
  transform: translateY(5px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition-duration: 0.01ms;
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.4s;
}
.slide-up-enter,
.slide-up-leave-to {
  transform: translateY(100%);
}

.player.slide-up-enter,
.player.slide-up-leave-to {
  transform: translateY(calc(100% + var(--player-bottom-gap)));
}
</style>

<style>
html {
  view-transition-name: none;
}
main {
  view-transition-name: route-content;
}
html[data-page-transition] .page-enter-active,
html[data-page-transition] .page-leave-active {
  transition: none;
}
html[data-page-transition] .page-enter,
html[data-page-transition] .page-leave-to {
  transform: none;
  opacity: 1;
}
::view-transition-group(route-content) {
  animation-duration: 100ms;
}
::view-transition-old(route-content) {
  animation: route-fade-out 100ms ease both;
}
::view-transition-new(route-content) {
  animation: route-fade-in 100ms ease both;
}
@keyframes route-fade-out {
  to {
    opacity: 0;
    transform: translateY(-4px);
  }
}
@keyframes route-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
</style>
