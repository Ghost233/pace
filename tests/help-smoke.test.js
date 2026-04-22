const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('node:child_process');

const scripts = [
  'bin/pace-init.js',
  'bin/pace-git.js',
  'bin/pace-gh.js',
  'bin/pace-multica.js',
  'bin/pace-issue-doc.js',
];

for (const script of scripts) {
  test(`${script} --help exits cleanly`, () => {
    const target = path.resolve(__dirname, '..', script);
    const result = spawnSync(process.execPath, [target, '--help'], {
      cwd: path.resolve(__dirname, '..'),
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, /用法:/);
  });
}
