#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { ensureBinary, probe, run } = require('./lib/exec');
const { dumpYaml, loadMergedConfig } = require('./lib/pace-config');

function usage() {
  console.error(
    [
      '用法: node <pace-bin>/pace-init.js [参数]',
      '',
      '作用:',
      '  初始化当前仓库的 `.pace/session.yaml`。',
      '  重复执行会直接覆盖 `.pace/session.yaml`，可用于修正填错的参数。',
      '',
      '常用参数:',
      '  --branch <name>',
      '  --git-name <name>',
      '  --git-email <email>',
      '  --issue-url <url>',
      '  --issue-title <title>',
      '  --issue-type <bug|feature|task>',
      '  --pr-url <url>',
      '  --base-branch <name>',
      '  --current-role <角色名>',
      '  --max-concurrent <n>',
      '  --model-profile <quality|balanced|budget|adaptive>',
      '',
      '自动探测规则:',
      '  --branch       未传时，尝试读取当前 git 分支。',
      '  --base-branch  未传时，尝试读取 `origin/HEAD`，失败则回退为 `main`。',
      '  --git-name     未传时，尝试读取 `git config user.name`。',
      '  --git-email    未传时，尝试读取 `git config user.email`。',
      '  --pr-url       未传时，保留为空。',
      '',
      '填错后如何修改:',
      '  直接用正确参数重新执行一次 `node <pace-bin>/pace-init.js`，会覆盖 `.pace/session.yaml`。',
      '  可以先查看当前文件：',
      '    cat .pace/session.yaml',
      '',
      '示例:',
      '  node "$HOME/.codex/skills/pace/bin/pace-init.js" --git-name "Ghost233" --git-email "you@example.com"',
    ].join('\n')
  );
}

function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const mode = 'local';
  let startIndex = 0;
  if (argv[0] && !argv[0].startsWith('--')) {
    if (argv[0] !== 'local') {
      console.error(`不支持的参数: ${argv[0]}`);
      usage();
      process.exit(1);
    }
    startIndex = 1;
  }

  const options = {};
  for (let i = startIndex; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      console.error(`无法解析参数: ${arg}`);
      usage();
      process.exit(1);
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith('--')) {
      console.error(`参数缺少值: ${arg}`);
      usage();
      process.exit(1);
    }
    options[key] = value;
    i += 1;
  }

  if (options['max-concurrent'] && !/^\d+$/.test(options['max-concurrent'])) {
    console.error('--max-concurrent 必须是正整数');
    process.exit(1);
  }
  if (options['max-concurrent']) {
    const value = Number(options['max-concurrent']);
    if (value < 1 || value > 5) {
      console.error('--max-concurrent 必须在 1 到 5 之间');
      process.exit(1);
    }
  }
  if (options['model-profile']) {
    const allowed = ['quality', 'balanced', 'budget', 'adaptive'];
    if (!allowed.includes(options['model-profile'])) {
      console.error(`--model-profile 只支持: ${allowed.join(', ')}`);
      process.exit(1);
    }
  }

  return { mode, options };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseNumberFromUrl(url, marker) {
  if (!url) return null;
  const regex = new RegExp(`/${marker}/(\\d+)(?:$|[?#/])`);
  const match = url.match(regex);
  return match ? Number(match[1]) : null;
}

function parseGitHubIssueUrl(url) {
  if (!url) return null;
  const match = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/(\d+)(?:[/?#].*)?$/);
  if (!match) return null;
  return {
    repo: match[1],
    number: Number(match[2]),
  };
}

function branchMentionsIssueNumber(branch, issueNumber) {
  if (!branch || !issueNumber) return false;
  const normalized = String(branch).trim().toLowerCase();
  const number = String(issueNumber);
  return new RegExp(`(?:^|[-_/])(?:issue-)?${number}(?:[-_/]|$)`).test(normalized);
}

function branchMatchesGitHubIssuePattern(branch, issueNumber) {
  if (!branch || !issueNumber) return false;
  const normalized = String(branch).trim().toLowerCase();
  return new RegExp(`^agent/github/issue-${String(issueNumber)}(?:$|[-/].+)`).test(normalized);
}

function nowIso() {
  return new Date().toISOString();
}

function validateGitHub(repo, expectedUser) {
  try {
    ensureBinary('gh', { message: 'gh 未安装' });
  } catch {
    return { verified: false, reason: 'gh 未安装', login: '' };
  }

  const login = probe('gh', ['api', 'user', '--jq', '.login'], { fallback: '' });
  if (!login) {
    return { verified: false, reason: 'gh 未登录', login: '' };
  }
  if (expectedUser && login !== expectedUser) {
    return { verified: false, reason: 'gh 当前用户与期望用户不一致', login };
  }
  const view = probe('gh', ['repo', 'view', repo, '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], { fallback: '' });
  if (!view || view !== repo) {
    return { verified: false, reason: '当前用户无法访问目标仓库', login };
  }

  return { verified: true, reason: '验证通过', login };
}

function buildConfig(mode = 'local', options = {}) {
  if (mode && typeof mode === 'object') {
    options = mode;
    mode = 'local';
  }
  if (mode !== 'local') {
    throw new Error(`不支持的模式: ${mode}`);
  }
  const loaded = loadMergedConfig(process.cwd(), mode, __filename);
  const config = loaded.merged;

  const branch = options.branch || probe('git', ['branch', '--show-current']);
  const headSha = probe('git', ['rev-parse', 'HEAD']);
  const defaultBase = probe('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
    .replace(/^origin\//, '');
  const baseBranch = options['base-branch'] || defaultBase || 'main';
  const repo = '';

  const gitName = options['git-name'] || probe('git', ['config', 'user.name']) || config.git?.name || '';
  const gitEmail = options['git-email'] || probe('git', ['config', 'user.email']) || config.git?.email || '';
  const loginProbe = '';
  const issueUrl = options['issue-url'] || '';
  const issueTitle = options['issue-title'] || '';
  const issueType = options['issue-type'] || '';
  const currentRole = options['current-role'] || '';

  const validation = repo ? validateGitHub(repo, loginProbe) : { verified: false, reason: '未提供 repo', login: loginProbe };

  config.executor = 'claude-code';
  config.tracker = config.tracker || {};
  config.tracker.type = config.tracker.type || 'local';
  config.tracker.github = config.tracker.github || {};
  config.tracker.github.repo = repo;
  config.tracker.github.username = loginProbe;
  config.tracker.github.verified = validation.verified;
  config.git = config.git || {};
  config.git.name = gitName;
  config.git.email = gitEmail;

  if (options['max-concurrent']) {
    config.agents = config.agents || {};
    config.agents.max_concurrent = Number(options['max-concurrent']);
  }
  if (options['model-profile']) {
    config.agents = config.agents || {};
    config.agents.model_profile = options['model-profile'];
  }

  return {
    loaded,
    config,
    context: {
      issue: {
        url: issueUrl,
        number: parseNumberFromUrl(issueUrl, 'issues'),
        title: issueTitle,
        type: issueType,
      },
      pr: {
        url: options['pr-url'] || '',
        number: parseNumberFromUrl(options['pr-url'] || '', 'pull'),
      },
      git: {
        branch,
        base_branch: baseBranch,
        head_sha: headSha,
      },
      role: {
        current: currentRole,
        previous: '',
      },
      session: {
        mode,
        started_at: nowIso(),
      },
    },
    validation,
  };
}

function writeSession(paceDir, session) {
  ensureDir(paceDir);
  const sessionPath = path.join(paceDir, 'session.yaml');
  fs.writeFileSync(sessionPath, `${dumpYaml(session)}\n`, 'utf8');
  return sessionPath;
}

function main() {
  const { mode, options } = parseArgs(process.argv.slice(2));

  let built;
  try {
    built = buildConfig(mode, options);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const sessionPath = writeSession(built.loaded.paceDir, {
    config: built.config,
    context: built.context,
  });

  console.log(`PACE 会话已初始化: ${sessionPath}`);
  console.log(`仓库: ${built.config.tracker.github.repo || '(未设置)'}`);
  console.log(`GitHub 用户: ${built.config.tracker.github.username || '(未设置)'}`);
  console.log(`GH 验证: ${built.validation.verified ? '通过' : `未通过 (${built.validation.reason})`}`);
  console.log(`当前分支: ${built.context.git.branch || '(未检测到)'}`);
  if (built.context.issue.url) {
    console.log(`Issue: ${built.context.issue.url}`);
  }
  if (built.context.pr.url) {
    console.log(`PR: ${built.context.pr.url}`);
  }
  if (built.context.role.current) {
    console.log(`当前角色: ${built.context.role.current}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  branchMatchesGitHubIssuePattern,
  branchMentionsIssueNumber,
  buildConfig,
  mustRunCommand: run,
  parseArgs,
  parseGitHubIssueUrl,
  parseNumberFromUrl,
  probeCommand: probe,
  validateGitHub,
  writeSession,
};
