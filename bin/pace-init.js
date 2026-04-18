#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { dumpYaml, loadMergedConfig } = require('./lib/pace-config');

function usage() {
  console.error(
    [
      '用法: pace-init <local|multica> [参数]',
      '',
      '常用参数:',
      '  --repo <owner/repo>',
      '  --github-user <username>',
      '  --git-name <name>',
      '  --git-email <email>',
      '  --issue-url <url>',
      '  --issue-title <title>',
      '  --issue-type <bug|feature|task>',
      '  --pr-url <url>',
      '  --branch <name>',
      '  --base-branch <name>',
      '  --current-role <PACE-...>',
      '  --max-concurrent <n>',
      '  --model-profile <quality|balanced|budget|adaptive>',
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

function parseGitHubRepoFromRemote(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : '';
}

function parseNumberFromUrl(url, marker) {
  if (!url) return null;
  const regex = new RegExp(`/${marker}/(\\d+)(?:$|[?#/])`);
  const match = url.match(regex);
  return match ? Number(match[1]) : null;
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

  const branch = options.branch || run('git', ['branch', '--show-current']);
  const headSha = run('git', ['rev-parse', 'HEAD']);
  const defaultBase = run('git', ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'])
    .replace(/^origin\//, '');
  const baseBranch = options['base-branch'] || defaultBase || 'main';
  const remoteUrl = run('git', ['remote', 'get-url', 'origin']);
  const remoteRepo = parseGitHubRepoFromRemote(remoteUrl);
  const repo = options.repo || remoteRepo || config.tracker?.github?.repo || '';

  const gitName = options['git-name'] || run('git', ['config', 'user.name']) || config.git?.name || '';
  const gitEmail = options['git-email'] || run('git', ['config', 'user.email']) || config.git?.email || '';
  const loginProbe = options['github-user'] || run('gh', ['api', 'user', '--jq', '.login']) || config.tracker?.github?.username || '';

  if (mode === 'multica' && !repo) {
    throw new Error('multica 模式必须提供 --repo，或当前仓库 remote 可解析出 GitHub repo');
  }

  const validation = repo ? validateGitHub(repo, loginProbe) : { verified: false, reason: '未提供 repo', login: loginProbe };

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
        url: options['issue-url'] || '',
        number: parseNumberFromUrl(options['issue-url'] || '', 'issues'),
        title: options['issue-title'] || '',
        type: options['issue-type'] || '',
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
        current: options['current-role'] || '',
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
