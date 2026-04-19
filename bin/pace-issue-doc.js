#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { loadSession } = require('./lib/pace-config');
const { ensureGithubSession, run } = require('./lib/github-cli');

const DEFAULT_MAX_CHARS = 60000;

function usage(exitCode = 0) {
  const text = [
    '用法: node <pace-bin>/pace-issue-doc.js <命令> [参数]',
    '',
    '作用:',
    '  管理 PACE 的 issue 文档层。',
    '  用 issue body 保存最新版文档，用 comment 保存审计记录。',
    '  默认限制 body 长度不超过 60000 字符。',
    '',
    '允许的命令:',
    '  check-body --body-file <path> [--max-chars <n>]',
    '  update-body --issue <url|number> --body-file <path> [--max-chars <n>]',
    '  create-doc --title <title> --body-file <path> [--parent <url|number>] [--max-chars <n>]',
    '  append-audit --issue <url|number> --body-file <path>',
    '',
    '说明:',
    '  - 只操作当前 session 配置的 GitHub 仓库',
    '  - body 超过上限直接拒绝，不自动截断',
    '  - create-doc 可选把新 issue 挂到父 issue 下',
    '',
    '示例:',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" check-body --body-file /tmp/doc.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" update-body --issue 72 --body-file /tmp/doc.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" create-doc --title "phase-01-context" --body-file /tmp/doc.md --parent 72',
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

function loadGithubContext() {
  const session = loadSession(process.cwd());
  return {
    session,
    repo: session?.data?.config?.tracker?.github?.repo || '',
  };
}

function fetchIssueId(issue) {
  const output = run('gh', ['issue', 'view', String(issue.number), '--repo', issue.repo, '--json', 'id,url,number']);
  const parsed = JSON.parse(output);
  return {
    id: parsed.id,
    url: parsed.url,
    number: parsed.number,
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
  if (!context.repo) {
    throw new Error('当前 session 未配置 GitHub repo');
  }
  const issue = parseIssueRef(options.issue, context.repo);
  ensureSameRepo(issue.repo, context.repo);
  const { path: bodyPath, body } = readBodyFile(options['body-file']);
  const maxChars = resolveMaxChars(options['max-chars']);
  const count = ensureBodyWithinLimit(body, maxChars);
  ensureGithubSession(context.session, { requireRepo: true });
  run('gh', ['issue', 'edit', String(issue.number), '--repo', issue.repo, '--body-file', bodyPath], {
    stdio: 'inherit',
  });
  console.log(`已更新 issue body: ${issue.url}`);
  console.log(`正文长度: ${count}/${maxChars}`);
}

function commandCreateDoc(context, options) {
  if (!options.title) {
    throw new Error('create-doc 缺少 --title');
  }
  const repo = context.repo;
  if (!repo) {
    throw new Error('当前 session 未配置 GitHub repo');
  }
  const { path: bodyPath, body } = readBodyFile(options['body-file']);
  const maxChars = resolveMaxChars(options['max-chars']);
  const count = ensureBodyWithinLimit(body, maxChars);
  ensureGithubSession(context.session, { requireRepo: true });
  const createdUrl = run('gh', ['issue', 'create', '--repo', repo, '--title', options.title, '--body-file', bodyPath]);
  console.log(`已创建文档 issue: ${createdUrl}`);
  console.log(`正文长度: ${count}/${maxChars}`);

  if (options.parent) {
    const parent = parseIssueRef(options.parent, repo);
    ensureSameRepo(parent.repo, repo);
    const child = parseIssueRef(createdUrl, repo);
    const childInfo = fetchIssueId(child);
    const [owner, name] = repo.split('/');
    run(
      'gh',
      [
        'api',
        `repos/${owner}/${name}/issues/${parent.number}/sub_issues`,
        '--method',
        'POST',
        '-f',
        `sub_issue_id=${childInfo.id}`,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] }
    );
    console.log(`已关联到父 issue: ${parent.url}`);
  }
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
