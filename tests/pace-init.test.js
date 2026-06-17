const test = require('node:test');
const assert = require('node:assert/strict');

const { branchMatchesGitHubIssuePattern, branchMentionsIssueNumber, buildConfig, mustRunCommand, probeCommand } = require('../bin/pace-init');

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

test('pace-init rejects non-local modes', () => {
  assert.throws(
    () => buildConfig('external', {}),
    /不支持的模式: external/
  );
});

test('pace-init defaults to local mode when mode is omitted', () => {
  const built = buildConfig({ branch: 'agent/default-mode' });
  assert.equal(built.context.session.mode, 'local');
  assert.equal(built.context.git.branch, 'agent/default-mode');
});

test('pace-init branch helper still detects issue number token', () => {
  assert.equal(branchMentionsIssueNumber('issue-80-profile-qr-theme-fix', 80), true);
  assert.equal(branchMentionsIssueNumber('bugfix/issue-80-profile-qr-theme-fix', 80), true);
  assert.equal(branchMentionsIssueNumber('profile-qr-theme-fix', 80), false);
});

test('pace-init github branch naming must use agent/github/issue-number prefix', () => {
  assert.equal(branchMatchesGitHubIssuePattern('agent/github/issue-80-profile-qr-theme-fix', 80), true);
  assert.equal(branchMatchesGitHubIssuePattern('agent/github/issue-80', 80), true);
  assert.equal(branchMatchesGitHubIssuePattern('issue-80-profile-qr-theme-fix', 80), false);
  assert.equal(branchMatchesGitHubIssuePattern('agent/local/issue-80-profile-qr-theme-fix', 80), false);
});
