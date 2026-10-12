const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const artifactRepo = path.resolve(process.env.WIN64_ARTIFACT_BRANCH_PATH);
const sourceSha = process.env.WIN64_SOURCE_SHA;
const runUrl = process.env.WIN64_RUN_URL;
const version = require('../../package.json').version;

if (!/^[a-f0-9]{40}$/.test(sourceSha || '') || !runUrl) {
  throw new Error('A source commit SHA and workflow run URL are required.');
}

function git(args) {
  return execFileSync('git', args, {
    cwd: artifactRepo,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  }).trim();
}

if (git(['branch', '--show-current']) !== 'win64') {
  throw new Error('The artifact checkout must be on the win64 branch.');
}

const masterSha = git(['ls-remote', 'origin', 'refs/heads/master']).split(
  /\s/
)[0];
if (masterSha !== sourceSha) {
  console.log('Skipping an outdated build: master has a newer commit.');
  process.exit(0);
}

const buildDir = path.resolve('dist_electron');
const installers = fs
  .readdirSync(buildDir)
  .filter(name => /^YesPlayMusic-Setup-.*-x64\.exe$/.test(name));
if (installers.length !== 1) {
  throw new Error(
    `Expected one Windows x64 Setup, found ${installers.length}.`
  );
}

const installerName = 'YesPlayMusic-Setup-x64.exe';
const installer = fs.readFileSync(path.join(buildDir, installers[0]));
if (installer.length < 2 || installer.toString('ascii', 0, 2) !== 'MZ') {
  throw new Error('The installer is not a Windows executable.');
}
const sha256 = crypto.createHash('sha256').update(installer).digest('hex');
fs.writeFileSync(path.join(artifactRepo, installerName), installer);
fs.writeFileSync(
  path.join(artifactRepo, `${installerName}.sha256`),
  `${sha256}  ${installerName}\n`
);

// GitHub rejects regular Git files over 100 MiB. Use LFS before that limit.
if (installer.length >= 95 * 1024 * 1024) {
  git(['lfs', 'install', '--local']);
  git(['lfs', 'track', '*.exe']);
} else if (fs.existsSync(path.join(artifactRepo, '.gitattributes'))) {
  git(['lfs', 'install', '--local']);
}

fs.writeFileSync(
  path.join(artifactRepo, 'build-info.json'),
  JSON.stringify(
    {
      version,
      platform: 'win32',
      arch: 'x64',
      target: 'nsis',
      sourceSha,
      runUrl,
      builtAt: new Date().toISOString(),
      installer: installerName,
      originalName: installers[0],
      size: installer.length,
      sha256,
    },
    null,
    2
  ) + '\n'
);

git(['config', 'user.name', 'github-actions[bot]']);
git([
  'config',
  'user.email',
  '41898282+github-actions[bot]@users.noreply.github.com',
]);
git(['add', installerName, `${installerName}.sha256`, 'build-info.json']);
if (fs.existsSync(path.join(artifactRepo, '.gitattributes'))) {
  git(['add', '.gitattributes']);
}
git([
  'commit',
  '-m',
  `build(win64): ${version} from ${sourceSha.slice(0, 12)}`,
]);
git(['push', 'origin', 'HEAD:win64']);
console.log(`Published ${installerName} (${sha256}) to win64.`);
