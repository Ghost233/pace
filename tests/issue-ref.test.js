const test = require('node:test');
const assert = require('node:assert/strict');

const { parseIssueRef } = require('../bin/lib/issue-ref');

test('shared parseIssueRef supports issue numbers with a default repo', () => {
  assert.deepEqual(parseIssueRef('72', 'owner/repo'), {
    repo: 'owner/repo',
    number: 72,
    url: 'https://github.com/owner/repo/issues/72',
  });
});

test('shared parseIssueRef supports full GitHub issue URLs', () => {
  assert.deepEqual(parseIssueRef('https://github.com/owner/repo/issues/18'), {
    repo: 'owner/repo',
    number: 18,
    url: 'https://github.com/owner/repo/issues/18',
  });
});

test('shared parseIssueRef rejects invalid issue refs', () => {
  assert.throws(() => parseIssueRef('not-an-issue', 'owner/repo'), /无法解析 issue/);
});
