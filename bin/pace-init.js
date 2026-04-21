#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { dumpYaml, loadMergedConfig } = require('./lib/pace-config');

function usage() {
  console.error(
    [
      '用法: node <pace-bin>/pace-init.js <local|multica> [参数]',
      '',
      '作用:',
      '  初始化当前仓库的 `.pace/session.yaml`。',
      '  重复执行会直接覆盖 `.pace/session.yaml`，可用于修正填错的参数。',
      '',
      '模式说明:',
      '  local    生成本地执行会话，默认 `executor=claude-code`。',
      '  multica  生成外部编排会话，默认 `executor=multica`、`tracker.type=github`。',
      '',
      '常用参数:',
      '  --repo <owner/repo>',
      '  --branch <name>',
      '  --github-user <username>',
      '  --git-name <name>',
      '  --git-email <email>',
      '  --issue-url <url>',
      '  --issue-title <title>',
      '  --issue-type <bug|feature|task>',
      '  --pr-url <url>',
      '  --base-branch <name>',
      '  --current-role <PACE-...>',
      '  --max-concurrent <n>',
      '  --model-profile <quality|balanced|budget|adaptive>',
      '',
      '自动探测规则:',
      '  --repo         multica 模式必填；local 模式忽略。',
      '  --branch       multica 模式必填；local 模式未传时，尝试读取当前 git 分支。',
      '  --base-branch  未传时，尝试读取 `origin/HEAD`，失败则回退为 `main`。',
      '  --github-user  multica 模式必填；local 模式未传则保留为空。',
      '  --git-name     未传时，尝试读取 `git config user.name`。',
      '  --git-email    未传时，尝试读取 `git config user.email`。',
      '  --pr-url       未传时，保留为空。',
      '',
      'multica 模式必须显式传入:',
      '  --repo',
      '  --branch',
      '  --github-user',
      '  --git-name',
      '  --git-email',
      '  --issue-url',
      '  --issue-title',
      '  --issue-type',
      '  --current-role',
      '',
      '填错后如何修改:',
      '  直接用正确参数重新执行一次 `node <pace-bin>/pace-init.js`，会覆盖 `.pace/session.yaml`。',
      '  可以先查看当前文件：',
      '    cat .pace/session.yaml',
      '',
      '示例:',
      '  node "$HOME/.codex/skills/pace/bin/pace-init.js" local --git-name "Ghost233" --git-email "you@example.com"',
      '',
      '  node "$HOME/.codex/skills/pace/bin/pace-init.js" multica \\',
      '    --repo Conso-xFinite/Telegram-iOS \\',
      '    --branch fix-draft-send-button \\',
      '    --github-user ghost233 \\',
      '    --git-name "Ghost233" \\',
      '    --git-email "you@example.com" \\',
      '    --issue-url "https://github.com/Conso-xFinite/Telegram-iOS/issues/72" \\',
      '    --issue-title "创作者中心的草稿编辑页面,发送按钮消失了" \\',
      '    --issue-type bug \\',
      '    --current-role "PACE-需求接管经理"',
    ].join('\n')
  );
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    usage();
    process.exit(0);
  }

  const mode = argv[0];
  if (!['local', 'multica'].includes(mode)) {
    console.error(`不支持的模式: ${mode}`);
    usage();
    process.exit(1);
  }

  const options = {};
  for (let i = 1; i < argv.length; i += 1) {
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

function run(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
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

function nowIso() {
  return new Date().toISOString();
}

function validateGitHub(repo, expectedUser) {
  const ghPath = run('which', ['gh']);
  if (!ghPath) {
    return { verified: false, reason: 'gh 未安装', login: '' };
  }

  const login = run('gh', ['api', 'user', '--jq', '.login']);
  if (!login) {
    return { verified: false, reason: 'gh 未登录', login: '' };
  }
  if (expectedUser && login !== expectedUser) {
    return { verified: false, reason: 'gh 当前用户与期望用户不一致', login };
  }
  const view = run('gh', ['repo', 'view', repo, '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  if (!view || view !== repo) {
    return { verified: false, reason: '当前用户无法访问目标仓库', login };
  }

  return { verified: true, reason: '验证通过', login };
}

function buildConfig(mode, options) {
  const loaded = loadMergedConfig(process.cwd(), mode, __filename);
  const config = loaded.merged;

  const branch = mode === 'multica'
    ? (options.branch || '')
    : (options.branch || run('git', ['branch', '--show-current']));
  const headSha = run('git', ['rev-parse', 'HEAD']);
  const defaultBase = run('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
    .replace(/^origin\//, '');
  const baseBranch = options['base-branch'] || defaultBase || 'main';
  const repo = mode === 'multica'
    ? (options.repo || '')
    : '';

  const gitName = options['git-name'] || run('git', ['config', 'user.name']) || config.git?.name || '';
  const gitEmail = options['git-email'] || run('git', ['config', 'user.email']) || config.git?.email || '';
  const loginProbe = mode === 'multica'
    ? (options['github-user'] || '')
    : '';
  const issueUrl = options['issue-url'] || '';
  const issueTitle = options['issue-title'] || '';
  const issueType = options['issue-type'] || '';
  const currentRole = options['current-role'] || '';

  if (mode === 'multica') {
    const missing = [];
    if (!repo) missing.push('--repo');
    if (!branch) missing.push('--branch');
    if (!loginProbe) missing.push('--github-user');
    if (!options['git-name']) missing.push('--git-name');
    if (!options['git-email']) missing.push('--git-email');
    if (!issueUrl) missing.push('--issue-url');
    if (!issueTitle) missing.push('--issue-title');
    if (!issueType) missing.push('--issue-type');
    if (!currentRole) missing.push('--current-role');
    if (missing.length > 0) {
      throw new Error(
        `multica 模式缺少必填参数:\n- ${missing.join('\n- ')}\n请一次性补齐后重试，不要逐项猜测或回填本地 git/gh 状态。`
      );
    }

    const parsedIssue = parseGitHubIssueUrl(issueUrl);
    if (!parsedIssue) {
      throw new Error('--issue-url 必须是合法的 GitHub issue URL');
    }
    if (parsedIssue.repo !== repo) {
      throw new Error(`--issue-url 不属于当前 --repo: ${parsedIssue.repo} !== ${repo}`);
    }
  }

  const validation = repo ? validateGitHub(repo, loginProbe) : { verified: false, reason: '未提供 repo', login: loginProbe };

  if (mode === 'multica' && !validation.verified) {
    throw new Error(`multica 模式初始化失败：GitHub 校验未通过 (${validation.reason})`);
  }

  config.executor = mode === 'multica' ? 'multica' : 'claude-code';
  config.tracker = config.tracker || {};
  config.tracker.type = mode === 'multica' ? 'github' : (config.tracker.type || 'local');
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
  console.log(`模式: ${mode}`);
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

main();
