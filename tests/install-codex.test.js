const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('node:child_process');

function writeFile(root, relativePath, content, mode) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  if (mode) {
    fs.chmodSync(target, mode);
  }
}

function createInstallSource(root, options = {}) {
  const skills = options.skills || ['workflow'];
  const skillFiles = options.skillFiles || [];
  const extraRoleTemplates = Array.isArray(options.extraRoleTemplate)
    ? options.extraRoleTemplate
    : (options.extraRoleTemplate ? [options.extraRoleTemplate] : []);

  for (const skill of skills) {
    writeFile(root, `.claude-plugin/skills/${skill}/SKILL.md`, `# ${skill}\n`);
  }
  for (const skillFile of skillFiles) {
    writeFile(root, `.claude-plugin/skills/${skillFile}`, '# raw skill file\n');
  }

  writeFile(root, '.pace/config.yaml', 'executor: claude-code\n');
  writeFile(root, '.pace/config.local.yaml', 'tracker:\n  type: local\n');

  const binFiles = options.binFiles || [
    'pace-merge.js',
    'pace-init.js',
    'pace-workflow.js',
    'pace-git.js',
  ];
  const binContents = {
    'pace-merge.js': '#!/usr/bin/env node\nrequire("./lib/pace-config");\nif (process.argv.includes("--help")) console.log("用法:");\n',
    'pace-init.js': '#!/usr/bin/env node\nrequire("./lib/exec");\nrequire("./lib/pace-config");\nif (process.argv.includes("--help")) console.log("用法:");\n',
    'pace-workflow.js': '#!/usr/bin/env node\nrequire("./lib/workflow");\nif (process.argv.includes("--help")) console.log("用法:");\n',
    'pace-git.js': '#!/usr/bin/env node\nrequire("./lib/exec");\nrequire("./lib/github-cli");\nrequire("./lib/pace-config");\nif (process.argv.includes("--help")) console.log("用法:");\n',
  };
  for (const file of binFiles) {
    writeFile(root, `bin/${file}`, binContents[file] || '#!/usr/bin/env node\n', 0o755);
  }
  writeFile(root, 'bin/lib/exec.js', 'module.exports = {};\n');
  writeFile(root, 'bin/lib/github-cli.js', 'module.exports = {};\n');
  writeFile(root, 'bin/lib/pace-config.js', 'module.exports = {};\n');
  writeFile(root, 'bin/lib/workflow.js', 'module.exports = {};\n');

  writeFile(root, 'roles/流程经理.md', '# 流程经理\n');
  writeFile(root, 'roles/templates/workflow-final-comment.template.md', '# workflow template\n');
  for (const template of extraRoleTemplates) {
    writeFile(root, `roles/templates/${template}`, '# old template\n');
  }
}

function runInstall(scriptPath, sourceDir, codexHome, expectedStatus = 0) {
  const result = spawnSync('bash', [scriptPath], {
    cwd: path.dirname(scriptPath),
    encoding: 'utf8',
    env: {
      ...process.env,
      CODEX_HOME: codexHome,
      PACE_INSTALL_SOURCE_DIR: sourceDir,
    },
  });

  assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
  return result;
}

test('install-codex keeps unknown custom content while pruning previously managed paths', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-test-'));
  const sourceV1 = path.join(tempRoot, 'source-v1');
  const sourceV2 = path.join(tempRoot, 'source-v2');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(sourceV1, {
    skills: ['alpha', 'workflow'],
    extraRoleTemplate: 'managed-old.template.md',
  });
  runInstall(scriptPath, sourceV1, codexHome);

  writeFile(paceHome, 'alpha/USER.md', 'custom user file\n');
  writeFile(paceHome, 'custom-root/NOTE.md', 'custom root file\n');
  writeFile(paceHome, 'roles/templates/custom.template.md', 'custom role template\n');

  createInstallSource(sourceV2, {
    skills: ['workflow'],
  });
  runInstall(scriptPath, sourceV2, codexHome);

  assert.ok(fs.existsSync(path.join(paceHome, '.pace-install-manifest.txt')));
  assert.equal(fs.existsSync(path.join(paceHome, 'alpha/SKILL.md')), false);
  assert.equal(fs.existsSync(path.join(paceHome, 'roles/templates/managed-old.template.md')), false);
  assert.ok(fs.existsSync(path.join(paceHome, 'alpha/USER.md')));
  assert.ok(fs.existsSync(path.join(paceHome, 'custom-root/NOTE.md')));
  assert.ok(fs.existsSync(path.join(paceHome, 'roles/templates/custom.template.md')));
  assert.ok(fs.existsSync(path.join(paceHome, 'workflow/SKILL.md')));
  for (const script of ['pace-init.js', 'pace-workflow.js']) {
    const result = spawnSync(process.execPath, [path.join(paceHome, 'bin', script), '--help'], {
      cwd: paceHome,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, /用法:/);
  }
});

test('install-codex first manifest upgrade prunes legacy managed paths in fully managed dirs', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-legacy-test-'));
  const source = path.join(tempRoot, 'source');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(source, {
    skills: ['workflow'],
  });

  writeFile(paceHome, 'bin/legacy-old.js', '#!/usr/bin/env node\n');
  writeFile(paceHome, 'bin/custom-user.js', '#!/usr/bin/env node\n');
  writeFile(paceHome, 'bin/pace-gh.js', '#!/usr/bin/env node\n');
  writeFile(paceHome, 'bin/pace-issue-doc.js', '#!/usr/bin/env node\n');
  writeFile(paceHome, 'bin/pace-multica.js', '#!/usr/bin/env node\n');
  writeFile(paceHome, 'roles/templates/closeout-archive-comment.template.md', '# old template\n');
  writeFile(paceHome, 'roles/templates/custom-user.template.md', '# custom template\n');
  writeFile(paceHome, '.pace/config.multica.yaml', '# old config\n');
  writeFile(paceHome, '.pace/custom-user.yaml', 'custom: true\n');
  writeFile(paceHome, 'custom-root/NOTE.md', 'keep me\n');

  runInstall(scriptPath, source, codexHome);

  assert.ok(fs.existsSync(path.join(paceHome, '.pace-install-manifest.txt')));
  assert.ok(fs.existsSync(path.join(paceHome, 'bin/legacy-old.js')));
  assert.equal(fs.existsSync(path.join(paceHome, 'bin/pace-gh.js')), false);
  assert.equal(fs.existsSync(path.join(paceHome, 'bin/pace-issue-doc.js')), false);
  assert.equal(fs.existsSync(path.join(paceHome, 'bin/pace-multica.js')), false);
  assert.equal(fs.existsSync(path.join(paceHome, 'roles/templates/closeout-archive-comment.template.md')), false);
  assert.equal(fs.existsSync(path.join(paceHome, '.pace/config.multica.yaml')), false);
  assert.ok(fs.existsSync(path.join(paceHome, 'bin/custom-user.js')));
  assert.ok(fs.existsSync(path.join(paceHome, 'roles/templates/custom-user.template.md')));
  assert.ok(fs.existsSync(path.join(paceHome, '.pace/custom-user.yaml')));
  assert.ok(fs.existsSync(path.join(paceHome, 'custom-root/NOTE.md')));
});

test('install-codex replaces managed symlink paths instead of following them', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-symlink-test-'));
  const source = path.join(tempRoot, 'source');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const outsideBin = path.join(tempRoot, 'outside-bin');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(source);
  fs.mkdirSync(path.dirname(path.join(paceHome, 'bin')), { recursive: true });
  fs.mkdirSync(outsideBin, { recursive: true });
  writeFile(outsideBin, 'outside.txt', 'outside\n');
  fs.symlinkSync(outsideBin, path.join(paceHome, 'bin'));

  runInstall(scriptPath, source, codexHome);

  assert.equal(fs.lstatSync(path.join(paceHome, 'bin')).isSymbolicLink(), false);
  assert.ok(fs.existsSync(path.join(paceHome, 'bin/pace-init.js')));
  assert.equal(fs.existsSync(path.join(outsideBin, 'pace-init.js')), false);
  assert.ok(fs.existsSync(path.join(outsideBin, 'outside.txt')));
});

test('install-codex tolerates old sources without pace-workflow.js', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-old-source-test-'));
  const source = path.join(tempRoot, 'source');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(source, {
    binFiles: [
      'pace-merge.js',
      'pace-init.js',
      'pace-git.js',
    ],
  });

  runInstall(scriptPath, source, codexHome);

  assert.equal(fs.existsSync(path.join(paceHome, 'bin/pace-workflow.js')), false);
  assert.ok(fs.existsSync(path.join(paceHome, 'bin/pace-init.js')));
});

test('install-codex aborts on directory-to-file conflicts that would delete unmanaged content', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-conflict-test-'));
  const sourceV1 = path.join(tempRoot, 'source-v1');
  const sourceV2 = path.join(tempRoot, 'source-v2');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(sourceV1, {
    skills: ['alpha', 'workflow'],
  });
  runInstall(scriptPath, sourceV1, codexHome);
  writeFile(paceHome, 'alpha/CUSTOM.md', 'keep me\n');

  createInstallSource(sourceV2, {
    skills: ['workflow'],
    skillFiles: ['alpha'],
  });
  const result = runInstall(scriptPath, sourceV2, codexHome, 1);

  assert.match(`${result.stdout}\n${result.stderr}`, /目录转文件会覆盖未托管内容|不能直接替换为文件/);
  assert.ok(fs.existsSync(path.join(paceHome, 'alpha/CUSTOM.md')));
});

test('install-codex aborts on file-to-directory conflicts that would delete unmanaged content', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-file-dir-conflict-test-'));
  const source = path.join(tempRoot, 'source');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(source, {
    skills: ['workflow'],
  });
  writeFile(paceHome, 'workflow', 'custom file\n');

  const result = runInstall(scriptPath, source, codexHome, 1);

  assert.match(`${result.stdout}\n${result.stderr}`, /未托管文件|文件转目录会覆盖现有文件/);
  assert.equal(fs.readFileSync(path.join(paceHome, 'workflow'), 'utf8'), 'custom file\n');
});

test('install-codex aborts when manifest path is a symlink', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pace-install-manifest-symlink-test-'));
  const source = path.join(tempRoot, 'source');
  const codexHome = path.join(tempRoot, 'codex-home');
  const paceHome = path.join(codexHome, 'skills', 'pace');
  const outsideManifest = path.join(tempRoot, 'outside-manifest.txt');
  const scriptPath = path.resolve(__dirname, '..', 'bin/install-codex.sh');

  createInstallSource(source);
  fs.mkdirSync(paceHome, { recursive: true });
  writeFile(tempRoot, 'outside-manifest.txt', 'outside\n');
  fs.symlinkSync(outsideManifest, path.join(paceHome, '.pace-install-manifest.txt'));

  const result = runInstall(scriptPath, source, codexHome, 1);

  assert.match(`${result.stdout}\n${result.stderr}`, /manifest 路径不能是符号链接/);
  assert.equal(fs.readFileSync(outsideManifest, 'utf8'), 'outside\n');
});
