const test = require('node:test');
const assert = require('node:assert/strict');

const { ensureBinary, probe, run } = require('../bin/lib/exec');

test('run returns trimmed stdout', () => {
  const output = run(process.execPath, ['-e', "console.log('ok')"], { timeoutMs: 1_000 });
  assert.equal(output, 'ok');
});

test('probe returns fallback when command exits non-zero', () => {
  const output = probe(process.execPath, ['-e', 'process.exit(2)'], { fallback: 'fallback' });
  assert.equal(output, 'fallback');
});

test('run surfaces timeout errors', () => {
  assert.throws(
    () => run(process.execPath, ['-e', 'setTimeout(() => {}, 200)'], { timeoutMs: 50 }),
    /命令执行超时/
  );
});

test('ensureBinary rejects missing commands', () => {
  assert.throws(
    () => ensureBinary('pace-binary-that-should-not-exist'),
    /未安装/
  );
});
