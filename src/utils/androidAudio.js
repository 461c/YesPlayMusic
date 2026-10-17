import { getCookie } from '@/utils/auth';

export const isAndroid =
  process.env.VUE_APP_ANDROID === 'true' && !!window.YesPlayMusicAndroid;

export function androidCommand(command) {
  if (isAndroid) window.YesPlayMusicAndroid.send(JSON.stringify(command));
}

export default class AndroidAudio {
  constructor(owner, source = null) {
    this.owner = owner;
    this._src = source || '';
    this.sourceTrackId = source ? String(owner.currentTrackID) : '';
    this.awaitingTrack = this.sourceTrackId;
    this.state = { position: 0, playing: false };
    this.positionUpdatedAt = performance.now();
    this.listeners = {};
    this.restorationRequested = false;
    this.onState = event => this.consume(event.detail);
    window.addEventListener('yesplaymusic-native-state', this.onState);
    if (source) this.refreshQueue('load');
    else {
      try {
        this.consume(JSON.parse(window.YesPlayMusicAndroid.getState()));
      } catch {
        console.debug('Native playback session is connecting.');
      }
    }
  }
  consume(state) {
    if (this.awaitingTrack && String(state.trackId) !== this.awaitingTrack)
      return;
    this.awaitingTrack = '';
    const wasPlaying = this.state.playing;
    this.state = state;
    this.positionUpdatedAt = performance.now();
    if (!state.trackId) {
      if (state.ready && this.owner.enabled && !this.restorationRequested) {
        this.restorationRequested = true;
        this.owner._replaceCurrentTrack(this.owner.currentTrackID, false);
      }
      return;
    }
    this.owner._syncNativeState(state);
    if (!wasPlaying && state.playing) this.emit('play');
    if (state.error && state.error !== this.lastError) {
      this.lastError = state.error;
      this.owner._setPlaying(false);
    }
  }
  refreshQueue(action = 'queue') {
    const owner = this.owner;
    let queue = owner.list.map((id, logicalIndex) => ({
      id: String(id),
      logicalIndex,
    }));
    if (owner.isPersonalFM || !queue.length) {
      queue = [{ id: String(owner.currentTrackID), logicalIndex: -1 }];
      const next = owner._personalFMNextTrack?.id;
      if (next && next !== owner.currentTrackID)
        queue.push({ id: String(next), logicalIndex: -1 });
    } else if (owner.reversed) queue.reverse();
    let index = queue.findIndex(
      entry => entry.id === String(owner.currentTrackID)
    );
    if (index < 0) {
      queue.unshift({ id: String(owner.currentTrackID), logicalIndex: -1 });
      index = 0;
    }
    if (!owner.isPersonalFM) {
      queue.splice(
        index + 1,
        0,
        ...owner.playNextList.map(id => ({ id: String(id), logicalIndex: -1 }))
      );
    }
    const cookie = ['MUSIC_U', '__csrf']
      .map(key => [key, getCookie(key)])
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}=${value};`)
      .join('');
    androidCommand({
      action,
      queue,
      index,
      cookie,
      sourceId: String(owner.playlistSource?.id || 0),
      source:
        this.sourceTrackId === String(owner.currentTrackID) ? this._src : '',
      track: owner.currentTrack,
      personalFm: owner.isPersonalFM,
      volume: owner.volume,
      repeatMode: owner.isPersonalFM
        ? 0
        : { off: 0, one: 1, on: 2 }[owner.repeatMode],
    });
  }
  playing() {
    return !!this.state.playing;
  }
  seek(position) {
    if (position !== undefined && position !== null) {
      this.state.position = position;
      this.positionUpdatedAt = performance.now();
      androidCommand({ action: 'seek', position });
    }
    const elapsed = this.state.playing
      ? (performance.now() - this.positionUpdatedAt) / 1000
      : 0;
    const positionNow = (Number(this.state.position) || 0) + elapsed;
    const duration =
      Number(this.state.duration) || this.owner.currentTrackDuration;
    return duration > 0 ? Math.min(positionNow, duration) : positionNow;
  }
  play() {
    androidCommand({ action: 'play' });
  }
  pause() {
    androidCommand({ action: 'pause' });
  }
  stop() {
    androidCommand({ action: 'stop' });
  }
  volume(value) {
    androidCommand({ action: 'volume', value });
  }
  fade(from, to, duration) {
    this.volume(to);
    setTimeout(() => this.emit('fade'), duration);
  }
  on(event, callback) {
    (this.listeners[event] ||= []).push({ callback, once: false });
  }
  once(event, callback) {
    (this.listeners[event] ||= []).push({ callback, once: true });
  }
  emit(event) {
    const callbacks = this.listeners[event] || [];
    this.listeners[event] = callbacks.filter(listener => !listener.once);
    callbacks.forEach(listener => listener.callback());
  }
  unload() {
    window.removeEventListener('yesplaymusic-native-state', this.onState);
  }
}
