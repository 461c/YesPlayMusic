/* The API runs inside the Android app process, never on a public interface. */
const path = require('path');
const fs = require('fs');
const os = require('os');
process.chdir(__dirname);
process.env.NODE_ENV = 'production';
process.env.ENABLE_GENERAL_UNBLOCK = 'false';
process.env.CORS_ALLOW_ORIGIN = 'https://appassets.androidplatform.net';
// util/request reads this token synchronously when it is first loaded.
const tokenFile = path.join(os.tmpdir(), 'anonymous_token');
fs.mkdirSync(os.tmpdir(), { recursive: true });
if (!fs.existsSync(tokenFile)) fs.writeFileSync(tokenFile, '');
global.cnIp = require('@neteaseapireborn/api/util').generateRandomChineseIP();
const server = require('@neteaseapireborn/api/server');
const port = Number(process.env.YPM_API_PORT);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('Invalid local API port');
}
server
  .getModulesDefinitions(
    path.join(__dirname, 'node_modules/@neteaseapireborn/api/module'),
    {
      'daily_signin.js': '/daily_signin',
      'fm_trash.js': '/fm_trash',
      'personal_fm.js': '/personal_fm',
    }
  )
  .then(moduleDefs =>
    server.serveNcmApi({
      host: '127.0.0.1',
      port,
      checkVersion: false,
      moduleDefs: [
        {
          route: '/ypm/health',
          module: async () => ({
            status: 200,
            body: { code: 200, service: 'yesplaymusic-local-api' },
            cookie: [],
          }),
        },
        ...moduleDefs.map(definition =>
          definition.route === '/scrobble'
            ? { ...definition, module: require('./scrobble') }
            : definition
        ),
      ],
    })
  )
  .then(app => {
    app.server.on('error', error => {
      console.error('Local API failed:', error);
      process.exitCode = 1;
    });
    // Refresh guest credentials without delaying startup when the phone is offline.
    require('@neteaseapireborn/api/generateConfig')().catch(console.error);
  })
  .catch(error => {
    console.error('Local API failed:', error);
    process.exitCode = 1;
  });
