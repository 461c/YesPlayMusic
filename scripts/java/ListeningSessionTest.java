package com.yesplaymusic.tablet;

public final class ListeningSessionTest {
    private static void equal(long actual, long expected, String reason) {
        if (actual != expected) throw new AssertionError(reason + ": " + actual + " != " + expected);
    }
    private static ListeningSession session(long now, boolean playing) {
        return new ListeningSession("1", "10", "MUSIC_U=test;", "local", now, playing);
    }
    public static void main(String[] args) {
        ListeningSession paused = session(0, false);
        paused.update(60000, true);
        paused.update(80000, false);
        paused.update(120000, true);
        equal(paused.finish(130000), 30, "Exclude initial buffer, pause and subsequent buffering");
        equal(paused.finish(150000), 0, "Never count one session twice");
        paused.update(200000, true);
        equal(paused.finish(220000), 0, "Finished session cannot restart");
        ListeningSession seek = session(0, true);
        seek.update(10000, true); // UI seeks forward by minutes; no position is fed to the clock.
        equal(seek.finish(15000), 15, "Seeking cannot manufacture listening time");
        equal(session(0, true).finish(999), 0, "Subsecond accidental starts do not count");
        ListeningSession first = session(0, true), repeated = session(30000, true);
        equal(first.finish(30000), 30, "First repeat ends once");
        equal(repeated.finish(60000), 30, "Repeat is a separate real listen");
        ListeningSession background = session(0, true);
        equal(background.finish(300000), 300, "Screen-off playback does not need WebView ticks");
        System.out.println("ListeningSession: pause/buffer/seek, duplicate finish, repeat and screen-off time passed");
    }
}
