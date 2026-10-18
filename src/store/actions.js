import { libraryScope, readLibrary } from '@/utils/offlineLibrary';
import { syncLibraryArtwork } from '@/utils/libraryArtwork';
// import store, { state, dispatch, commit } from "@/store";
import { isAccountLoggedIn, isLooseLoggedIn } from '@/utils/auth';
import { likeATrack } from '@/api/track';
import { getPlaylistDetail } from '@/api/playlist';
import { getTrackDetail } from '@/api/track';
import {
  userPlaylist,
  userPlayHistory,
  userLikedSongsIDs,
  likedAlbums,
  likedArtists,
  likedMVs,
  cloudDisk,
  userAccount,
} from '@/api/user';

const hydration = new Map();
const actions = {
  restoreLibrary({ state, commit }) {
    const scope = libraryScope(state.data);
    if (!scope || state.libraryOwner === scope) return Promise.resolve();
    if (hydration.has(scope)) return hydration.get(scope);
    const work = readLibrary(scope)
      .then(snapshot => {
        if (
          libraryScope(state.data) === scope &&
          state.libraryOwner !== scope
        ) {
          commit('restoreLibrary', { scope, snapshot });
        }
      })
      .finally(() => hydration.delete(scope));
    hydration.set(scope, work);
    return work;
  },
  showToast({ state, commit }, text) {
    if (state.toast.timer !== null) {
      clearTimeout(state.toast.timer);
      commit('updateToast', { show: false, text: '', timer: null });
    }
    commit('updateToast', {
      show: true,
      text,
      timer: setTimeout(() => {
        commit('updateToast', {
          show: false,
          text: state.toast.text,
          timer: null,
        });
      }, 3200),
    });
  },
  likeATrack({ state, commit, dispatch }, id) {
    if (!isAccountLoggedIn()) {
      dispatch('showToast', '此操作需要登录网易云账号');
      return;
    }
    let like = true;
    if (state.liked.songs.includes(id)) like = false;
    likeATrack({ id, like })
      .then(() => {
        if (like === false) {
          commit('updateLikedXXX', {
            name: 'songs',
            data: state.liked.songs.filter(d => d !== id),
          });
        } else {
          let newLikeSongs = state.liked.songs;
          newLikeSongs.push(id);
          commit('updateLikedXXX', {
            name: 'songs',
            data: newLikeSongs,
          });
        }
        dispatch('fetchLikedSongsWithDetails');
      })
      .catch(() => {
        dispatch('showToast', '操作失败，专辑下架或版权锁定');
      });
  },
  fetchLikedSongs: ({ state, commit }) => {
    if (!isLooseLoggedIn()) return;
    if (isAccountLoggedIn()) {
      return userLikedSongsIDs({ uid: state.data.user.userId }).then(result => {
        if (result.ids) {
          commit('updateLikedXXX', {
            name: 'songs',
            data: result.ids,
          });
        }
      });
    } else {
      // TODO:搜索ID登录的用户
    }
  },
  fetchLikedSongsWithDetails: ({ state, commit }) => {
    if (!state.data.likedSongPlaylistID) return Promise.resolve();
    return getPlaylistDetail(state.data.likedSongPlaylistID, true).then(
      result => {
        if (!result.playlist?.trackIds?.length) {
          commit('updateLikedXXX', { name: 'songsWithDetails', data: [] });
          return;
        }
        return getTrackDetail(
          result.playlist.trackIds
            .slice(0, 12)
            .map(t => t.id)
            .join(',')
        ).then(result => {
          commit('updateLikedXXX', {
            name: 'songsWithDetails',
            data: result.songs,
          });
        });
      }
    );
  },
  fetchLikedPlaylist: ({ state, commit }) => {
    if (!isLooseLoggedIn()) return;
    if (isAccountLoggedIn()) {
      const owner = String(state.data.user?.userId || '');
      return userPlaylist({
        uid: state.data.user?.userId,
        limit: 2000, // 最多只加载2000个歌单（等有用户反馈问题再修）
        timestamp: new Date().getTime(),
      }).then(result => {
        if (String(state.data.user?.userId || '') !== owner) return;
        if (result.playlist) {
          commit('updateLikedXXX', {
            name: 'playlists',
            data: result.playlist,
            markMissing: result.more !== true,
          });
          if (
            process.env.VUE_APP_ANDROID === 'true' ||
            process.env.IS_ELECTRON
          ) {
            const account = String(state.data.user?.userId || '');
            syncLibraryArtwork(
              result.playlist,
              account,
              () => String(state.data.user?.userId || '') === account
            ).catch(error => console.debug('Artwork cache unavailable', error));
          }
          // 更新用户”喜欢的歌曲“歌单ID
          commit('updateData', {
            key: 'likedSongPlaylistID',
            value: result.playlist[0]?.id,
          });
        }
      });
    } else {
      // TODO:搜索ID登录的用户
    }
  },
  fetchLikedAlbums: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return likedAlbums({ limit: 2000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'albums',
          data: result.data,
          markMissing: result.more !== true,
        });
      }
    });
  },
  fetchLikedArtists: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return likedArtists({ limit: 2000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'artists',
          data: result.data,
          markMissing: result.more !== true,
        });
      }
    });
  },
  fetchLikedMVs: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return likedMVs({ limit: 1000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'mvs',
          data: result.data,
          markMissing: result.more !== true,
        });
      }
    });
  },
  fetchCloudDisk: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    // FIXME: #1242
    return cloudDisk({ limit: 1000 }).then(result => {
      if (result.data) {
        commit('updateLikedXXX', {
          name: 'cloudDisk',
          data: result.data,
          markMissing: result.more !== true,
        });
      }
    });
  },
  fetchPlayHistory: ({ state, commit }) => {
    if (!isAccountLoggedIn()) return;
    return Promise.all([
      userPlayHistory({ uid: state.data.user?.userId, type: 0 }),
      userPlayHistory({ uid: state.data.user?.userId, type: 1 }),
    ]).then(async result => {
      const { retainTracks } = await import('@/utils/retainedTracks');
      const data = {};
      const dataType = { 0: 'allData', 1: 'weekData' };
      if (result[0] && result[1]) {
        for (let i = 0; i < result.length; i++) {
          if (!Array.isArray(result[i][dataType[i]]))
            throw new Error('排行暂不可见，保留缓存');
          const songData = result[i][dataType[i]].map(item => {
            const song = item.song;
            song.playCount = item.playCount;
            return song;
          });
          data[dataType[i]] = await retainTracks(
            songData,
            state.liked.playHistory[dataType[i]] || [],
            null,
            'not-listed'
          );
        }
        commit('updateLikedXXX', {
          name: 'playHistory',
          data: data,
        });
      }
    });
  },
  fetchUserProfile: ({ commit }) => {
    if (!isAccountLoggedIn()) return;
    return userAccount().then(result => {
      if (result.code === 200) {
        commit('updateData', { key: 'user', value: result.profile });
      }
    });
  },
};

// Share normal refreshes from App/Library and ignore results belonging to a previous account.
const requests = new Map();
for (const name of Object.keys(actions).filter(name =>
  name.startsWith('fetch')
)) {
  const action = actions[name];
  actions[name] = (context, payload) => {
    const scope = libraryScope(context.state.data);
    const key = `${scope}:${name}`;
    if (requests.has(key)) return requests.get(key);
    const work = context
      .dispatch('restoreLibrary')
      .then(() => {
        if (libraryScope(context.state.data) !== scope) return;
        if (navigator.onLine === false) throw new Error('当前离线');
        return action(
          {
            ...context,
            commit: (...args) => {
              if (libraryScope(context.state.data) === scope)
                context.commit(...args);
            },
          },
          payload
        );
      })
      .finally(() => requests.delete(key));
    requests.set(key, work);
    return work;
  };
}
export default actions;
