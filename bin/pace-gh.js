#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadSession } = require('./lib/pace-config');
const { parseIssueRef } = require('./lib/issue-ref');
const {
  ensureGithubSession,
  run,
} = require('./lib/github-cli');

function usage(exitCode = 0) {
  const text = [
    '用法: node <pace-bin>/pace-gh.js <命令> [参数]',
    '',
    '作用:',
    '  通过受限白名单执行 GitHub CLI 相关操作。',
    '  默认拒绝任意 gh 子命令，只开放 issue 读取、issue 评论发送、issue 附件下载。',
    '  执行前只会在当前机器已完成 GitHub 登录的前提下，按 `.pace/session.yaml` 切换到配置中的 GitHub 用户。',
    '',
    '允许的命令:',
    '  issue-read --issue <url|number> [--comments]',
    '  issue-comment --issue <url|number> (--body <text> | --body-file <path>)',
    '  issue-list [--state <open|closed|all>] [--limit <n>]',
    '  issue-search --query <text> [--state <open|closed|all>] [--limit <n>]',
    '  attachment-download --issue <url|number> --url <attachment-url> [--output <path>]',
    '  whoami',
    '  repo-check',
    '',
    '参数规则:',
    '  --issue           可以传完整 issue URL，也可以只传 issue number',
    '  --comments        issue-read 时额外读取评论',
    '  --body            issue-comment 可选，表示评论正文',
    '  --body-file       issue-comment 可选，表示评论正文文件；与 --body 二选一',
    '  --query           issue-search 必填，表示搜索文本',
    '  --state           issue-list / issue-search 可选，默认 open',
    '  --limit           issue-list / issue-search 可选，默认 30',
    '  --url             attachment-download 必填，表示附件 URL',
    '  --issue           attachment-download 必填，且附件必须出现在该 issue 的正文或评论中',
    '  --output          attachment-download 可选，默认为当前目录下的原文件名',
    '',
    '配置来源:',
    '  优先读取 `.pace/session.yaml` 中的 `config.tracker.github.repo` 和 `config.tracker.github.username`。',
    '',
    '限制规则:',
    '  - 不支持任意 gh 参数透传',
    '  - 不支持删除 / 编辑 issue',
    '  - 不支持关闭 / reopen issue',
    '  - 不支持 PR 操作',
    '',
    '示例:',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" whoami',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" repo-check',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-read --issue 72 --comments',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-comment --issue 72 --body "已完成 discuss 阶段"',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-comment --issue 72 --body-file /tmp/comment.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-list --state all --limit 50',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-search --query "tracking-init" --state all',
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" attachment-download --issue 72 --url "https://github.com/user-attachments/files/xxx/file.png"',
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
    if (key === 'comments') {
      options.comments = true;
      continue;
    }
    const value = rest[i + 1];
    if (value == null || value.startsWith('--')) {
      throw new Error(`参数缺少值: ${arg}`);
    }
    options[key] = value;
    i += 1;
  }
  return { command, options };
}

function loadGithubContext() {
  const session = loadSession(process.cwd());
  const repo = session?.data?.config?.tracker?.github?.repo || '';
  const username = session?.data?.config?.tracker?.github?.username || '';
  return {
    session,
    repo,
    username,
  };
}

function ensureRepo(repo) {
  if (!repo) {
    throw new Error('当前未配置 GitHub repo。必须先让 `pace-init.js` 成功生成 `.pace/session.yaml`，在此之前禁止调用 pace-gh。');
  }
}

function ensureIssueInSessionRepo(issue, sessionRepo) {
  if (sessionRepo && issue.repo !== sessionRepo) {
    throw new Error(`目标 issue 不属于当前 session 仓库: ${issue.repo}`);
  }
}

function resolvePositiveLimit(rawLimit, fallback = 30) {
  const value = rawLimit || String(fallback);
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error('--limit 必须是正整数');
  }
  return value;
}

function resolveState(rawState) {
  const value = rawState || 'open';
  if (!['open', 'closed', 'all'].includes(value)) {
    throw new Error('--state 只支持 open | closed | all');
  }
  return value;
}

function isAllowedAttachmentUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  const host = url.hostname;
  const pathname = url.pathname || '';
  if (host === 'github.com' && pathname.startsWith('/user-attachments/files/')) {
    return true;
  }
  if (host === 'user-images.githubusercontent.com' || host === 'private-user-images.githubusercontent.com') {
    return true;
  }
  return false;
}

function resolveIssueRef(issueRef, defaultRepo) {
  return parseIssueRef(issueRef, defaultRepo, {
    missingIssueMessage: '缺少 --issue',
    missingRepoMessage: '当前未配置 GitHub repo。必须先让 `pace-init.js` 成功生成 `.pace/session.yaml`，在此之前禁止调用 pace-gh。',
  });
}

function resolveCommentBodySource(options) {
  const hasBody = typeof options.body === 'string' && options.body.length > 0;
  const hasBodyFile = typeof options['body-file'] === 'string' && options['body-file'].length > 0;

  if (hasBody && hasBodyFile) {
    throw new Error('issue-comment 只能使用 --body 或 --body-file 其中一种');
  }
  if (!hasBody && !hasBodyFile) {
    throw new Error('issue-comment 缺少 --body 或 --body-file');
  }

  if (hasBodyFile) {
    const resolvedPath = path.resolve(process.cwd(), options['body-file']);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`评论文件不存在: ${resolvedPath}`);
    }
    return {
      mode: 'file',
      value: resolvedPath,
    };
  }

  return {
    mode: 'inline',
    value: options.body,
  };
}

function commandWhoami(context) {
  const state = ensureGithubSession(context.session, { requireRepo: false });
  const login = state.login;
  console.log(`当前 GitHub 用户: ${login}`);
  if (context.username) {
    console.log(`session 配置用户: ${context.username}`);
  }
}

function commandRepoCheck(context) {
  ensureRepo(context.repo);
  const state = ensureGithubSession(context.session, { requireRepo: true });
  console.log(`仓库可访问: ${state.repo}`);
  console.log(`当前 GitHub 用户: ${state.login}`);
}

function commandIssueRead(context, options) {
  ensureRepo(context.repo);
  const issue = resolveIssueRef(options.issue, context.repo);
  ensureIssueInSessionRepo(issue, context.repo);
  ensureGithubSession(context.session, { requireRepo: true, repoOverride: issue.repo });
  const fields = ['number', 'title', 'body', 'state', 'author', 'labels', 'url'];
  if (options.comments) {
    fields.push('comments');
  }
  const output = run('gh', ['issue', 'view', String(issue.number), '--repo', issue.repo, '--json', fields.join(',')]);
  console.log(output);
}

function commandIssueComment(context, options) {
  ensureRepo(context.repo);
  const issue = resolveIssueRef(options.issue, context.repo);
  const bodySource = resolveCommentBodySource(options);
  ensureIssueInSessionRepo(issue, context.repo);
  ensureGithubSession(context.session, { requireRepo: true, repoOverride: issue.repo });
  const args = ['issue', 'comment', String(issue.number), '--repo', issue.repo];
  if (bodySource.mode === 'file') {
    args.push('--body-file', bodySource.value);
  } else {
    args.push('--body', bodySource.value);
  }
  run('gh', args, { stdio: 'inherit' });
}

function commandIssueList(context, options) {
  ensureRepo(context.repo);
  ensureGithubSession(context.session, { requireRepo: true });
  const output = run('gh', [
    'issue',
    'list',
    '--repo',
    context.repo,
    '--state',
    resolveState(options.state),
    '--limit',
    resolvePositiveLimit(options.limit),
    '--json',
    'number,title,state,url,labels,author',
  ]);
  console.log(output);
}

function commandIssueSearch(context, options) {
  ensureRepo(context.repo);
  if (!options.query) {
    throw new Error('issue-search 缺少 --query');
  }
  ensureGithubSession(context.session, { requireRepo: true });
  const output = run('gh', [
    'issue',
    'list',
    '--repo',
    context.repo,
    '--state',
    resolveState(options.state),
    '--limit',
    resolvePositiveLimit(options.limit),
    '--search',
    options.query,
    '--json',
    'number,title,state,url,labels,author',
  ]);
  console.log(output);
}

function filenameFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const base = path.basename(pathname);
    return base || 'attachment.bin';
  } catch {
    return 'attachment.bin';
  }
}

function commandAttachmentDownload(context, options) {
  ensureGithubSession(context.session, { requireRepo: true });
  const url = options.url;
  const issueRef = options.issue || '';
  if (!url) {
    throw new Error('attachment-download 缺少 --url');
  }
  if (!issueRef) {
    throw new Error('attachment-download 缺少 --issue');
  }
  if (!isAllowedAttachmentUrl(url)) {
    throw new Error('attachment-download 只允许下载 GitHub 附件地址');
  }
  ensureRepo(context.repo);
  const issue = resolveIssueRef(issueRef, context.repo);
  ensureIssueInSessionRepo(issue, context.repo);
  const raw = run('gh', ['issue', 'view', String(issue.number), '--repo', issue.repo, '--json', 'body,comments']);
  const payload = JSON.parse(raw);
  const body = payload.body || '';
  const comments = Array.isArray(payload.comments) ? payload.comments.map((item) => item.body || '').join('\n') : '';
  if (!`${body}\n${comments}`.includes(url)) {
    throw new Error('attachment-download 只允许下载当前 issue 正文或评论中出现过的附件 URL');
  }
  const token = run('gh', ['auth', 'token']);
  if (!token) {
    throw new Error('无法获取 gh token');
  }
  const output = options.output || filenameFromUrl(url);
  const outputPath = path.resolve(process.cwd(), output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  run('curl', ['-L', '-H', `Authorization: Bearer ${token}`, '-o', outputPath, url], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  console.log(`附件已下载: ${outputPath}`);
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
      case 'whoami':
        commandWhoami(context);
        break;
      case 'repo-check':
        commandRepoCheck(context);
        break;
      case 'issue-read':
        commandIssueRead(context, parsed.options);
        break;
      case 'issue-comment':
        commandIssueComment(context, parsed.options);
        break;
      case 'issue-list':
        commandIssueList(context, parsed.options);
        break;
      case 'issue-search':
        commandIssueSearch(context, parsed.options);
        break;
      case 'attachment-download':
        commandAttachmentDownload(context, parsed.options);
        break;
      default:
        throw new Error(`不支持的命令: ${parsed.command}`);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseIssueRef: resolveIssueRef,
  resolveCommentBodySource,
};
