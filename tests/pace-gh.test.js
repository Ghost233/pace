const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { parseIssueRef, resolveCommentBodySource } = require('../bin/pace-gh');

test('parseIssueRef supports issue numbers with a default repo', () => {
  assert.deepEqual(parseIssueRef('72', 'owner/repo'), {
    repo: 'owner/repo',
    number: 72,
    url: 'https://github.com/owner/repo/issues/72',
  });
});

test('parseIssueRef supports full GitHub issue URLs', () => {
  assert.deepEqual(parseIssueRef('https://github.com/owner/repo/issues/18'), {
    repo: 'owner/repo',
    number: 18,
    url: 'https://github.com/owner/repo/issues/18',
  });
});

test('parseIssueRef rejects invalid issue refs', () => {
  assert.throws(() => parseIssueRef('not-an-issue', 'owner/repo'), /无法解析 issue/);
});

test('resolveCommentBodySource supports inline bodies', () => {
  assert.deepEqual(resolveCommentBodySource({ body: 'hello' }), {
    mode: 'inline',
    value: 'hello',
  });
});

test('resolveCommentBodySource supports body files', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-gh-test-'));
  const file = path.join(dir, 'comment.md');
  fs.writeFileSync(file, 'comment body', 'utf8');

  assert.deepEqual(resolveCommentBodySource({ 'body-file': file }), {
    mode: 'file',
    value: file,
  });
});

test('resolveCommentBodySource rejects conflicting body sources', () => {
  assert.throws(
    () => resolveCommentBodySource({ body: 'hello', 'body-file': '/tmp/comment.md' }),
    /只能使用 --body 或 --body-file/
  );
});
