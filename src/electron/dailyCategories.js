// Read-only daily category endpoints from api-enhanced 4.41.1 (MIT).
// Use the Android XEAPI protocol; the locked upstream package predates it.
const axios = require('axios');
const crypto = require('crypto');
const enc = require('./xeapi');
const { parseCookie } = require('./ncbl');
const device = crypto.randomBytes(16).toString('hex');
let keyPromise;
const ua =
  'NeteaseMusic/9.5.61.260802021928(9005061);Dalvik/2.1.0 (Linux; U; Android 12; HBN-AL00 Build/cd737a2.0)';
async function publicKey() {
  if (!keyPromise)
    keyPromise = (async () => {
      const nonce = Array.from(crypto.randomBytes(16), b =>
        String(b % 10)
      ).join('');
      const timestamp = String(Date.now());
      const response = await axios({
        method: 'POST',
        url: 'https://interface.music.163.com/api/bsr/sk/get',
        headers: {
          'User-Agent': ua,
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: 'deviceId=' + device,
        },
        data: new URLSearchParams({
          appVersion: '9.5.61',
          currentKeyVersion: '',
          deviceId: device,
          nonce,
          os: 'android',
          requestType: 'active',
          signature: enc.xeapiSign(timestamp, nonce),
          t1: '',
          t2: '',
          timestamp,
          uid: '',
        }).toString(),
        timeout: 15000,
        proxy: false,
      });
      const data = response.data && response.data.data;
      if (
        !data ||
        response.data.code !== 200 ||
        enc.xeapiSign(data.timestamp, nonce) !== data.signature
      )
        throw new Error('分类接口密钥校验失败');
      const key = enc.xeapiDecryptPublicKey(data.encryptedData);
      if (!key.sk || !key.publicKey) throw new Error('分类接口密钥不完整');
      return key;
    })().catch(error => {
      keyPromise = null;
      throw error;
    });
  return keyPromise;
}
function endpoint(uri) {
  return async query => {
    try {
      const cookie = {
        ...parseCookie(query.cookie),
        os: 'android',
        appver: '9.5.61',
        osver: '12',
        deviceId: device,
        sDeviceId: device,
      };
      if (!cookie.MUSIC_U) throw new Error('请先登录网易云账号');
      const fields = enc.xeapi(
        uri,
        {},
        { publicKeyState: await publicKey(), os: 'android' }
      );
      const response = await axios({
        method: 'POST',
        url: 'https://interface3.music.163.com/xeapi/' + uri.slice(5),
        data: new URLSearchParams(fields).toString(),
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': ua,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          'X-Client-Enc-State': 'ENCRYPTED',
          'x-aeapi': 'true',
          'x-deviceid': device,
          'x-sdeviceid': device,
          'x-os': 'android',
          'x-osver': '12',
          'x-appver': '9.5.61',
          'x-buildver': String(Date.now()).slice(0, 10),
          'x-music-u': cookie.MUSIC_U,
          Cookie: Object.keys(cookie)
            .map(k => k + '=' + cookie[k])
            .join('; '),
        },
        timeout: 15000,
        proxy: false,
      });
      let body;
      try {
        body = JSON.parse(Buffer.from(response.data).toString());
      } catch (_) {
        body = enc.xeapiResDecrypt(Buffer.from(response.data));
      }
      return { status: 200, body, cookie: [] };
    } catch (error) {
      return {
        status: 200,
        body: { code: 500, message: error.message },
        cookie: [],
      };
    }
  };
}
module.exports = {
  configs: endpoint('/api/homepage/daily/song/config/get'),
  songs: endpoint('/api/homepage/category/daily/song/list'),
};
