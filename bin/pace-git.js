#!/usr/bin/env node

const { execFileSync } = require('child_process');
const { loadSession } = require('./lib/pace-config');
const { ensureGithubSession } = require('./lib/github-cli');

function usage(exitCode = 0) {
  const text = [
    '用法: node <pace-bin>/pace-git.js <命令> [参数]',
    '',
    '作用:',
    '  通过受限白名单执行 git 操作，默认拒绝危险命令。',
    '  如果存在 `.pace/session.yaml`，commit / push 会优先使用其中的 git 身份和分支信息。',
    '  如果 session 配置了 GitHub repo/user，每次执行前都会在当前机器已完成 GitHub 登录的前提下，复用 pace-gh 同源逻辑切换 GitHub 用户。',
    '',
    '允许的命令:',
    '  status                     查看简要状态',
    '  diff [--staged] [路径...] 查看 diff',
    '  stage <路径...>            暂存指定路径',
    '  unstage <路径...>          取消暂存指定路径',
    '  commit -m <message>        用 session 里的 git 身份提交',
    '  push                       推送到 origin 当前分支',
    '  branch                     输出当前分支名',
    '  log [--count <n>]          查看最近提交',
    '  info                       输出 session 中的 git 信息',
    '',
    '限制规则:',
    '  - 不支持 reset / checkout / switch / rebase / merge / cherry-pick / clean / stash / tag / branch 创建删除',
    '  - 不支持 force push',
    '  - `stage` 和 `unstage` 必须显式传路径',
    '  - `commit` 必须显式传 `-m`',
    '',
    '示例:',
    '  node "$HOME/.codex/skills/pace/bin/pace-git.js" status',
    '  node "$HOME/.codex/skills/pace/bin/pace-git.js" diff --staged README.md',
    '  node "$HOME/.codex/skills/pace/bin/pace-git.js" stage README.md bin/pace-git.js',
    '  node "$HOME/.codex/skills/pace/bin/pace-git.js" commit -m "docs: update workflow"',
    '  node "$HOME/.codex/skills/pace/bin/pace-git.js" push',
  ].join('\n');
  console.error(text);
  process.exit(exitCode);
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trimEnd();
}

function runGitWithSession(args, session, options = {}) {
  const gitArgs = [];
  const name = session?.data?.config?.git?.name || '';
  const email = session?.data?.config?.git?.email || '';
  if (name) {
    gitArgs.push('-c', `user.name=${name}`);
  }
  if (email) {
    gitArgs.push('-c', `user.email=${email}`);
  }
  return runGit([...gitArgs, ...args], options);
}

function ensurePaths(paths, commandName) {
  if (!paths.length) {
    throw new Error(`${commandName} 必须显式提供至少一个路径`);
  }
  for (const p of paths) {
    if (p.startsWith('-')) {
      throw new Error(`${commandName} 不允许传入 git 选项: ${p}`);
    }
    if (p === '.' || p === '*') {
      throw new Error(`${commandName} 不允许使用宽泛路径: ${p}`);
    }
  }
}

function ensureCommitMessage(argv) {
  const idx = argv.findIndex((item) => item === '-m' || item === '--message');
  if (idx === -1 || !argv[idx + 1]) {
    throw new Error('commit 必须通过 -m 或 --message 提供提交信息');
  }
  if (argv.slice(0, idx).some((item) => item.startsWith('-')) || argv.slice(idx + 2).some((item) => item.startsWith('-'))) {
    // allow only -m/--message
    const unsupported = argv.filter((item) => item.startsWith('-') && item !== '-m' && item !== '--message');
    if (unsupported.length) {
      throw new Error(`commit 不支持这些选项: ${unsupported.join(', ')}`);
    }
  }
  return argv[idx + 1];
}

function ensureSessionForWrite(session, commandName) {
  if (!session.exists) {
    throw new Error(`${commandName} 需要先存在 .pace/session.yaml，请先运行 node "$HOME/.codex/skills/pace/bin/pace-init.js" local 或 multica`);
  }
  const name = session?.data?.config?.git?.name || '';
  const email = session?.data?.config?.git?.email || '';
  if (!name || !email) {
    throw new Error(`${commandName} 需要 .pace/session.yaml 中存在 config.git.name 和 config.git.email`);
  }
}

function maybeEnsureGithubSwitch(session, { requireRepo = false } = {}) {
  const trackerType = session?.data?.config?.tracker?.type || '';
  if (trackerType !== 'github') {
    return null;
  }
  return ensureGithubSession(session, { requireRepo });
}

function hasStagedChanges() {
  try {
    execFileSync('git', ['diff', '--cached', '--quiet'], {
      cwd: process.cwd(),
      stdio: 'ignore',
    });
    return false;
  } catch (error) {
    if (error && error.status === 1) {
      return true;
    }
    throw error;
  }
}

function currentBranch() {
  return runGit(['branch', '--show-current']);
}

function parseGitHubRepoFromRemote(remoteUrl) {
  const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? match[1] : '';
}

function currentOriginRepo() {
  const remoteUrl = runGit(['remote', 'get-url', 'origin']);
  return parseGitHubRepoFromRemote(remoteUrl);
}

function ensureSessionBranchMatchesCurrent(session, commandName) {
  const sessionBranch = session?.data?.context?.git?.branch || '';
  if (!sessionBranch) {
    return currentBranch();
  }
  const current = currentBranch();
  if (!current) {
    throw new Error(`无法确定当前分支，不能执行 ${commandName}`);
  }
  if (sessionBranch !== current) {
    throw new Error(`当前分支与 session 不一致: 当前=${current}, session=${sessionBranch}；请重新运行 pace-init`);
  }
  return current;
}

function ensureNoForceFlags(argv) {
  const blocked = argv.filter((item) => item === '--force' || item === '-f');
  if (blocked.length) {
    throw new Error(`不支持危险参数: ${blocked.join(', ')}`);
  }
}

function commandInfo(session) {
  const branch = currentBranch();
  const name = session?.data?.config?.git?.name || '';
  const email = session?.data?.config?.git?.email || '';
  const base = session?.data?.context?.git?.base_branch || '';
  const repo = session?.data?.config?.tracker?.github?.repo || '';
  const role = session?.data?.context?.role?.current || '';

  console.log(`当前分支: ${branch || '(未检测到)'}`);
  console.log(`基础分支: ${base || '(未设置)'}`);
  console.log(`Git 身份: ${name || '(未设置)'} <${email || '(未设置)'}>`);
  console.log(`GitHub 仓库: ${repo || '(未设置)'}`);
  console.log(`当前角色: ${role || '(未设置)'}`);
  if (session.exists) {
    console.log(`Session 文件: ${session.sessionPath}`);
  } else {
    console.log('Session 文件: (不存在)');
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    usage(0);
  }

  const [command, ...rest] = argv;
  const session = loadSession(process.cwd());

  try {
    switch (command) {
      case 'status': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        if (rest.length) throw new Error('status 不接受额外参数');
        console.log(runGit(['status', '-sb']));
        break;
      }
      case 'diff': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        const staged = rest.includes('--staged');
        const paths = rest.filter((item) => item !== '--staged');
        const args = ['diff'];
        if (staged) args.push('--staged');
        if (paths.length) args.push('--', ...paths);
        console.log(runGit(args, { stdio: ['ignore', 'pipe', 'inherit'] }));
        break;
      }
      case 'stage': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        ensurePaths(rest, 'stage');
        runGit(['add', '--', ...rest], { stdio: 'inherit' });
        break;
      }
      case 'unstage': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        ensurePaths(rest, 'unstage');
        runGit(['restore', '--staged', '--', ...rest], { stdio: 'inherit' });
        break;
      }
      case 'commit': {
        ensureSessionForWrite(session, 'commit');
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        ensureSessionBranchMatchesCurrent(session, 'commit');
        const message = ensureCommitMessage(rest);
        if (!hasStagedChanges()) {
          throw new Error('当前没有已暂存改动，不能执行 commit');
        }
        runGitWithSession(['commit', '-m', message], session, { stdio: 'inherit' });
        break;
      }
      case 'push': {
        ensureSessionForWrite(session, 'push');
        const ghState = maybeEnsureGithubSwitch(session, { requireRepo: true });
        ensureNoForceFlags(rest);
        if (rest.length) {
          throw new Error('push 不接受额外参数；固定推送到 origin 当前分支');
        }
        const current = ensureSessionBranchMatchesCurrent(session, 'push');
        const originRepo = currentOriginRepo();
        if (!originRepo) {
          throw new Error('无法从 origin 远端解析 GitHub repo，不能执行 push');
        }
        if (ghState?.repo && originRepo !== ghState.repo) {
          throw new Error(`origin 远端与 session.repo 不一致: origin=${originRepo}, session=${ghState.repo}`);
        }
        runGit(['push', 'origin', current], { stdio: 'inherit' });
        break;
      }
      case 'branch': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        if (rest.length) throw new Error('branch 不接受额外参数');
        console.log(currentBranch());
        break;
      }
      case 'log': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        let count = '10';
        if (rest.length) {
          if (rest[0] !== '--count' || !rest[1] || rest.length !== 2) {
            throw new Error('log 只支持 --count <n>');
          }
          count = rest[1];
          if (!/^\d+$/.test(count)) {
            throw new Error('--count 必须是正整数');
          }
        }
        console.log(runGit(['log', '--oneline', '--decorate', '-n', count]));
        break;
      }
      case 'info': {
        maybeEnsureGithubSwitch(session, { requireRepo: false });
        if (rest.length) throw new Error('info 不接受额外参数');
        commandInfo(session);
        break;
      }
      default:
        throw new Error(`不支持的命令: ${command}`);
    }
  } catch (error) {
    console.error(error.message || String(error));
    process.exit(1);
  }
}

main();
