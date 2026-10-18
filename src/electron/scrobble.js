// NCBL client logs, matching api-enhanced's scrobble_v1 (MIT).
// HTTP 200 alone is not acceptance: both uploaded filenames must be acknowledged.
const ncbl = require('./ncbl');
const crypto = require('crypto');
const deviceId = crypto.randomBytes(16).toString('hex');
module.exports = async query => {
  const id = String(query.id || '');
  const time = Math.round(Number(query.time) || 0);
  if (!/^\d+$/.test(id) || time < 1)
    return {
      status: 400,
      body: { code: 400, msg: 'invalid song id or listening time' },
    };
  const cookie = { ...ncbl.parseCookie(query.cookie) };
  if (!cookie.MUSIC_U)
    return { status: 200, body: { code: 200, data: 'skipped' }, cookie: [] };
  cookie.os = 'pc';
  cookie.deviceId = cookie.deviceId || global.deviceId || deviceId;
  const ctx = ncbl.extractContext(cookie);
  const total = Math.max(time, Number(query.total) || time);
  const song = {
    id,
    name: query.name || '',
    artist: query.artist || '',
    time: total,
    bitrate: Number(query.bitrate) || 320,
    level: query.level || 'exhigh',
  };
  const source = {
    id: /^\d+$/.test(String(query.sourceid)) ? String(query.sourceid) : id,
    name: 'list',
    type: 'track',
  };
  const ts = Math.floor(Date.now() / 1000);
  try {
    for (const action of ['_plv', '_pld']) {
      const data =
        action === '_plv'
          ? ncbl.buildPlv(ctx, song, source)
          : ncbl.buildPld(ctx, song, source, time);
      const result = await ncbl.doUpload(
        ctx,
        ncbl.buildMetaJson(ctx),
        ncbl.buildRecords([{ time: ts, action, data }]),
        ncbl.buildCookieStr(ctx),
        action
      );
      if (!result.success) throw new Error(action + ' upload not acknowledged');
    }
    return { status: 200, body: { code: 200, data: 'success' }, cookie: [] };
  } catch (error) {
    // Never forward an auth status that could log out the listener.
    return {
      status: 200,
      body: { code: 500, data: null, msg: error.message },
      cookie: [],
    };
  }
};
