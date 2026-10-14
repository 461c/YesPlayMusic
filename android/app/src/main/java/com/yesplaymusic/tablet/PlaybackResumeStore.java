package com.yesplaymusic.tablet;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/** Local queue/position only; expiring music URLs are resolved again when resuming. */
@androidx.media3.common.util.UnstableApi
final class PlaybackResumeStore {
    static void save(Context context, Player player, boolean queueChanged) {
        if (player.getMediaItemCount() == 0) return; // Keep the last queue for System UI resumption.
        try {
            SharedPreferences.Editor editor = ApiClient.preferences(context).edit();
            if (queueChanged) {
                JSONArray queue = new JSONArray();
                for (int i = 0; i < player.getMediaItemCount(); i++) {
                    MediaItem item = player.getMediaItemAt(i);
                    MediaMetadata metadata = item.mediaMetadata;
                    String uri = item.mediaId.matches("\\d+") ? "ypm://track/" + item.mediaId
                        : item.localConfiguration == null ? "" : item.localConfiguration.uri.toString();
                    queue.put(new JSONObject().put("id", item.mediaId).put("uri", uri)
                        .put("mime", item.localConfiguration == null ? null : item.localConfiguration.mimeType)
                        .put("title", metadata.title).put("artist", metadata.artist).put("album", metadata.albumTitle)
                        .put("art", metadata.artworkUri == null ? "" : metadata.artworkUri.toString())
                        .put("index", metadata.extras == null ? -1 : metadata.extras.getInt("playlistIndex", -1)));
                }
                editor.putString("resumeQueue", queue.toString());
            }
            editor.putInt("resumeIndex", player.getCurrentMediaItemIndex())
                .putLong("resumePosition", Math.max(0, player.getCurrentPosition()))
                .putInt("resumeRepeat", player.getRepeatMode()).putFloat("resumeVolume", player.getVolume()).apply();
        } catch (Exception ignored) { /* A failed snapshot must not interrupt audio. */ }
    }

    static List<MediaItem> load(Context context) {
        List<MediaItem> items = new ArrayList<>();
        try {
            JSONArray queue = new JSONArray(ApiClient.preferences(context).getString("resumeQueue", "[]"));
            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.getJSONObject(i);
                Bundle extras = new Bundle();
                extras.putInt("playlistIndex", entry.optInt("index", -1));
                MediaMetadata.Builder metadata = new MediaMetadata.Builder().setTitle(entry.optString("title"))
                    .setDisplayTitle(entry.optString("title")).setArtist(entry.optString("artist"))
                    .setSubtitle(entry.optString("artist")).setAlbumTitle(entry.optString("album"))
                    .setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC)
                    .setIsBrowsable(false).setIsPlayable(true).setExtras(extras);
                String art = entry.optString("art");
                if (!art.isEmpty()) metadata.setArtworkUri(Uri.parse(art));
                String uri = entry.optString("uri");
                if (uri.isEmpty()) continue;
                String id = entry.getString("id");
                items.add(new MediaItem.Builder().setMediaId(id).setUri(uri)
                    .setMimeType(id.matches("\\d+") ? null : entry.optString("mime", null))
                    .setMediaMetadata(metadata.build()).build());
            }
        } catch (Exception ignored) { items.clear(); }
        return items;
    }
}
