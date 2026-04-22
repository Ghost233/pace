const test = require('node:test');
const assert = require('node:assert/strict');

const { fetchIssueComments, parsePhaseIssueBody, renderDocBody } = require('../bin/pace-issue-doc');

test('renderDocBody builds a sectioned phase document body', () => {
  const body = renderDocBody({
    title: 'issue-54-phase-01',
    section: 'plan',
    body: 'Plan body',
  });

  assert.match(body, /<!-- PACE:PHASE-DOC -->/);
  const sections = parsePhaseIssueBody(body);
  assert.equal(sections.plan, 'Plan body');
  assert.equal(sections.context, '待补充。');
});

test('renderDocBody updates a single section without clobbering others', () => {
  const initial = renderDocBody({
    title: 'issue-54-phase-01',
    section: 'context',
    body: 'Context body',
  });

  const updated = renderDocBody({
    title: 'issue-54-phase-01',
    section: 'plan',
    body: 'Plan body',
    existingBody: initial,
  });

  const sections = parsePhaseIssueBody(updated);
  assert.equal(sections.context, 'Context body');
  assert.equal(sections.plan, 'Plan body');
});

test('fetchIssueComments paginates until final partial page', () => {
  const calls = [];
  const pages = [
    Array.from({ length: 2 }, (_, index) => ({ id: index + 1 })),
    [{ id: 3 }],
  ];

  const comments = fetchIssueComments('owner/repo', 72, {
    perPage: 2,
    runner(args) {
      calls.push(args);
      return pages[calls.length - 1];
    },
  });

  assert.equal(calls.length, 2);
  assert.equal(comments.length, 3);
  assert.match(calls[0][1], /page=1/);
  assert.match(calls[1][1], /page=2/);
});
