const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('node:child_process');

const scripts = [
  'bin/pace-merge.js',
  'bin/pace-init.js',
  'bin/pace-workflow.js',
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

test('bin/pace-init.js --help reflects local-only recommended entry', () => {
  const target = path.resolve(__dirname, '..', 'bin/pace-init.js');
  const result = spawnSync(process.execPath, [target, '--help'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /当前推荐主路径/);
  assert.match(output, /local \+ pace-workflow\.js/);
  assert.match(output, /multica 仅为旧工具链兼容入口/);
});

test('bin/pace-merge.js --help reflects local-only recommended entry', () => {
  const target = path.resolve(__dirname, '..', 'bin/pace-merge.js');
  const result = spawnSync(process.execPath, [target, '--help'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /当前主路径推荐使用 `local`/);
  assert.match(output, /multica.*旧兼容配置/);
});
