#!/usr/bin/env node

const path = require('path');

const { applyRuntimeGuard, computeDecision, renderDecisionText } = require('./lib/workflow');

function usage(exitCode = 0) {
  const text = [
    '用法: node <pace-bin>/pace-workflow.js [route] [--json] [--no-record]',
    '',
    '作用:',
    '  读取当前工作区的 `.pace/session.yaml`、`.pace/state.md`、`.pace/roadmap.md`、`.pace/requirements.md`',
    '  以及当前 phase 产物，输出当前子阶段、下一步 skill、阻塞码与证据。',
    '',
    '参数:',
    '  route        计算当前 workflow 路由（默认命令）',
    '  --json       以 JSON 输出，便于 role / skill / 外部脚本消费',
    '  --no-record  不写入 `.pace/runtime/workflow-state.json` 重复路由记录',
    '',
    '说明:',
    '  - 当前推荐让 `pace:workflow` 或兼容 role 先调用这个脚本，再决定是否执行下一 skill',
    '  - 默认会记录 runtime fingerprint，用于阻止同一路由在无新产物时无限重复',
    '',
    '示例:',
    '  node "$HOME/.codex/skills/pace/bin/pace-workflow.js"',
    '  node "$HOME/.codex/skills/pace/bin/pace-workflow.js" route --json',
    '  node "$HOME/.codex/skills/pace/bin/pace-workflow.js" route --json --no-record',
  ].join('\n');
  console.error(text);
  process.exit(exitCode);
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage(0);
  }

  let command = 'route';
  const flags = new Set();

  for (const arg of argv) {
    if (arg === 'route') {
      command = arg;
      continue;
    }
    if (arg === '--json' || arg === '--no-record') {
      flags.add(arg);
      continue;
    }
    usage(1);
  }

  return {
    command,
    json: flags.has('--json'),
    record: !flags.has('--no-record'),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command !== 'route') {
    usage(1);
  }

  const cwd = process.cwd();
  let decision = computeDecision(cwd);
  decision = applyRuntimeGuard(cwd, decision, { record: args.record });
  decision.driver = {
    script: path.basename(__filename),
    cwd,
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderDecisionText(decision));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  parseArgs,
};
