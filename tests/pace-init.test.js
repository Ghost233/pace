const test = require('node:test');
const assert = require('node:assert/strict');

const { mustRunCommand, probeCommand } = require('../bin/pace-init');

test('pace-init probeCommand keeps optional probes non-fatal', () => {
  const output = probeCommand(process.execPath, ['-e', 'process.exit(2)']);
  assert.equal(output, '');
});

test('pace-init mustRunCommand preserves hard-failure details', () => {
  assert.throws(
    () => mustRunCommand(process.execPath, ['-e', "process.stderr.write('boom\\n'); process.exit(2)"]),
    /命令执行失败|boom/
  );
});
