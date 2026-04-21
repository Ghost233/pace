#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadSession } = require('./lib/pace-config');
const { ensureGithubSession, run } = require('./lib/github-cli');

const DEFAULT_MAX_CHARS = 60000;
const PHASE_SECTION_TITLES = {
  'tracking-summary': 'Tracking Summary',
  'requirement-summary': 'Requirement Summary',
  context: 'Context',
  'discussion-log': 'Discussion Log',
  plan: 'Plan',
  execution: 'Execution',
  verification: 'Verification',
  'archive-status': 'Archive Status',
};
const PHASE_SECTION_ORDER = [
  'tracking-summary',
  'requirement-summary',
  'context',
  'discussion-log',
  'plan',
  'execution',
  'verification',
  'archive-status',
];

function usage(exitCode = 0) {
  const text = [
    '用法: node <pace-bin>/pace-issue-doc.js <命令> [参数]',
    '',
    '作用:',
    '  管理 PACE 的 issue 文档层。',
    '  在 multica + github 模式下，维护：业务主 issue -> 文档 root issue -> 文档 issue。',
    '  用文档 root issue 维护索引，用文档 issue body 保存最新版正文，用 comment 保存审计记录。',
    '  创建或更新文档后，会自动把 root issue 与文档索引回填到主 issue comment。',
    '  默认限制 body 长度不超过 60000 字符。',
    '',
    '允许的命令:',
    '  ensure-root --issue <url|number> [--title <title>]',
    '  resolve-init --issue <url|number> [--format <command|args|json>]',
    '  upsert-doc --issue <url|number> --doc-key <key> --title <title> [--body-file <path>] [--audit-file <path>] [--section <key>] [--max-chars <n>]',
    '  check-body --body-file <path> [--max-chars <n>]',
    '  append-audit --issue <url|number> --body-file <path>',
    '',
    '说明:',
    '  - 除 resolve-init 外，其余命令只操作当前 session 配置的 GitHub 仓库',
    '  - body 超过上限直接拒绝，不自动截断',
    '  - ensure-root 会创建或更新主文档 root issue，并同步初始化参数文档 issue',
    '  - resolve-init 会从主 issue 的受控索引 comment / root issue / init-params issue 解析初始化参数',
    '  - upsert-doc 会创建或更新某个文档 issue，并把链接/修订同步回 root issue 与主 issue comment',
    '  - upsert-doc 带 --section 时，会把正文更新到 phase 文档 issue 的对应 section；不带 --section 时仍按整篇正文处理',
    '  - 文档之间只通过 root issue 与主 issue comment 中的链接索引关联，不依赖 GitHub sub-issue 功能',
    '  - 在 multica + github 下，低层 create-doc / update-body 已被禁用，避免绕过索引回填',
    '',
    '示例:',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue 54',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" resolve-init --issue 54',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" resolve-init --issue https://github.com/owner/repo/issues/54 --format args',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" upsert-doc --issue 54 --doc-key phase-01 --title "issue-54-phase-01" --section tracking-summary --body-file /tmp/tracking.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" upsert-doc --issue 54 --doc-key phase-01 --title "issue-54-phase-01" --section plan --body-file /tmp/plan.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" check-body --body-file /tmp/doc.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" append-audit --issue 72 --body-file /tmp/audit.md',
  ].join('\n');
  console.error(text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    usage(0);
  }
  const [command, ...rest] = argv;
  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith('--')) {
      throw new Error(`无法解析参数: ${arg}`);
    }
    const key = arg.slice(2);
    const value = rest[i + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`参数缺少值: ${arg}`);
    }
    options[key] = value;
    i += 1;
  }
  return { command, options };
}

function parseIssueRef(issueRef, defaultRepo) {
  if (!issueRef) {
    throw new Error('缺少 issue 参数');
  }
  if (/^\d+$/.test(issueRef)) {
    if (!defaultRepo) {
      throw new Error('当前未配置 GitHub repo，不能只传 issue number');
    }
    return {
      repo: defaultRepo,
      number: Number(issueRef),
      url: `https://github.com/${defaultRepo}/issues/${issueRef}`,
    };
  }
  const match = issueRef.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)(?:[/?#].*)?$/);
  if (!match) {
    throw new Error(`无法解析 issue: ${issueRef}`);
  }
  return {
    repo: match[1],
    number: Number(match[2]),
    url: issueRef,
  };
}

function ensureSameRepo(targetRepo, sessionRepo) {
  if (sessionRepo && targetRepo !== sessionRepo) {
    throw new Error(`目标 issue 不属于当前 session 仓库: ${targetRepo}`);
  }
}

function readBodyFile(filePath) {
  if (!filePath) {
    throw new Error('缺少 --body-file');
  }
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`正文文件不存在: ${resolved}`);
  }
  return {
    path: resolved,
    body: fs.readFileSync(resolved, 'utf8'),
  };
}

function countChars(text) {
  return Array.from(text).length;
}

function resolveMaxChars(rawValue) {
  if (!rawValue) return DEFAULT_MAX_CHARS;
  if (!/^\d+$/.test(rawValue)) {
    throw new Error('--max-chars 必须是正整数');
  }
  return Number(rawValue);
}

function ensureBodyWithinLimit(body, maxChars) {
  const count = countChars(body);
  if (count > maxChars) {
    throw new Error(`正文过长: ${count} > ${maxChars}`);
  }
  return count;
}

function normalizeSectionKey(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function getPhaseSectionTitle(sectionKey) {
  const normalized = normalizeSectionKey(sectionKey);
  return PHASE_SECTION_TITLES[normalized] || normalized.replace(/(^|-)([a-z])/g, (_, prefix, ch) => `${prefix === '-' ? ' ' : ''}${ch.toUpperCase()}`);
}

function ensureAllowedSection(sectionKey) {
  const normalized = normalizeSectionKey(sectionKey);
  if (!normalized) return '';
  if (!Object.prototype.hasOwnProperty.call(PHASE_SECTION_TITLES, normalized)) {
    throw new Error(`不支持的 --section: ${sectionKey}；只允许 ${PHASE_SECTION_ORDER.join(', ')}`);
  }
  return normalized;
}

function emptySectionText() {
  return '待补充。';
}

function buildPhaseIssueBody(title, sectionBodies = {}) {
  const lines = [`# ${title}`, '', '<!-- PACE:PHASE-DOC -->', ''];
  for (const key of PHASE_SECTION_ORDER) {
    lines.push(`## ${getPhaseSectionTitle(key)}`);
    lines.push(sectionBodies[key] || emptySectionText());
    lines.push('');
  }
  return lines.join('\n');
}

function parsePhaseIssueBody(body) {
  if (!body.includes('<!-- PACE:PHASE-DOC -->')) {
    return null;
  }
  const sections = {};
  const regex = /^## (.+)$/gm;
  const matches = [...body.matchAll(regex)];
  if (!matches.length) {
    return null;
  }
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const start = current.index + current[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const title = current[1].trim();
    const key = Object.entries(PHASE_SECTION_TITLES).find(([, value]) => value === title)?.[0] || normalizeSectionKey(title);
    sections[key] = body.slice(start, end).trim() || emptySectionText();
  }
  return sections;
}

function renderDocBody(options) {
  if (!options.section) {
    return options.body;
  }

  const sectionKey = ensureAllowedSection(options.section);
  const sectionBody = (options.body || '').trim() || emptySectionText();
  const existingSections = options.existingBody ? parsePhaseIssueBody(options.existingBody) : null;
  if (options.existingBody && !existingSections) {
    throw new Error('目标文档不是 phase issue section 模板；请先人工迁移或改为不带 --section 的整篇更新');
  }
  const sections = existingSections || {};
  sections[sectionKey] = sectionBody;
  return buildPhaseIssueBody(options.title, sections);
}

function loadGithubContext() {
  let session = null;
  try {
    session = loadSession(process.cwd());
  } catch {
    session = null;
  }
  return {
    session,
    repo: session?.data?.config?.tracker?.github?.repo || '',
    trackerType: session?.data?.config?.tracker?.type || '',
    executor: session?.data?.config?.executor || '',
  };
}

function ensureRootMode(context) {
  if (!context.repo) {
    throw new Error('当前 session 未配置 GitHub repo');
  }
  if (context.trackerType !== 'github' || context.executor !== 'multica') {
    throw new Error('该命令只适用于 tracker.type=github 且 executor=multica');
  }
}

function fetchIssueId(issue) {
  const output = run('gh', ['issue', 'view', String(issue.number), '--repo', issue.repo, '--json', 'id,url,number,title,body,labels']);
  return JSON.parse(output);
}

function ensureGithubRepoAccess(repo) {
  const ghPath = run('which', ['gh']);
  if (!ghPath) {
    throw new Error('gh 未安装');
  }
  const login = run('gh', ['api', 'user', '--jq', '.login']);
  if (!login) {
    throw new Error('gh 未登录');
  }
  const view = run('gh', ['repo', 'view', repo, '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  if (!view || view !== repo) {
    throw new Error(`当前 gh 用户无法访问目标仓库: ${repo}`);
  }
}

function listIssuesByTitle(repo, title) {
  const output = run('gh', ['issue', 'list', '--repo', repo, '--state', 'all', '--search', `${title} in:title`, '--limit', '100', '--json', 'number,title,url']);
  const items = JSON.parse(output);
  return items.filter((item) => item.title === title);
}

function listIssuesBySearch(repo, query) {
  const output = run('gh', ['issue', 'list', '--repo', repo, '--state', 'all', '--search', query, '--limit', '100', '--json', 'number,title,url']);
  return JSON.parse(output);
}

function writeTempBody(body) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-issue-doc-'));
  const file = path.join(dir, 'body.md');
  fs.writeFileSync(file, body, 'utf8');
  return { dir, file };
}

function cleanupTemp(temp) {
  if (!temp) return;
  try {
    fs.rmSync(temp.dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function writeIssueBody(issue, body) {
  const temp = writeTempBody(body);
  try {
    run('gh', ['issue', 'edit', String(issue.number), '--repo', issue.repo, '--body-file', temp.file], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    cleanupTemp(temp);
  }
}

function createIssue(repo, title, body) {
  const temp = writeTempBody(body);
  try {
    const createdUrl = run('gh', ['issue', 'create', '--repo', repo, '--title', title, '--body-file', temp.file]);
    return parseIssueRef(createdUrl, repo);
  } finally {
    cleanupTemp(temp);
  }
}

function emptyRootState() {
  return {
    main_issue: {},
    doc_root: {},
    init_params: {},
    docs: {},
    chains: {},
    updated_at: '',
  };
}

function parseRootState(body, options = {}) {
  const strict = Boolean(options.strict);
  const match = body.match(/## PACE 文档索引\(JSON\)\n```json\n([\s\S]*?)\n```/);
  if (!match) {
    if (strict) {
      throw new Error('文档 root issue 缺少 `PACE 文档索引(JSON)`；请先修复该 issue 正文');
    }
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    if (strict) {
      throw new Error('文档 root issue 中的 `PACE 文档索引(JSON)` 已损坏；请先修复该 issue 正文');
    }
    return null;
  }
}

function issueApiPath(repo, suffix) {
  const [owner, name] = repo.split('/');
  return `repos/${owner}/${name}${suffix}`;
}

function fetchIssueComments(repo, number) {
  return JSON.parse(
    run('gh', ['api', issueApiPath(repo, `/issues/${number}/comments`)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  );
}

function findMainIssueIndexComment(repo, number) {
  const comments = fetchIssueComments(repo, number);
  if (!Array.isArray(comments)) {
    return null;
  }
  return comments.find((item) => typeof item.body === 'string' && item.body.includes('<!-- PACE:DOC-INDEX -->')) || null;
}

function findRootIssueForMainIssue(repo, mainIssue, preferredTitle = '') {
  const candidates = new Map();
  const invalid = [];

  const pushCandidate = (item) => {
    if (!item?.url || candidates.has(item.url)) return;
    candidates.set(item.url, item);
  };

  if (preferredTitle) {
    for (const item of listIssuesByTitle(repo, preferredTitle)) {
      pushCandidate(item);
    }
  }

  for (const item of listIssuesBySearch(repo, `${mainIssue.url} in:body`)) {
    pushCandidate(item);
  }

  const matched = [];
  for (const item of candidates.values()) {
    const info = fetchIssueId({ repo, number: item.number, url: item.url });
    const parsed = parseRootState(info.body || '', { strict: false });
    if (!parsed) {
      invalid.push(item.url);
      continue;
    }
    if (parsed?.main_issue?.url === mainIssue.url) {
      matched.push({ issue: { repo, number: item.number, url: item.url }, info, state: parsed });
    }
  }

  if (matched.length > 1) {
    throw new Error(`发现多个可匹配的文档 root issue，请先人工收敛为唯一 root issue: ${matched.map((item) => item.issue.url).join(', ')}`);
  }

  if (matched.length === 1) {
    return matched[0];
  }

  if (invalid.length > 0) {
    throw new Error(`发现候选文档 root issue 但其索引 JSON 已损坏: ${invalid.join(', ')}；请先修复后再重试`);
  }

  return null;
}

function parseMainIssueIndexComment(body) {
  const root = body.match(/- 文档 root issue: (https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+)/);
  const initParams = body.match(/- 初始化参数 issue: (https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/issues\/\d+)/);
  const repo = body.match(/- 执行仓库: ([^\n]+)/);
  const branch = body.match(/- 执行分支: ([^\n]+)/);
  return {
    rootIssueUrl: root ? root[1] : '',
    initParamsIssueUrl: initParams ? initParams[1] : '',
    repo: repo ? repo[1].trim() : '',
    branch: branch ? branch[1].trim() : '',
  };
}

function buildInitParams(context, overrides = {}) {
  const session = context.session?.data || {};
  const issue = overrides.issue || {};
  return {
    executor: session?.config?.executor || '',
    tracker_type: session?.config?.tracker?.type || '',
    tracker_github_repo: session?.config?.tracker?.github?.repo || '',
    tracker_github_username: session?.config?.tracker?.github?.username || '',
    git_branch: session?.context?.git?.branch || '',
    git_base_branch: session?.context?.git?.base_branch || '',
    git_name: session?.config?.git?.name || '',
    git_email: session?.config?.git?.email || '',
    issue_url: issue.url || session?.context?.issue?.url || '',
    issue_title: issue.title || session?.context?.issue?.title || '',
    issue_type: issue.type || session?.context?.issue?.type || '',
    current_role: session?.context?.role?.current || '',
    session_mode: session?.context?.session?.mode || '',
  };
}

function parseInitParamsBody(body) {
  const read = (label) => {
    const match = body.match(new RegExp(`- ${label}: ([^\\n]*)`));
    return match ? match[1].trim() : '';
  };
  return {
    executor: read('executor'),
    tracker_type: read('tracker.type'),
    tracker_github_repo: read('tracker.github.repo'),
    tracker_github_username: read('tracker.github.username'),
    git_branch: read('git.branch'),
    git_base_branch: read('git.base_branch'),
    git_name: read('git.name'),
    git_email: read('git.email'),
    issue_url: read('issue.url'),
    issue_title: read('issue.title'),
    issue_type: read('issue.type'),
    current_role: read('current_role'),
    session_mode: read('session.mode'),
  };
}

function shellQuote(value) {
  const text = String(value ?? '');
  if (text === '') return '""';
  return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

function resolveIssueType(mainIssueInfo, fallback) {
  if (fallback) return fallback;
  const labels = Array.isArray(mainIssueInfo?.labels) ? mainIssueInfo.labels.map((item) => String(item.name || '').toLowerCase()) : [];
  if (labels.includes('bug')) return 'bug';
  if (labels.includes('feature')) return 'feature';
  if (labels.includes('task')) return 'task';
  return '';
}

function formatInitArgs(initParams) {
  return [
    '--repo', initParams.tracker_github_repo || '',
    '--branch', initParams.git_branch || '',
    '--base-branch', initParams.git_base_branch || '',
    '--github-user', initParams.tracker_github_username || '',
    '--git-name', initParams.git_name || '',
    '--git-email', initParams.git_email || '',
    '--issue-url', initParams.issue_url || '',
    '--issue-title', initParams.issue_title || '',
    '--issue-type', initParams.issue_type || '',
    '--current-role', initParams.current_role || '',
  ].join('\n');
}

function formatInitCommand(initParams) {
  return [
    'node',
    '"$HOME/.codex/skills/pace/bin/pace-init.js"',
    'multica',
    '--repo',
    shellQuote(initParams.tracker_github_repo),
    '--branch',
    shellQuote(initParams.git_branch),
    '--base-branch',
    shellQuote(initParams.git_base_branch),
    '--github-user',
    shellQuote(initParams.tracker_github_username),
    '--git-name',
    shellQuote(initParams.git_name),
    '--git-email',
    shellQuote(initParams.git_email),
    '--issue-url',
    shellQuote(initParams.issue_url),
    '--issue-title',
    shellQuote(initParams.issue_title),
    '--issue-type',
    shellQuote(initParams.issue_type),
    '--current-role',
    shellQuote(initParams.current_role),
  ].join(' ');
}

function renderRootBody(state) {
  const docEntries = Object.entries(state.docs || {});
  const docLines = docEntries.length
    ? docEntries.map(([key, item]) => `- \`${key}\`: ${item.latest_issue_url || '无'} @ rev-${item.latest_revision || 0}`)
    : ['- 无'];
  const latestLines = docEntries.length
    ? docEntries.map(([key, item]) => `- \`${key}\`: ${item.latest_issue_url || '无'} @ rev-${item.latest_revision || 0} (latest)`)
    : ['- 无'];
  const chainLines = Object.entries(state.chains || {}).length
    ? Object.entries(state.chains).map(([key, list]) => `- \`${key}\`: ${Array.isArray(list) && list.length ? list.join(' -> ') : '无'}`)
    : ['- 无'];
  const initDoc = state.docs?.['init-params'];
  return [
    `# ${state.doc_root?.title || 'PACE 文档 root'}`,
    '',
    '## 主 Issue',
    `- ${state.main_issue?.url || '无'}`,
    '',
    '## 初始化参数文档',
    `- issue: ${initDoc?.latest_issue_url || '无'}`,
    `- revision: rev-${initDoc?.latest_revision || 0}`,
    '',
    '## 文档索引',
    ...docLines,
    '',
    '## 最新正文节点',
    ...latestLines,
    '',
    '## 文档滚动链',
    ...chainLines,
    '',
    '## PACE 文档索引(JSON)',
    '```json',
    JSON.stringify(state, null, 2),
    '```',
    '',
  ].join('\n');
}

function renderInitParamsBody(state) {
  const init = state.init_params || {};
  return [
    `# ${state.main_issue?.number ? `issue-${state.main_issue.number}-init-params` : 'PACE 初始化参数'}`,
    '',
    '## 来源',
    `- 主 issue: ${state.main_issue?.url || '无'}`,
    `- 文档 root issue: ${state.doc_root?.url || '无'}`,
    '',
    '## 初始化参数',
    `- executor: ${init.executor || ''}`,
    `- tracker.type: ${init.tracker_type || ''}`,
    `- tracker.github.repo: ${init.tracker_github_repo || ''}`,
    `- tracker.github.username: ${init.tracker_github_username || ''}`,
    `- git.branch: ${init.git_branch || ''}`,
    `- git.base_branch: ${init.git_base_branch || ''}`,
    `- git.name: ${init.git_name || ''}`,
    `- git.email: ${init.git_email || ''}`,
    `- issue.url: ${init.issue_url || ''}`,
    `- issue.title: ${init.issue_title || ''}`,
    `- issue.type: ${init.issue_type || ''}`,
    `- current_role: ${init.current_role || ''}`,
    `- session.mode: ${init.session_mode || ''}`,
    '',
    '## 用途',
    '- 后续角色接手时，先读取这份初始化参数文档，再调用 `pace-init.js` 生成或覆盖 `.pace/session.yaml`。',
    '- 如果参数缺失或脚本校验失败，必须立即停止并要求用户补齐。',
    '',
  ].join('\n');
}

function renderMainIssueIndexComment(state) {
  const docs = Object.entries(state.docs || {});
  const lines = docs.length
    ? docs.map(([key, item]) => `- \`${key}\`: ${item.latest_issue_url || '无'} @ rev-${item.latest_revision || 0}`)
    : ['- 无'];
  const init = state.init_params || {};
  return [
    '<!-- PACE:DOC-INDEX -->',
    '## PACE 文档索引',
    `- 文档 root issue: ${state.doc_root?.url || '无'}`,
    `- 初始化参数 issue: ${state.docs?.['init-params']?.latest_issue_url || '无'}`,
    `- 执行仓库: ${init.tracker_github_repo || '无'}`,
    `- 执行分支: ${init.git_branch || '无'}`,
    '',
    '### 文档',
    ...lines,
    '',
    '> 这条 comment 由 `pace-issue-doc.js` 维护；新的文档 issue 创建或滚动后会自动回填。',
    '',
  ].join('\n');
}

function updateRootIssue(context, rootIssue, state) {
  state.updated_at = new Date().toISOString();
  writeIssueBody(rootIssue, renderRootBody(state));
}

function upsertMainIssueIndexComment(context, state) {
  const mainIssue = state.main_issue;
  if (!mainIssue?.number || !context.repo) {
    return;
  }
  const existing = fetchIssueComments(context.repo, mainIssue.number);
  const body = renderMainIssueIndexComment(state);
  const current = Array.isArray(existing)
    ? existing.find((item) => typeof item.body === 'string' && item.body.includes('<!-- PACE:DOC-INDEX -->'))
    : null;

  if (current?.id) {
    run(
      'gh',
      ['api', issueApiPath(context.repo, `/issues/comments/${current.id}`), '--method', 'PATCH', '-f', `body=${body}`],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return;
  }

  run(
    'gh',
    ['api', issueApiPath(context.repo, `/issues/${mainIssue.number}/comments`), '--method', 'POST', '-f', `body=${body}`],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
}

function upsertIndexedDoc(context, rootIssue, state, options) {
  const docKey = options.docKey;
  let entry = state.docs[docKey] || {
    title: options.title,
    latest_issue_url: '',
    latest_issue_number: null,
    latest_revision: 0,
  };

  let targetIssue;
  if (entry.latest_issue_url) {
    targetIssue = parseIssueRef(entry.latest_issue_url, context.repo);
    ensureSameRepo(targetIssue.repo, context.repo);
    const existingIssueInfo = fetchIssueId(targetIssue);
    const nextBody = renderDocBody({
      title: options.title,
      body: options.body,
      section: options.section,
      existingBody: existingIssueInfo.body || '',
    });
    ensureBodyWithinLimit(nextBody, options.maxChars || DEFAULT_MAX_CHARS);
    writeIssueBody(targetIssue, nextBody);
  } else {
    const nextBody = renderDocBody({
      title: options.title,
      body: options.body,
      section: options.section,
      existingBody: '',
    });
    ensureBodyWithinLimit(nextBody, options.maxChars || DEFAULT_MAX_CHARS);
    const created = createIssue(context.repo, options.title, nextBody);
    targetIssue = created;
  }

  if (options.auditBody) {
    const temp = writeTempBody(options.auditBody);
    try {
      run('gh', ['issue', 'comment', String(targetIssue.number), '--repo', targetIssue.repo, '--body-file', temp.file], {
        stdio: 'ignore',
      });
    } finally {
      cleanupTemp(temp);
    }
  }

  const nextRevision = Number(entry.latest_revision || 0) + 1;
  entry = {
    title: options.title,
    latest_issue_url: targetIssue.url,
    latest_issue_number: targetIssue.number,
    latest_revision: nextRevision,
  };
  state.docs[docKey] = entry;

  const chain = Array.isArray(state.chains[docKey]) ? state.chains[docKey] : [];
  if (!chain.includes(targetIssue.url)) {
    chain.push(targetIssue.url);
  }
  state.chains[docKey] = chain;

  return {
    issue: targetIssue,
    revision: nextRevision,
  };
}

function ensureRootIssue(context, options) {
  ensureRootMode(context);
  ensureGithubSession(context.session, { requireRepo: true });
  const mainIssue = parseIssueRef(options.issue, context.repo);
  ensureSameRepo(mainIssue.repo, context.repo);
  const mainIssueInfo = fetchIssueId(mainIssue);
  const sessionIssueNumber = context.session?.data?.context?.issue?.number || null;
  const sessionIssueUrl = context.session?.data?.context?.issue?.url || '';
  if (sessionIssueNumber && sessionIssueNumber !== mainIssue.number) {
    throw new Error('当前 .pace/session.yaml 绑定的 issue 与目标主 issue 不一致；请先用正确参数重跑 pace-init.js');
  }
  if (sessionIssueUrl && sessionIssueUrl !== mainIssue.url) {
    throw new Error('当前 .pace/session.yaml 绑定的 issue URL 与目标主 issue 不一致；请先用正确参数重跑 pace-init.js');
  }
  const rootTitle = options.title || `issue-${mainIssue.number}-doc`;
  const indexComment = findMainIssueIndexComment(context.repo, mainIssue.number);
  const indexInfo = indexComment ? parseMainIssueIndexComment(indexComment.body || '') : null;
  let rootIssue;
  if (indexInfo?.rootIssueUrl) {
    try {
      const hintedRoot = parseIssueRef(indexInfo.rootIssueUrl, context.repo);
      const hintedInfo = fetchIssueId(hintedRoot);
      const hintedState = parseRootState(hintedInfo.body || '', { strict: false });
      if (hintedState?.main_issue?.url === mainIssue.url) {
        rootIssue = hintedRoot;
      } else {
        const discovered = findRootIssueForMainIssue(context.repo, mainIssue, rootTitle);
        if (!discovered) {
          throw new Error('主 issue 的文档索引 comment 指向的 root issue 已漂移，且未找到可自动修复的文档 root issue');
        }
        rootIssue = discovered.issue;
      }
    } catch {
      const discovered = findRootIssueForMainIssue(context.repo, mainIssue, rootTitle);
      if (!discovered) {
        throw new Error('主 issue 的文档索引 comment 指向的 root issue 无法解析，且未找到可自动修复的文档 root issue');
      }
      rootIssue = discovered.issue;
    }
  } else {
    const discovered = findRootIssueForMainIssue(context.repo, mainIssue, rootTitle);
    if (discovered) {
      rootIssue = discovered.issue;
    } else {
      const seedState = {
        main_issue: { number: mainIssue.number, url: mainIssue.url },
        doc_root: { title: rootTitle },
        init_params: buildInitParams(context, {
          issue: {
            url: mainIssue.url,
            title: mainIssueInfo.title || '',
            type: resolveIssueType(mainIssueInfo, context.session?.data?.context?.issue?.type || ''),
          },
        }),
        docs: {},
        chains: {},
        updated_at: new Date().toISOString(),
      };
      rootIssue = createIssue(context.repo, rootTitle, renderRootBody(seedState));
    }
  }

  const rootInfo = fetchIssueId(rootIssue);
  const state = parseRootState(rootInfo.body || '', { strict: true });
  if (state.main_issue?.url && state.main_issue.url !== mainIssue.url) {
    throw new Error('文档 root issue 绑定的主 issue 与当前主 issue 不一致；请先修复文档索引');
  }
  state.main_issue = { number: mainIssue.number, url: mainIssue.url };
  state.doc_root = { title: rootTitle, number: rootInfo.number, url: rootInfo.url };
  state.init_params = buildInitParams(context, {
    issue: {
      url: mainIssue.url,
      title: mainIssueInfo.title || '',
      type: resolveIssueType(mainIssueInfo, state.init_params?.issue_type || ''),
    },
  });
  state.docs = state.docs || {};
  state.chains = state.chains || {};
  for (const entry of Object.values(state.docs)) {
    if (!entry?.latest_issue_url) continue;
    const docIssue = parseIssueRef(entry.latest_issue_url, context.repo);
    ensureSameRepo(docIssue.repo, context.repo);
  }
  upsertIndexedDoc(context, { repo: context.repo, number: rootInfo.number, url: rootInfo.url }, state, {
    docKey: 'init-params',
    title: `issue-${mainIssue.number}-init-params`,
    body: renderInitParamsBody({
      ...state,
      main_issue: { number: mainIssue.number, url: mainIssue.url },
      doc_root: { title: rootTitle, number: rootInfo.number, url: rootInfo.url },
    }),
  });
  updateRootIssue(context, rootIssue, state);
  upsertMainIssueIndexComment(context, state);

  return {
    mainIssue,
    rootIssue: { repo: context.repo, number: rootInfo.number, url: rootInfo.url, title: rootTitle },
    state,
  };
}

function commandCheckBody(options) {
  const { body } = readBodyFile(options['body-file']);
  const maxChars = resolveMaxChars(options['max-chars']);
  const count = ensureBodyWithinLimit(body, maxChars);
  console.log(`正文长度: ${count}`);
  console.log(`长度限制: ${maxChars}`);
  console.log('检查结果: 通过');
}

function commandUpdateBody(context, options) {
  ensureRootMode(context);
  throw new Error('multica + github 模式下禁止直接使用 update-body；请改用 ensure-root / upsert-doc');
}

function commandCreateDoc(context, options) {
  ensureRootMode(context);
  throw new Error('multica + github 模式下禁止直接使用 create-doc；请改用 ensure-root / upsert-doc');
}

function commandAppendAudit(context, options) {
  if (!context.repo) {
    throw new Error('当前 session 未配置 GitHub repo');
  }
  const issue = parseIssueRef(options.issue, context.repo);
  ensureSameRepo(issue.repo, context.repo);
  const { path: bodyPath } = readBodyFile(options['body-file']);
  ensureGithubSession(context.session, { requireRepo: true });
  run('gh', ['issue', 'comment', String(issue.number), '--repo', issue.repo, '--body-file', bodyPath], {
    stdio: 'inherit',
  });
  console.log(`已追加审计 comment: ${issue.url}`);
}

function commandEnsureRoot(context, options) {
  if (!options.issue) {
    throw new Error('ensure-root 缺少 --issue');
  }
  const { rootIssue } = ensureRootIssue(context, options);
  console.log(`已就绪文档 root issue: ${rootIssue.url}`);
}

function commandResolveInit(context, options) {
  const mainIssue = parseIssueRef(options.issue, context.repo || '');
  ensureGithubRepoAccess(mainIssue.repo);
  const rootTitle = `issue-${mainIssue.number}-doc`;
  let indexComment = findMainIssueIndexComment(mainIssue.repo, mainIssue.number);
  const parsed = indexComment ? parseMainIssueIndexComment(indexComment.body || '') : null;

  let rootIssue = null;
  if (parsed?.rootIssueUrl) {
    try {
      rootIssue = parseIssueRef(parsed.rootIssueUrl, mainIssue.repo);
      ensureSameRepo(rootIssue.repo, mainIssue.repo);
    } catch {
      rootIssue = null;
    }
  }
  if (!rootIssue) {
    const discovered = findRootIssueForMainIssue(mainIssue.repo, mainIssue, rootTitle);
    if (!discovered) {
      throw new Error('当前主 issue 尚未建立可恢复的文档链；请先执行 ensure-root');
    }
    rootIssue = discovered.issue;
  }

  const rootInfo = fetchIssueId(rootIssue);
  const rootState = parseRootState(rootInfo.body || '', { strict: true });
  if (rootState.main_issue?.url && rootState.main_issue.url !== mainIssue.url) {
    const discovered = findRootIssueForMainIssue(mainIssue.repo, mainIssue, rootTitle);
    if (!discovered) {
      throw new Error('文档 root issue 绑定的主 issue 与当前主 issue 不一致');
    }
    rootIssue = discovered.issue;
  }

  const resolvedRootInfo = fetchIssueId(rootIssue);
  const resolvedRootState = parseRootState(resolvedRootInfo.body || '', { strict: true });
  if (resolvedRootState.main_issue?.url && resolvedRootState.main_issue.url !== mainIssue.url) {
    throw new Error('文档 root issue 绑定的主 issue 与当前主 issue 不一致');
  }

  const expectedInitIssueUrl = resolvedRootState.docs?.['init-params']?.latest_issue_url || '';
  if (!expectedInitIssueUrl) {
    throw new Error('文档 root issue 当前索引缺少初始化参数 issue');
  }

  const initIssue = parseIssueRef(expectedInitIssueUrl, mainIssue.repo);
  ensureSameRepo(initIssue.repo, mainIssue.repo);
  const initInfo = fetchIssueId(initIssue);
  const initParams = parseInitParamsBody(initInfo.body || '');

  const commentNeedsRepair =
    !indexComment ||
    !parsed?.rootIssueUrl ||
    parsed.rootIssueUrl !== rootIssue.url ||
    !parsed?.initParamsIssueUrl ||
    parsed.initParamsIssueUrl !== initIssue.url;

  if (commentNeedsRepair) {
    upsertMainIssueIndexComment({ repo: mainIssue.repo }, {
      ...resolvedRootState,
      main_issue: { number: mainIssue.number, url: mainIssue.url },
      doc_root: {
        ...(resolvedRootState.doc_root || {}),
        number: resolvedRootInfo.number,
        url: resolvedRootInfo.url,
      },
    });
    indexComment = findMainIssueIndexComment(mainIssue.repo, mainIssue.number);
  }

  const payload = {
    main_issue: { number: mainIssue.number, url: mainIssue.url },
    root_issue: { number: resolvedRootInfo.number, url: resolvedRootInfo.url },
    init_params_issue: { number: initIssue.number, url: initIssue.url },
    init_params: initParams,
    root_index_comment_id: indexComment?.id || null,
    root_state: resolvedRootState,
  };
  const format = options.format || 'command';
  if (format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  if (format === 'args') {
    console.log(formatInitArgs(initParams));
    return;
  }
  if (format === 'command') {
    console.log(formatInitCommand(initParams));
    return;
  }
  throw new Error(`resolve-init 不支持的 --format: ${format}`);
}

function commandUpsertDoc(context, options) {
  if (!options.issue) {
    throw new Error('upsert-doc 缺少 --issue');
  }
  if (!options['doc-key']) {
    throw new Error('upsert-doc 缺少 --doc-key');
  }
  if (!options.title) {
    throw new Error('upsert-doc 缺少 --title');
  }

  const { rootIssue, state } = ensureRootIssue(context, options);
  const docKey = options['doc-key'];
  const section = options.section ? ensureAllowedSection(options.section) : '';
  const bodySource = options['body-file'] ? readBodyFile(options['body-file']) : null;
  const body = bodySource?.body || (section ? '待写入。' : `# ${options.title}\n\n待写入。\n`);
  const maxChars = resolveMaxChars(options['max-chars']);
  const auditBody = options['audit-file'] ? readBodyFile(options['audit-file']).body : '';
  const { issue: targetIssue, revision: nextRevision } = upsertIndexedDoc(context, rootIssue, state, {
    docKey,
    title: options.title,
    body,
    section,
    maxChars,
    auditBody,
  });
  updateRootIssue(context, rootIssue, state);
  upsertMainIssueIndexComment(context, state);

  console.log(`已更新文档 key: ${docKey}`);
  console.log(`文档 issue: ${targetIssue.url}`);
  console.log(`最新修订: rev-${nextRevision}`);
  console.log(`文档 root: ${rootIssue.url}`);
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    usage(1);
  }

  const context = loadGithubContext();

  try {
    switch (parsed.command) {
      case 'ensure-root':
        commandEnsureRoot(context, parsed.options);
        break;
      case 'resolve-init':
        commandResolveInit(context, parsed.options);
        break;
      case 'upsert-doc':
        commandUpsertDoc(context, parsed.options);
        break;
      case 'check-body':
        commandCheckBody(parsed.options);
        break;
      case 'update-body':
        commandUpdateBody(context, parsed.options);
        break;
      case 'create-doc':
        commandCreateDoc(context, parsed.options);
        break;
      case 'append-audit':
        commandAppendAudit(context, parsed.options);
        break;
      default:
        throw new Error(`不支持的命令: ${parsed.command}`);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

main();
