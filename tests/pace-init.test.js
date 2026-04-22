const test = require('node:test');
const assert = require('node:assert/strict');

const { branchMentionsIssueNumber, buildConfig, mustRunCommand, probeCommand } = require('../bin/pace-init');

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

test('pace-init multica still requires explicit github user repo branch and git identity inputs', () => {
  assert.throws(
    () =>
      buildConfig('multica', {
        'issue-url': 'https://github.com/Conso-xFinite/Telegram-iOS/issues/72',
        'issue-title': '修复发送按钮消失',
        'issue-type': 'bug',
        'current-role': 'PACE-需求接管经理',
      }),
    /--repo[\s\S]*--branch[\s\S]*--github-user[\s\S]*--git-name[\s\S]*--git-email/
  );
});

test('pace-init branch helper still detects issue number token', () => {
  assert.equal(branchMentionsIssueNumber('issue-80-profile-qr-theme-fix', 80), true);
  assert.equal(branchMentionsIssueNumber('bugfix/issue-80-profile-qr-theme-fix', 80), true);
  assert.equal(branchMentionsIssueNumber('profile-qr-theme-fix', 80), false);
});
