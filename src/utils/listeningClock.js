// Accumulate playing wall time; seeking never changes the reported duration.
export default class ListeningClock {
  constructor(now = () => performance.now()) {
    this.now = now;
    this.elapsed = 0;
    this.started = null;
  }
  setPlaying(playing) {
    const now = this.now();
    if (this.started !== null) this.elapsed += Math.max(0, now - this.started);
    this.started = playing ? now : null;
  }
  seconds() {
    return Math.floor(
      (this.elapsed +
        (this.started === null ? 0 : Math.max(0, this.now() - this.started))) /
        1000
    );
  }
}
