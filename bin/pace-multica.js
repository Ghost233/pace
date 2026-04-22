#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ensureBinary, run } = require('./lib/exec');

function usage(exitCode = 0) {
  const text = [
    '用法: node <pace-bin>/pace-multica.js <命令> [参数]',
    '',
    '作用:',
    '  通过受限白名单执行 multica issue 平台动作。',
    '  只开放 issue 读取、评论、状态变更、指派与 handoff，避免在 role 中自由拼 multica 命令。',
    '',
    '允许的命令:',
    '  issue-get --issue <id> [--output <json|table>]',
    '  comment-list --issue <id> [--limit <n>] [--output <json|table>]',
    '  comment-add --issue <id> --body-file <path> [--parent <comment-id>] [--output <json|table>]',
    '  status --issue <id> --value <todo|in_progress|blocked|done|cancelled>',
    '  assign --issue <id> --to <assignee> [--output <json|table>]',
    '  handoff --issue <id> --to <assignee> [--status <todo|in_progress|blocked|done|cancelled>] [--body-file <path>] [--parent <comment-id>] [--output <json|table>]',
    '',
    '限制规则:',
    '  - 不支持任意 multica 参数透传',
    '  - handoff 会按固定顺序执行：可选 comment-add -> assign -> 可选 status',
    '  - handoff 的成功条件不是只写 comment，而是目标 assignee 已切换成功',
    '',
    '示例:',
    '  node "$HOME/.codex/skills/pace/bin/pace-multica.js" issue-get --issue <multica-issue-id>',
    '  node "$HOME/.codex/skills/pace/bin/pace-multica.js" comment-list --issue <multica-issue-id> --limit 30',
    '  node "$HOME/.codex/skills/pace/bin/pace-multica.js" comment-add --issue <multica-issue-id> --body-file /tmp/comment.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-multica.js" assign --issue <multica-issue-id> --to "PACE-初始化经理"',
    '  node "$HOME/.codex/skills/pace/bin/pace-multica.js" handoff --issue <multica-issue-id> --to "PACE-初始化经理" --status blocked --body-file /tmp/final.md',
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

function runMultica(args, options = {}) {
  ensureBinary('multica', { message: 'multica 未安装，不能执行 multica 相关操作' });
  return run('multica', args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function ensureIssue(issueId) {
  if (!issueId) {
    throw new Error('缺少 --issue');
  }
}

function resolveBodyFile(filePath) {
  if (!filePath) {
    throw new Error('缺少 --body-file');
  }
  const resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`评论文件不存在: ${resolved}`);
  }
  return resolved;
}

function commandIssueGet(options) {
  ensureIssue(options.issue);
  const output = options.output || 'json';
  console.log(runMultica(['issue', 'get', options.issue, '--output', output]));
}

function commandCommentList(options) {
  ensureIssue(options.issue);
  const args = ['issue', 'comment', 'list', options.issue, '--output', options.output || 'json'];
  if (options.limit) {
    args.push('--limit', options.limit);
  }
  console.log(runMultica(args));
}

function commandCommentAdd(options) {
  ensureIssue(options.issue);
  const bodyFile = resolveBodyFile(options['body-file']);
  const body = fs.readFileSync(bodyFile, 'utf8');
  const args = ['issue', 'comment', 'add', options.issue, '--content-stdin', '--output', options.output || 'json'];
  if (options.parent) {
    args.push('--parent', options.parent);
  }
  const output = runMultica(args, { input: body });
  if (!options.__silent) {
    console.log(output);
  }
  return output;
}

function commandStatus(options) {
  ensureIssue(options.issue);
  if (!options.value) {
    throw new Error('status 缺少 --value');
  }
  console.log(runMultica(['issue', 'status', options.issue, options.value]));
}

function commandAssign(options) {
  ensureIssue(options.issue);
  if (!options.to) {
    throw new Error('assign 缺少 --to');
  }
  const output = options.output || 'json';
  console.log(runMultica(['issue', 'assign', options.issue, '--to', options.to, '--output', output]));
}

function commandHandoff(options) {
  ensureIssue(options.issue);
  if (!options.to) {
    throw new Error('handoff 缺少 --to');
  }
  let commentResult = '';
  if (options['body-file']) {
    commentResult = commandCommentAdd({
      issue: options.issue,
      'body-file': options['body-file'],
      parent: options.parent,
      output: options.output || 'json',
      __silent: true,
    }) || '';
  }
  const assignResult = runMultica(['issue', 'assign', options.issue, '--to', options.to, '--output', options.output || 'json']);
  let statusResult = '';
  if (options.status) {
    statusResult = runMultica(['issue', 'status', options.issue, options.status]);
  }
  const payload = {
    issue: options.issue,
    assignee: options.to,
    status: options.status || '',
    comment_result: commentResult || '',
    assign_result: assignResult || '',
    status_result: statusResult || '',
  };
  console.log(JSON.stringify(payload, null, 2));
}

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  switch (command) {
    case 'issue-get':
      commandIssueGet(options);
      break;
    case 'comment-list':
      commandCommentList(options);
      break;
    case 'comment-add':
      commandCommentAdd(options);
      break;
    case 'status':
      commandStatus(options);
      break;
    case 'assign':
      commandAssign(options);
      break;
    case 'handoff':
      commandHandoff(options);
      break;
    default:
      throw new Error(`不支持的命令: ${command}`);
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || String(error));
  process.exit(1);
}
