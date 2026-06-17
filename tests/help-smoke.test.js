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

test('bin/pace-init.js --help reflects default entry', () => {
  const target = path.resolve(__dirname, '..', 'bin/pace-init.js');
  const result = spawnSync(process.execPath, [target, '--help'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /用法: node <pace-bin>\/pace-init\.js \[参数\]/);
  assert.doesNotMatch(output, /<local>/);
  assert.doesNotMatch(output, /外部编排/);
});

test('bin/pace-merge.js --help reflects default entry', () => {
  const target = path.resolve(__dirname, '..', 'bin/pace-merge.js');
  const result = spawnSync(process.execPath, [target, '--help'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
  });
  const output = `${result.stdout}\n${result.stderr}`;

  assert.equal(result.status, 0, output);
  assert.match(output, /用法: node <pace-bin>\/pace-merge\.js/);
  assert.doesNotMatch(output, /<local>/);
  assert.doesNotMatch(output, /旧兼容配置/);
});
