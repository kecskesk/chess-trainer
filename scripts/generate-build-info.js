const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getCommitHash() {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
  } catch {
    return 'unknown';
  }
}

function writeBuildInfo() {
  const targetPath = path.join(__dirname, '..', 'src', 'environments', 'build-info.ts');
  const commitHash = getCommitHash();
  const builtAtIso = new Date().toISOString();

  const content =
    'export const buildInfo = {\n' +
    `  builtAtIso: '${builtAtIso}',\n` +
    `  commitHash: '${commitHash}'\n` +
    '};\n';

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`[build-info] wrote ${targetPath}`);
}

writeBuildInfo();
