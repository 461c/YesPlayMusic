// Manual settings-only snapshots inside a valid MP3's private ID3 tag.
const crypto = require('crypto');
const axios = require('axios');
const cloudList = require('@neteaseapireborn/api/module/user_cloud');
const cloudUpload = require('@neteaseapireborn/api/module/cloud');
const cloudDelete = require('@neteaseapireborn/api/module/user_cloud_del');
const downloadUrl = require('@neteaseapireborn/api/module/song_download_url');
const playerUrl = require('@neteaseapireborn/api/module/song_url');
const silence = Buffer.from(require('./settings-silence.json'), 'base64');
const legacyFilename = 'YesPlayMusic-Settings.mp3';
const backupPrefix = 'YPM设置备份-';
const nameCharacters =
  '春夏秋冬山川星月清风云海松竹兰荷晴雨晨暮溪石花叶雪霜青白飞流湖林远近明静光影';
function randomName() {
  return (
    backupPrefix +
    Array.from(
      crypto.randomBytes(6),
      byte => nameCharacters[byte % nameCharacters.length]
    ).join('')
  );
}
function textFrame(text) {
  return Buffer.concat([
    Buffer.from([1, 255, 254]),
    Buffer.from(text, 'utf16le'),
  ]);
}
const owner = 'YesPlayMusic.Settings';
const busy = new Set();
function clean(value, depth = 0) {
  if (depth > 12) throw new Error('设置结构过深');
  if (value === null || ['string', 'boolean', 'number'].includes(typeof value))
    return value;
  if (Array.isArray(value)) return value.map(item => clean(item, depth + 1));
  if (!value || typeof value !== 'object') throw new Error('设置格式无效');
  const result = Object.create(null);
  for (const key of Object.keys(value))
    if (
      !/cookie|token|password|secret|^(__proto__|constructor|prototype)$/i.test(
        key
      )
    )
      result[key] = clean(value[key], depth + 1);
  return result;
}
function digest(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}
function frame(name, data) {
  const header = Buffer.alloc(10);
  header.write(name);
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}
function cleanPeople(people) {
  if (!Array.isArray(people)) return [];
  const seen = new Set();
  return people
    .filter(person => {
      const id = String((person && person.id) || '');
      if (!/^[1-9]\d{0,17}$/.test(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 500)
    .map(person => ({
      id: String(person.id),
      alias: String(person.alias || '').slice(0, 100),
      name: String(person.name || '').slice(0, 100),
    }));
}
function encode(settings, title = randomName(), people = []) {
  const text = JSON.stringify(clean(settings));
  if (Buffer.byteLength(text) > 65536) throw new Error('设置超过 64KB');
  const envelope = JSON.stringify({
    format: owner,
    version: 2,
    savedAt: Date.now(),
    checksum: digest(
      JSON.stringify({
        settings: JSON.parse(text),
        people: cleanPeople(people),
      })
    ),
    people: cleanPeople(people),
    settings: JSON.parse(text),
  });
  const tag = Buffer.concat([
    frame('TIT2', textFrame(title)),
    frame('TPE1', Buffer.from('\0YesPlayMusic')),
    frame('TALB', Buffer.from('\0YesPlayMusic Settings Backup')),
    frame(
      'PRIV',
      Buffer.concat([Buffer.from(owner + '\0'), Buffer.from(envelope)])
    ),
  ]);
  const header = Buffer.from([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]);
  for (let i = 0; i < 4; i++) header[9 - i] = (tag.length >>> (7 * i)) & 127;
  return Buffer.concat([header, tag, silence]);
}
function decode(bytes) {
  if (
    bytes.length > 2097152 ||
    bytes.slice(0, 3).toString() !== 'ID3' ||
    bytes[3] !== 3
  )
    throw new Error('云盘文件不是可恢复的设置备份');
  const length =
    ((bytes[6] & 127) << 21) |
    ((bytes[7] & 127) << 14) |
    ((bytes[8] & 127) << 7) |
    (bytes[9] & 127);
  if (length > 131072 || 10 + length > bytes.length)
    throw new Error('设置标签不完整');
  for (let offset = 10; offset + 10 <= 10 + length; ) {
    const name = bytes.slice(offset, offset + 4).toString(),
      size = bytes.readUInt32BE(offset + 4);
    if (!size || offset + 10 + size > 10 + length) break;
    const data = bytes.slice(offset + 10, offset + 10 + size);
    offset += 10 + size;
    if (
      name !== 'PRIV' ||
      data.slice(0, owner.length + 1).toString() !== owner + '\0'
    )
      continue;
    const envelope = JSON.parse(data.slice(owner.length + 1).toString());
    if (
      envelope.format !== owner ||
      ![1, 2].includes(envelope.version) ||
      !envelope.settings ||
      typeof envelope.settings !== 'object' ||
      Array.isArray(envelope.settings)
    )
      throw new Error('设置备份版本不支持');
    if (
      digest(
        JSON.stringify(
          envelope.version === 1
            ? envelope.settings
            : { settings: envelope.settings, people: envelope.people }
        )
      ) !== envelope.checksum
    )
      throw new Error('设置备份校验失败');
    envelope.settings = clean(envelope.settings);
    if (envelope.version === 2) envelope.people = cleanPeople(envelope.people);
    return envelope;
  }
  throw new Error('云盘文件中的设置标签已丢失，未修改当前设置');
}
function isBackup(item) {
  const name = String(item.fileName || '');
  const title = String(
    item.songName || (item.simpleSong && item.simpleSong.name) || ''
  );
  const marked =
    item.album === 'YesPlayMusic Settings Backup' ||
    item.artist === 'YesPlayMusic';
  return (
    marked &&
    (name === legacyFilename ||
      title === 'YesPlayMusic Settings' ||
      /^YPM设置备份-[\u4e00-\u9fff]{6}(?:\.mp3)?$/.test(name) ||
      /^YPM设置备份-[\u4e00-\u9fff]{6}$/.test(title))
  );
}
function cloudId(item) {
  return (
    item && (item.songId || (item.simpleSong && item.simpleSong.id) || item.id)
  );
}

async function handler(query, request) {
  const cookie = query.cookie || {};
  if (!cookie.MUSIC_U)
    return {
      status: 200,
      body: { code: 500, message: '请先登录网易云账号' },
      cookie: [],
    };
  const key = digest(cookie.MUSIC_U);
  if (busy.has(key))
    return {
      status: 200,
      body: { code: 500, message: '设置同步正在进行' },
      cookie: [],
    };
  busy.add(key);
  const options = { cookie, realIP: query.realIP };
  async function call(module, params) {
    const response = await module(Object.assign({}, options, params), request);
    if (!response.body || response.body.code !== 200)
      throw new Error(
        (response.body && (response.body.message || response.body.msg)) ||
          '云盘接口请求失败'
      );
    return response.body;
  }
  async function list() {
    const result = [];
    for (let offset = 0; offset < 100000; offset += 1000) {
      const body = await call(cloudList, { limit: 1000, offset });
      if (!Array.isArray(body.data)) throw new Error('云盘列表不完整');
      result.push(...body.data.filter(isBackup));
      if (!body.hasMore && !body.more) return result;
      if (!body.data.length) throw new Error('云盘分页异常');
    }
    throw new Error('云盘过大，请稍后重试');
  }
  async function read(id) {
    for (const module of [downloadUrl, playerUrl]) {
      try {
        const body = await call(module, { id: String(id), br: 999000 });
        const info = Array.isArray(body.data) ? body.data[0] : body.data;
        const url = info && info.url;
        if (
          !url ||
          !/^https?:$/.test(new URL(url).protocol) ||
          !/(^|\.)(music\.126\.net|nosdn\.127\.net|nos\.netease\.com)$/.test(
            new URL(url).hostname
          )
        )
          continue;
        const response = await axios({
          url,
          responseType: 'arraybuffer',
          maxContentLength: 2097152,
          maxRedirects: 0,
          timeout: 30000,
          proxy: false,
        });
        return decode(Buffer.from(response.data));
      } catch (_) {
        /* A stream may have stripped ID3 tags; never apply an unverified backup. */
      }
    }
    throw new Error('无法完整读取设置 MP3，保留现有设置和原备份');
  }
  let createdId = null,
    old = [],
    verifiedNew = false;
  try {
    if (!['export', 'import'].includes(query.operation))
      throw new Error('请选择导入或导出');
    old = await list();
    if (query.operation === 'import') {
      if (!old.length) throw new Error('云盘中没有设置备份');
      const sorted = old
        .slice()
        .sort((a, b) => (b.addTime || 0) - (a.addTime || 0));
      for (const item of sorted) {
        try {
          return {
            status: 200,
            body: { code: 200, snapshot: await read(cloudId(item)) },
            cookie: [],
          };
        } catch (_) {
          /* Try a retained older snapshot. */
        }
      }
      throw new Error('云盘备份无法校验，未修改当前设置');
    }
    const settings =
      typeof query.settings === 'string'
        ? JSON.parse(query.settings)
        : query.settings;
    if (!settings || typeof settings !== 'object' || Array.isArray(settings))
      throw new Error('设置格式无效');
    const title = randomName();
    const filename = title + '.mp3';
    const people = cleanPeople(
      typeof query.people === 'string' ? JSON.parse(query.people) : query.people
    );
    const data = encode(settings, title, people);
    const uploaded = await call(cloudUpload, {
      songFile: {
        // Upstream cloud.js decodes multipart names from Latin-1 to UTF-8.
        name: Buffer.from(filename, 'utf8').toString('latin1'),
        data,
        size: data.length,
        md5: crypto.createHash('md5').update(data).digest('hex'),
        mimetype: 'audio/mpeg',
      },
    });
    const after = await list();
    const added = after.find(
      item => item.fileName === filename || item.songName === title
    );
    // The upload-check ID may differ from the final published cloud song ID.
    createdId =
      cloudId(added) ||
      (uploaded.privateCloud && cloudId(uploaded.privateCloud)) ||
      (uploaded.data &&
        uploaded.data.privateCloud &&
        cloudId(uploaded.data.privateCloud)) ||
      uploaded.songId;
    if (!createdId) throw new Error('没有取得新备份编号，保留原备份');
    const verified = await read(createdId);
    if (
      JSON.stringify(verified.settings) !== JSON.stringify(clean(settings)) ||
      JSON.stringify(verified.people) !== JSON.stringify(people)
    )
      throw new Error('云盘备份内容不一致，保留原备份');
    verifiedNew = true;
    const obsolete = [
      ...new Set(
        [...old, ...after]
          .map(cloudId)
          .filter(id => id && String(id) !== String(createdId))
          .map(String)
      ),
    ];
    const retained = [];
    for (const id of obsolete) {
      // user_cloud_del wraps query.id in an array itself: never pass comma-joined IDs.
      try {
        await call(cloudDelete, { id });
      } catch (_) {
        retained.push(id);
      }
    }
    const warning = retained.length
      ? '最新设置已保存并校验，但有 ' +
        retained.length +
        ' 个旧备份未能清理；下次手动导出会再尝试'
      : '';

    return {
      status: 200,
      body: { code: 200, savedAt: verified.savedAt, warning },
      cookie: [],
    };
  } catch (error) {
    // Roll back only the new backup; user music and the previous backup are untouched.
    if (
      !verifiedNew &&
      createdId &&
      !old.some(item => String(cloudId(item)) === String(createdId))
    ) {
      try {
        await call(cloudDelete, { id: String(createdId) });
      } catch (_) {
        /* Next manual export will clean retained duplicates. */
      }
    }
    return {
      status: 200,
      body: { code: 500, message: error.message || '设置同步失败' },
      cookie: [],
    };
  } finally {
    busy.delete(key);
  }
}
module.exports = handler;
module.exports.encode = encode;
module.exports.decode = decode;
module.exports.clean = clean;
