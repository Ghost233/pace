const { execFileSync } = require('child_process');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trimEnd();
}

function ensureGhInstalled() {
  try {
    run('which', ['gh']);
  } catch {
    throw new Error('gh 未安装，不能执行 GitHub 相关操作');
  }
}

function currentLogin() {
  try {
    return run('gh', ['api', 'user', '--jq', '.login']);
  } catch {
    return '';
  }
}

function switchUser(expectedUser) {
  if (!expectedUser) return;
  const current = currentLogin();
  if (current && current === expectedUser) {
    return;
  }
  try {
    run('gh', ['auth', 'switch', '-u', expectedUser], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch {
    throw new Error(`无法切换到 GitHub 用户 ${expectedUser}`);
  }
}

function ensureRepoAccessible(repo) {
  const view = run('gh', ['repo', 'view', repo, '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  if (view !== repo) {
    throw new Error(`当前用户无法访问仓库: ${repo}`);
  }
  return view;
}

function readGithubContext(session) {
  return {
    repo: session?.data?.config?.tracker?.github?.repo || '',
    username: session?.data?.config?.tracker?.github?.username || '',
    trackerType: session?.data?.config?.tracker?.type || '',
  };
}

function ensureGithubSession(session, { requireRepo = false, repoOverride = '' } = {}) {
  const context = readGithubContext(session);
  ensureGhInstalled();
  switchUser(context.username);
  const login = currentLogin();
  if (!login) {
    throw new Error('gh 未登录');
  }
  if (context.username && login !== context.username) {
    throw new Error(`当前 GitHub 用户与 session 不一致: 当前=${login}, 期望=${context.username}`);
  }
  let repo = repoOverride || context.repo;
  if (requireRepo) {
    if (!repo) {
      throw new Error('当前未配置 GitHub repo，请先运行 `node <pace-bin>/pace-init.js multica` 或补齐 `.pace/session.yaml`');
    }
    repo = ensureRepoAccessible(repo);
  }
  return {
    login,
    repo,
    username: context.username,
    trackerType: context.trackerType,
  };
}

module.exports = {
  currentLogin,
  ensureGhInstalled,
  ensureGithubSession,
  ensureRepoAccessible,
  run,
  switchUser,
};
