const text = value =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase();
function termsFor(item) {
  return [
    item.name,
    item.nickname,
    item.title,
    item.signature,
    item.description,
    item.transName,
    item.artist,
    item.artistName,
    item.album,
    ...(item.alias || []),
    ...(item.alia || []),
    ...(item.tags || []),
    ...(item.ar || item.artists || []).map(artist => artist.name),
    item.al?.name,
    typeof item.album === 'object' ? item.album?.name : '',
    item.creator?.nickname,
  ]
    .filter(value => typeof value === 'string')
    .join(' ');
}
export function buildLibraryIndex(liked, saved, tracks) {
  const playlists = liked.playlists || [];
  const known = new Map(playlists.map(item => [String(item.id), item]));
  const snapshots = saved.filter(item => known.has(String(item.playlist.id)));
  const songs = new Map();
  const add = (song, source) => {
    if (!song?.id) return;
    const id = String(song.id);
    let entry = songs.get(id);
    if (!entry) {
      entry = { song, sources: [] };
      songs.set(id, entry);
    }
    if (source && !entry.sources.some(item => item.key === source.key))
      entry.sources.push(source);
  };
  const details = new Map(tracks.map(song => [String(song.id), song]));
  for (const snapshot of snapshots) {
    const playlist = {
      ...snapshot.playlist,
      ...known.get(String(snapshot.playlist.id)),
    };
    const source = {
      key: 'playlist:' + playlist.id,
      name: playlist.name,
      path: '/playlist/' + playlist.id,
      kind: '歌单',
    };
    for (const song of snapshot.playlist.tracks || []) add(song, source);
    for (const song of snapshot.playlist.trackIds ||
      snapshot.playlist.tracks ||
      [])
      add(details.get(String(song.id)), source);
  }
  const likes = {
    key: 'likes',
    name: '喜欢的音乐',
    path: '/library/liked-songs',
    kind: '音乐库',
  };
  for (const song of liked.songsWithDetails || []) add(song, likes);
  for (const id of liked.songs || []) add(details.get(String(id)), likes);
  for (const song of liked.cloudDisk || [])
    add(
      {
        ...song,
        id: song.songId || song.id,
        name: song.songName || song.name,
        ar: song.ar || [{ name: song.artist }],
        al: song.al || { name: song.album },
      },
      { key: 'cloud', name: '云盘', kind: '音乐库' }
    );
  for (const [key, label] of [
    ['weekData', '本周排行'],
    ['allData', '累计排行'],
  ])
    for (const row of liked.playHistory?.[key] || [])
      add(row.song || row, { key, name: label, kind: '排行' });
  const total = snapshots.reduce(
    (sum, item) =>
      sum +
      (item.playlist.trackIds?.length || item.playlist.tracks?.length || 0),
    0
  );
  const result = {
    playlists,
    songs: [...songs.values()],
    albums: liked.albums || [],
    artists: liked.artists || [],
    mvs: liked.mvs || [],
    coverage: {
      saved: snapshots.length,
      total: playlists.length,
      songs: songs.size,
      listed: total,
    },
  };

  const index = { coverage: result.coverage };
  for (const key of ['playlists', 'songs', 'albums', 'artists', 'mvs']) {
    index[key] = result[key].map(item => ({
      item,
      text: text(
        key === 'songs'
          ? termsFor(item.song) +
              ' ' +
              item.sources.map(source => source.name).join(' ')
          : termsFor(item)
      ),
    }));
  }
  return index;
}
export function queryLibrary(index, query) {
  const terms = text(query).split(/\s+/).filter(Boolean);
  const result = { coverage: index.coverage };
  for (const key of ['playlists', 'songs', 'albums', 'artists', 'mvs'])
    result[key] = index[key]
      .filter(entry => terms.every(term => entry.text.includes(term)))
      .map(entry => entry.item);
  return result;
}
export function searchLibrary(liked, saved, tracks, query) {
  return queryLibrary(buildLibraryIndex(liked, saved, tracks), query);
}
export function libraryTrackIds(liked, saved) {
  const ids = new Set((liked.songs || []).map(String));
  const playlists = new Set(
    (liked.playlists || []).map(item => String(item.id))
  );
  for (const snapshot of saved) {
    if (!playlists.has(String(snapshot.playlist.id))) continue;
    for (const item of snapshot.playlist.trackIds ||
      snapshot.playlist.tracks ||
      [])
      ids.add(String(item.id));
  }
  return [...ids];
}
