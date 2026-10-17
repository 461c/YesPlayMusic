package com.yesplaymusic.tablet;

/** Actual audible wall time; seeks and paused/buffering time never contribute. */
final class ListeningSession {
    final String id, sourceId, cookie, api;
    private long updatedAt, listenedMs;
    private boolean playing, finished;
    ListeningSession(String id, String sourceId, String cookie, String api, long now, boolean playing) {
        this.id = id; this.sourceId = sourceId; this.cookie = cookie; this.api = api;
        this.updatedAt = now; this.playing = playing;
    }
    void update(long now, boolean isPlaying) {
        if (finished) return;
        if (playing) listenedMs += Math.max(0, now - updatedAt);
        updatedAt = now;
        playing = isPlaying;
    }
    long finish(long now) {
        if (finished) return 0;
        update(now, false);
        finished = true;
        return listenedMs / 1000;
    }
}
