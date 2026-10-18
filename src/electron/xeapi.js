// Adapted from api-enhanced util/crypto.js (MIT); see api-enhanced-LICENSE.txt.
const crypto = require('crypto');
const zlib = require('zlib');
const { TextDecoder } = require('util');
const eapiKey = Buffer.from('e82ckenh8dichen8');
const xeapiStaticKey = Buffer.from(
  'ab1d5a430f6bb04a3f01e81ddd72bd916d5ce591248ac128714806d7f8fb1b84',
  'hex'
);
const xeapiSignKey =
  'mUHCwVNWJbunMqAHf5MImuirT6plvs6VSFW62MGHstFQxhBGdEoIhLItH3djc4+FB/OKty3+lL2rGeoFBpVe5g==';
const x25519SpkiPrefix = Buffer.from('302a300506032b656e032100', 'hex');

const aesEcbEncrypt = (key, plaintext) => {
  // 某些运行时不允许使用 null 作为 IV，因此使用 Buffer.alloc(0) ,同时与上下文deriveX25519AesKey等函数保持一致
  const cipher = crypto.createCipheriv(
    `aes-${key.length * 8}-ecb`,
    key,
    Buffer.alloc(0)
  );
  return Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
};

const aesEcbDecrypt = (key, ciphertext) => {
  const decipher = crypto.createDecipheriv(
    `aes-${key.length * 8}-ecb`,
    key,
    Buffer.alloc(0)
  );
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

const createX25519PublicKey = raw => {
  // Node's crypto API expects X25519 public keys as DER SubjectPublicKeyInfo.
  // The Android SDK stores only the 32-byte raw key, so prepend the fixed
  // RFC 8410 SPKI header for id-X25519 before importing it.
  return crypto.createPublicKey({
    key: Buffer.concat([x25519SpkiPrefix, raw]),
    format: 'der',
    type: 'spki',
  });
};

const deriveX25519AesKey = (sharedSecret, ephemeralPublicKey) => {
  const prk = crypto
    .createHmac('sha256', Buffer.alloc(32))
    .update(sharedSecret.length ? sharedSecret : Buffer.alloc(32))
    .digest();
  return crypto
    .createHmac('sha256', prk)
    .update(Buffer.concat([ephemeralPublicKey, Buffer.from([1])]))
    .digest()
    .subarray(0, 16);
};

const xeapiSign = (timestamp, nonce) => {
  return crypto
    .createHmac('sha256', xeapiSignKey)
    .update(String(timestamp) + nonce)
    .digest('base64');
};

const xeapiMidTransform = ciphertext => {
  const random = crypto.randomBytes(16);
  const xored = Buffer.alloc(ciphertext.length);
  for (let i = 0; i < ciphertext.length; i++) {
    xored[i] = ciphertext[i] ^ random[i & 0x0f];
  }
  const rot = xored.length ? (random[0] & 0x0f) % xored.length : 0;
  return Buffer.concat([random, xored.subarray(rot), xored.subarray(0, rot)]);
};

const decoder = new TextDecoder('utf-8', { fatal: true });

const isUtf8 = buf => {
  try {
    decoder.decode(buf);
    return true;
  } catch {
    return false;
  }
};

const xeapiEncryptS = (dynamicKey, publicKeyState, os) => {
  const peerRaw = Buffer.from(publicKeyState.publicKey, 'base64');
  const peerKey = createX25519PublicKey(peerRaw);
  const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
  const ephemeralRaw = Buffer.from(
    publicKey.export({ format: 'der', type: 'spki' })
  ).subarray(-32);
  const sharedSecret = crypto.diffieHellman({
    privateKey,
    publicKey: peerKey,
  });
  const aesKey = deriveX25519AesKey(sharedSecret, ephemeralRaw);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKey, iv);
  const plaintext = Buffer.from(
    `${dynamicKey.toString('base64')}|${os}|${publicKeyState.sk || ''}`
  );
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([ephemeralRaw, iv, encrypted, cipher.getAuthTag()]);
};

const buildXeapiPlaintext = (uri, data, options = {}) => {
  const fields = {};
  const contentType =
    options.contentType || 'application/x-www-form-urlencoded;charset=utf-8';
  const mediaType = contentType.split(';', 1)[0].toLowerCase();
  if (mediaType !== 'application/x-www-form-urlencoded') {
    fields.contentType = contentType;
  }

  const method = (options.method || 'POST').toUpperCase();
  if (method !== 'POST') fields.method = method;

  const url = new URL(uri, 'https://interface.music.163.com');
  if (url.search) fields.queryString = url.search.slice(1);

  if (data !== undefined && data !== null) {
    const bodyData = { ...data };
    delete bodyData.e_r;
    const body = Buffer.from(new URLSearchParams(bodyData).toString());
    if (body.length) {
      if (mediaType === 'application/x-www-form-urlencoded' && isUtf8(body)) {
        fields.content = body.toString('utf8');
      } else {
        fields.body = body.toString('base64');
      }
    }
  }

  if (fields.queryString) {
    fields.queryString += '&e_r=true';
  } else {
    fields.queryString = 'e_r=true';
  }
  return JSON.stringify(fields);
};

const xeapi = (uri, data, options = {}) => {
  const publicKeyState = options.publicKeyState;
  if (!publicKeyState) {
    throw new Error('xeapi publicKeyState is required');
  }
  const activeSessionKey = options.sessionKey
    ? Buffer.from(String(options.sessionKey))
    : null;
  const activeSessionId = options.sessionId || '';
  const dynamicKey = activeSessionKey || crypto.randomBytes(16);
  const plaintext = Buffer.from(buildXeapiPlaintext(uri, data, options));

  const c = aesEcbEncrypt(
    dynamicKey,
    xeapiMidTransform(aesEcbEncrypt(xeapiStaticKey, plaintext))
  );
  const s = xeapiEncryptS(dynamicKey, publicKeyState, options.os || 'android');
  const r = aesEcbEncrypt(
    xeapiStaticKey,
    Buffer.from(
      `${publicKeyState.version}|${activeSessionKey ? activeSessionId : ''}`
    )
  );

  return {
    C: c
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_'),
    S: s.toString('base64'),
    R: r.toString('base64'),
  };
};

const xeapiResDecrypt = body => {
  const decrypted = aesEcbDecrypt(eapiKey, body);
  const plaintext =
    decrypted[0] === 0x1f && decrypted[1] === 0x8b
      ? zlib.gunzipSync(decrypted)
      : decrypted;
  return JSON.parse(plaintext.toString());
};

const xeapiDecryptPublicKey = encryptedData => {
  return JSON.parse(
    aesEcbDecrypt(
      xeapiStaticKey,
      Buffer.from(encryptedData, 'base64')
    ).toString()
  );
};

module.exports = { xeapi, xeapiSign, xeapiResDecrypt, xeapiDecryptPublicKey };
