#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadSession } = require('./lib/pace-config');
const {
  currentLogin,
  ensureGhInstalled,
  ensureGithubSession,
  ensureRepoAccessible,
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
    '  issue-comment --issue <url|number> --body <text>',
    '  attachment-download --url <attachment-url> [--output <path>]',
    '  whoami',
    '  repo-check',
    '',
    '参数规则:',
    '  --issue           可以传完整 issue URL，也可以只传 issue number',
    '  --comments        issue-read 时额外读取评论',
    '  --body            issue-comment 必填，表示评论正文',
    '  --url             attachment-download 必填，表示附件 URL',
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
    '  node "$HOME/.codex/skills/pace/bin/pace-gh.js" attachment-download --url "https://github.com/user-attachments/files/xxx/file.png"',
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
    throw new Error('当前未配置 GitHub repo，请先运行 `node <pace-bin>/pace-init.js multica` 或补齐 `.pace/session.yaml`');
  }
}

function parseIssueRef(issueRef, defaultRepo) {
  if (!issueRef) {
    throw new Error('缺少 --issue');
  }
  if (/^\d+$/.test(issueRef)) {
    ensureRepo(defaultRepo);
    return { repo: defaultRepo, number: Number(issueRef), url: `https://github.com/${defaultRepo}/issues/${issueRef}` };
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
  const issue = parseIssueRef(options.issue, context.repo);
  ensureGithubSession(context.session, { requireRepo: true });
  const fields = ['number', 'title', 'body', 'state', 'author', 'labels', 'url'];
  if (options.comments) {
    fields.push('comments');
  }
  const output = run('gh', ['issue', 'view', String(issue.number), '--repo', issue.repo, '--json', fields.join(',')]);
  console.log(output);
}

function commandIssueComment(context, options) {
  const issue = parseIssueRef(options.issue, context.repo);
  if (!options.body) {
    throw new Error('issue-comment 缺少 --body');
  }
  ensureGithubSession(context.session, { requireRepo: true });
  run('gh', ['issue', 'comment', String(issue.number), '--repo', issue.repo, '--body', options.body], { stdio: 'inherit' });
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
  if (!url) {
    throw new Error('attachment-download 缺少 --url');
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

main();
