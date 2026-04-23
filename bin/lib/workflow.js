const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { loadSession } = require('./pace-config');

const TOP_LEVEL_CODE_DIRS = new Set([
  'app',
  'apps',
  'client',
  'cmd',
  'internal',
  'lib',
  'packages',
  'pkg',
  'server',
  'services',
  'src',
  'test',
  'tests',
]);

const TOP_LEVEL_CODE_FILES = new Set([
  'Cargo.toml',
  'Gemfile',
  'Makefile',
  'composer.json',
  'go.mod',
  'manage.py',
  'package-lock.json',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'pyproject.toml',
  'requirements.txt',
  'setup.py',
  'tsconfig.json',
  'vite.config.js',
  'vite.config.ts',
  'yarn.lock',
]);

const CODE_EXTENSIONS = new Set([
  '.c',
  '.cc',
  '.cpp',
  '.cs',
  '.css',
  '.go',
  '.h',
  '.hpp',
  '.java',
  '.js',
  '.jsx',
  '.kt',
  '.m',
  '.php',
  '.py',
  '.rb',
  '.rs',
  '.scala',
  '.sh',
  '.sql',
  '.swift',
  '.ts',
  '.tsx',
  '.vue',
]);

const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.pace',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'tmp',
]);

const REQUIREMENT_CONTEXT_SECTIONS = ['Goal', 'Phase Boundary', 'Locked Decisions', 'References'];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readFileIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function normalizeLineValue(value) {
  if (value == null) return '';
  return String(value).trim();
}

function stripCodeFence(value) {
  let text = normalizeLineValue(value);
  if (text.startsWith('`') && text.endsWith('`') && text.length >= 2) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function isPlaceholderValue(value) {
  const text = stripCodeFence(value).toLowerCase();
  return (
    text === '' ||
    text === 'none' ||
    text === 'n/a' ||
    text === '无' ||
    text === '待补充。' ||
    /^<.*>$/.test(text)
  );
}

function cleanScalar(value) {
  const text = stripCodeFence(value);
  return isPlaceholderValue(text) ? '' : text;
}

function splitHeadingSections(text, level = 2) {
  const lines = String(text || '').split(/\r?\n/);
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (match && match[1].length === level) {
      if (current) {
        current.body = current.lines.join('\n').trim();
        delete current.lines;
        sections.push(current);
      }
      current = {
        title: match[2].trim(),
        lines: [],
      };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }

  if (current) {
    current.body = current.lines.join('\n').trim();
    delete current.lines;
    sections.push(current);
  }

  return sections;
}

function sectionsToMap(sections) {
  return Object.fromEntries(sections.map((section) => [section.title, section.body]));
}

function extractBullets(body) {
  return String(body || '')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+(.*)$/))
    .filter(Boolean)
    .map((match) => cleanScalar(match[1]))
    .filter(Boolean);
}

function firstBullet(body) {
  return extractBullets(body)[0] || '';
}

function hasMeaningfulBody(body) {
  const text = String(body || '').replace(/\s+/g, ' ').trim();
  return Boolean(text) && !isPlaceholderValue(text);
}

function normalizePhaseToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeArtifactKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\.plan\.md$|\.run\.md$/g, '')
    .replace(/^plan\s+/, '')
    .replace(/[^a-z0-9]+/g, '');
}

function phaseIdToDirName(phaseId) {
  const normalized = String(phaseId || '')
    .trim()
    .replace(/^phase\s+/i, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized ? `phase-${normalized}` : 'phase';
}

function isActiveRequirementStatus(status) {
  const normalized = cleanScalar(status).toLowerCase();
  return normalized === '' || normalized === 'active' || normalized === 'proposed';
}

function parseStateMarkdown(text) {
  const sections = sectionsToMap(splitHeadingSections(text, 2));
  return {
    currentMilestone: firstBullet(sections['Current Milestone']),
    currentPhase: firstBullet(sections['Current Phase']),
    currentStep: firstBullet(sections['Current Step']),
    recommendedNextSkill: firstBullet(sections['Recommended Next Skill']),
    knownBlockers: extractBullets(sections['Known Blockers']),
  };
}

function parseVerificationMarkdown(text) {
  const sections = sectionsToMap(splitHeadingSections(text, 2));
  return {
    finalStatus: firstBullet(sections['Final Status']).toLowerCase(),
    blockingGaps: extractBullets(sections['Blocking Gaps']),
    recommendedNextStep: firstBullet(sections['Recommended Next Step']),
  };
}

function parseContextMarkdown(text) {
  const sections = sectionsToMap(splitHeadingSections(text, 2));
  const missingSections = REQUIREMENT_CONTEXT_SECTIONS.filter((title) => !hasMeaningfulBody(sections[title]));
  return {
    sections,
    missingSections,
    complete: missingSections.length === 0,
  };
}

function collectListField(result, key) {
  if (!Array.isArray(result[key])) {
    result[key] = [];
  }
}

function parseRoadmapPhaseBody(body) {
  const result = {
    type: '',
    ownerSkill: '',
    expectedOutputs: [],
    goal: '',
    requirements: [],
    nonGoals: [],
    successCriteria: [],
    entryCriteria: [],
    doneCriteria: [],
    dependsOn: [],
    status: '',
  };

  const fieldMap = {
    Type: 'type',
    'Owner Skill': 'ownerSkill',
    'Expected Outputs': 'expectedOutputs',
    Goal: 'goal',
    Requirements: 'requirements',
    'Non-Goals': 'nonGoals',
    'Success Criteria': 'successCriteria',
    'Entry Criteria': 'entryCriteria',
    'Done Criteria': 'doneCriteria',
    'Depends On': 'dependsOn',
    Status: 'status',
  };

  let currentListField = '';
  for (const line of String(body || '').split(/\r?\n/)) {
    const fieldMatch = line.match(/^- ([^:]+):\s*(.*)$/);
    if (fieldMatch) {
      const fieldName = fieldMap[fieldMatch[1].trim()];
      const rawValue = fieldMatch[2].trim();
      currentListField = '';
      if (!fieldName) continue;
      if (rawValue) {
        if (Array.isArray(result[fieldName])) {
          result[fieldName] = [cleanScalar(rawValue)].filter(Boolean);
        } else {
          result[fieldName] = cleanScalar(rawValue);
        }
      } else {
        collectListField(result, fieldName);
        currentListField = fieldName;
      }
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListField) {
      const item = cleanScalar(listMatch[1]);
      if (item) {
        result[currentListField].push(item);
      }
    }
  }

  return result;
}

function parseRoadmapMarkdown(text) {
  const sectionMap = sectionsToMap(splitHeadingSections(text, 2));
  const phaseRegex = /^###\s+(Phase\s+[0-9.]+):\s*(.*)$/gm;
  const matches = Array.from(String(text || '').matchAll(phaseRegex));
  const phases = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : String(text || '').length;
    const body = String(text || '').slice(start, end).trim();
    const parsed = parseRoadmapPhaseBody(body);
    return {
      id: match[1].trim(),
      title: cleanScalar(match[2]) || match[2].trim(),
      ...parsed,
    };
  });

  return {
    currentMilestone: firstBullet(sectionMap['Current Milestone']),
    phases,
  };
}

function parseRequirementsEntryBody(body) {
  const result = {
    goal: '',
    successCriteria: [],
    nonGoals: [],
    externalDependencies: [],
    ownerPhase: '',
    status: '',
  };
  const fieldMap = {
    Goal: 'goal',
    'Success Criteria': 'successCriteria',
    'Non-Goals': 'nonGoals',
    'External Dependencies': 'externalDependencies',
    'Owner Phase': 'ownerPhase',
    Status: 'status',
  };
  let currentListField = '';

  for (const line of String(body || '').split(/\r?\n/)) {
    const fieldMatch = line.match(/^- ([^:]+):\s*(.*)$/);
    if (fieldMatch) {
      const fieldName = fieldMap[fieldMatch[1].trim()];
      const rawValue = fieldMatch[2].trim();
      currentListField = '';
      if (!fieldName) continue;
      if (rawValue) {
        if (Array.isArray(result[fieldName])) {
          result[fieldName] = [cleanScalar(rawValue)].filter(Boolean);
        } else {
          result[fieldName] = cleanScalar(rawValue);
        }
      } else {
        collectListField(result, fieldName);
        currentListField = fieldName;
      }
      continue;
    }

    const listMatch = line.match(/^\s*-\s+(.*)$/);
    if (listMatch && currentListField) {
      const item = cleanScalar(listMatch[1]);
      if (item) {
        result[currentListField].push(item);
      }
    }
  }

  return result;
}

function parseRequirementsMarkdown(text) {
  const entryRegex = /^###\s+(REQ(?:-FUTURE)?-[A-Z0-9-]+):\s*(.*)$/gm;
  const matches = Array.from(String(text || '').matchAll(entryRegex));
  const entries = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : String(text || '').length;
    const body = String(text || '').slice(start, end).trim();
    return {
      id: match[1],
      title: cleanScalar(match[2]) || match[2].trim(),
      ...parseRequirementsEntryBody(body),
    };
  });

  return {
    entries,
    active: entries.filter((item) => !item.id.startsWith('REQ-FUTURE-') && isActiveRequirementStatus(item.status)),
  };
}

function parseExecutionLogMarkdown(text) {
  const planRegex = /^##\s+Plan\s+(.+)$/gm;
  const matches = Array.from(String(text || '').matchAll(planRegex));
  const items = matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : String(text || '').length;
    const body = String(text || '').slice(start, end);
    const statusMatch = body.match(/^- Status:\s*(.+)$/m);
    return {
      plan: cleanScalar(match[1]) || match[1].trim(),
      status: cleanScalar(statusMatch ? statusMatch[1] : '').toLowerCase(),
    };
  });
  return {
    items,
    statuses: items.map((item) => item.status).filter(Boolean),
  };
}

function findPhaseById(phases, phaseId) {
  const target = normalizePhaseToken(phaseId);
  return phases.find((phase) => normalizePhaseToken(phase.id) === target) || null;
}

function resolveCurrentPhase(roadmap, state, evidence) {
  if (cleanScalar(state.currentPhase)) {
    const phase = findPhaseById(roadmap.phases, state.currentPhase);
    if (phase) {
      return { phase, source: 'state' };
    }
    evidence.push(`state.md 声明的 Current Phase (${state.currentPhase}) 不在 roadmap.md 中。`);
    return { phase: null, source: 'state-missing' };
  }

  if (roadmap.phases.length > 0) {
    evidence.push(`state.md 未声明 Current Phase，回退到 roadmap.md 的首个 phase (${roadmap.phases[0].id})。`);
    return { phase: roadmap.phases[0], source: 'roadmap-first' };
  }

  return { phase: null, source: 'none' };
}

function findPhaseDir(phasesRoot, phaseId) {
  if (!fs.existsSync(phasesRoot)) {
    return {
      exists: false,
      path: path.join(phasesRoot, phaseIdToDirName(phaseId)),
      name: '',
    };
  }

  const target = normalizePhaseToken(phaseId);
  const entries = fs.readdirSync(phasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());
  const found = entries.find((entry) => normalizePhaseToken(entry.name) === target);
  if (found) {
    return {
      exists: true,
      path: path.join(phasesRoot, found.name),
      name: found.name,
    };
  }

  const fallbackName = phaseIdToDirName(phaseId);
  return {
    exists: false,
    path: path.join(phasesRoot, fallbackName),
    name: fallbackName,
  };
}

function listFilesMatching(dirPath, suffix) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }
  return fs.readdirSync(dirPath)
    .filter((name) => name.endsWith(suffix))
    .map((name) => path.join(dirPath, name))
    .sort();
}

function extractExpectedOutputPath(item) {
  const text = cleanScalar(item);
  if (!text) return '';
  const candidate = text.split(/\s+-\s+/)[0].trim();
  if (isPlaceholderValue(candidate)) return '';
  return stripCodeFence(candidate);
}

function resolveOutputPath(cwd, outputPath) {
  if (!outputPath) return '';
  return path.isAbsolute(outputPath) ? outputPath : path.resolve(cwd, outputPath);
}

function collectPhaseArtifacts(cwd, phase) {
  const paceDir = path.join(cwd, '.pace');
  const phasesRoot = path.join(paceDir, 'phases');
  const phaseDirInfo = findPhaseDir(phasesRoot, phase.id);
  const phaseDir = phaseDirInfo.path;
  const contextPath = path.join(phaseDir, 'context.md');
  const executionLogPath = path.join(phaseDir, 'execution-log.md');
  const verificationPath = path.join(phaseDir, 'verification.md');
  const plansDir = path.join(phaseDir, 'plans');
  const runsDir = path.join(phaseDir, 'runs');
  const planFiles = listFilesMatching(plansDir, '.plan.md');
  const runFiles = listFilesMatching(runsDir, '.run.md');
  const contextText = readFileIfExists(contextPath);
  const executionLogText = readFileIfExists(executionLogPath);
  const verificationText = readFileIfExists(verificationPath);
  const expectedOutputs = (phase.expectedOutputs || [])
    .map(extractExpectedOutputPath)
    .filter(Boolean)
    .map((outputPath) => ({
      declared: outputPath,
      resolved: resolveOutputPath(cwd, outputPath),
      exists: fs.existsSync(resolveOutputPath(cwd, outputPath)),
    }));

  return {
    phaseDir,
    phaseDirExists: phaseDirInfo.exists,
    phaseDirName: phaseDirInfo.name,
    contextPath,
    contextExists: fs.existsSync(contextPath),
    context: parseContextMarkdown(contextText),
    executionLogPath,
    executionLogExists: fs.existsSync(executionLogPath),
    executionLog: parseExecutionLogMarkdown(executionLogText),
    verificationPath,
    verificationExists: fs.existsSync(verificationPath),
    verification: parseVerificationMarkdown(verificationText),
    planFiles,
    runFiles,
    expectedOutputs,
  };
}

function allPlansExecuted(artifacts) {
  if (!artifacts.executionLogExists) return false;
  if (artifacts.planFiles.length === 0) return false;
  if (artifacts.runFiles.length === 0) return false;
  return analyzePlanExecutionStatus(artifacts).allExecuted;
}

function detectBrownfield(cwd) {
  const queue = [{ dir: cwd, depth: 0 }];
  while (queue.length > 0) {
    const { dir, depth } = queue.shift();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (TOP_LEVEL_CODE_DIRS.has(entry.name)) {
          return true;
        }
        if (depth < 2) {
          queue.push({ dir: fullPath, depth: depth + 1 });
        }
        continue;
      }

      if (TOP_LEVEL_CODE_FILES.has(entry.name)) {
        return true;
      }
      if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
        return true;
      }
    }
  }
  return false;
}

function findRequirementOwnerIssues(requirements, roadmap) {
  return requirements.active
    .map((item) => {
      const ownerPhase = cleanScalar(item.ownerPhase);
      if (!ownerPhase) {
        return `${item.id} 缺少 Owner Phase。`;
      }
      if (!findPhaseById(roadmap.phases, ownerPhase)) {
        return `${item.id} 的 Owner Phase (${ownerPhase}) 不存在于 roadmap.md。`;
      }
      return '';
    })
    .filter(Boolean);
}

function findMissingPhaseRequirements(phase, requirements) {
  const knownRequirementIds = new Set(requirements.entries.map((item) => item.id));
  return (phase.requirements || []).filter((requirementId) => !knownRequirementIds.has(requirementId));
}

function findInactivePhaseRequirements(phase, requirements) {
  const activeRequirementIds = new Set(requirements.active.map((item) => item.id));
  const requirementStatusById = new Map(
    requirements.entries.map((item) => [item.id, cleanScalar(item.status).toLowerCase() || 'active'])
  );
  return (phase.requirements || [])
    .filter((requirementId) => !activeRequirementIds.has(requirementId))
    .map((requirementId) => ({
      id: requirementId,
      status: requirementStatusById.get(requirementId) || 'missing',
    }));
}

function getFileMtimeMs(filePath) {
  return fs.existsSync(filePath) ? fs.statSync(filePath).mtimeMs : 0;
}

function analyzePlanExecutionStatus(artifacts) {
  const executionLogMtimeMs = getFileMtimeMs(artifacts.executionLogPath);
  const executionStatusByPlan = new Map(
    artifacts.executionLog.items
      .map((item) => [normalizeArtifactKey(item.plan), item.status])
      .filter(([key]) => Boolean(key))
  );
  const runFileByPlan = new Map(
    artifacts.runFiles
      .map((filePath) => [normalizeArtifactKey(path.basename(filePath)), filePath])
      .filter(([key]) => Boolean(key))
  );
  const planKeys = artifacts.planFiles.map((filePath) => ({
    filePath,
    label: path.basename(filePath, '.plan.md'),
    key: normalizeArtifactKey(path.basename(filePath)),
    mtimeMs: getFileMtimeMs(filePath),
  }));

  const missingExecutionLogPlans = [];
  const notDonePlans = [];
  const missingRunPlans = [];
  const staleExecutionLogPlans = [];
  const staleRunPlans = [];

  for (const plan of planKeys) {
    const status = executionStatusByPlan.get(plan.key);
    if (!status) {
      missingExecutionLogPlans.push(plan.label);
      continue;
    }
    if (status !== 'done') {
      notDonePlans.push(`${plan.label}:${status}`);
      continue;
    }
    if (executionLogMtimeMs < plan.mtimeMs) {
      staleExecutionLogPlans.push(plan.label);
      continue;
    }

    const runFilePath = runFileByPlan.get(plan.key);
    if (!runFilePath) {
      missingRunPlans.push(plan.label);
      continue;
    }
    if (getFileMtimeMs(runFilePath) < plan.mtimeMs) {
      staleRunPlans.push(plan.label);
    }
  }

  return {
    missingExecutionLogPlans,
    notDonePlans,
    missingRunPlans,
    staleExecutionLogPlans,
    staleRunPlans,
    allExecuted:
      planKeys.length > 0 &&
      missingExecutionLogPlans.length === 0 &&
      notDonePlans.length === 0 &&
      missingRunPlans.length === 0 &&
      staleExecutionLogPlans.length === 0 &&
      staleRunPlans.length === 0,
  };
}

function nextStageForSkill(skill) {
  switch (skill) {
    case 'pace:bootstrap':
    case 'pace:map-codebase':
      return 'prepare';
    case 'pace:intake':
      return 'issue_intake';
    case 'pace:discuss':
    case 'pace:plan':
    case 'pace:roadmap':
      return 'phase_manage';
    case 'pace:execute':
      return 'delivery';
    case 'pace:verify':
    case 'pace:archive':
    case 'pace:recover':
      return 'closeout';
    case '无':
    default:
      return 'route';
  }
}

function buildDecision(partial, diagnostics = {}) {
  const nextSkill = partial.next_skill || '无';
  const needsUserInput = Boolean(partial.needs_user_input);
  const blockingCode = partial.blocking_code || 'none';
  return {
    current_stage: partial.current_stage || 'route',
    next_stage: partial.next_stage || nextStageForSkill(nextSkill),
    next_skill: nextSkill,
    continue_workflow: Boolean(
      partial.continue_workflow != null
        ? partial.continue_workflow
        : (blockingCode === 'none' && !needsUserInput && nextSkill !== '无')
    ),
    needs_user_input: needsUserInput,
    closed: partial.closed || 'false',
    blocking_code: blockingCode,
    reason: partial.reason || '',
    evidence: Array.isArray(partial.evidence) ? partial.evidence : [],
    updated_artifacts: Array.isArray(partial.updated_artifacts) ? partial.updated_artifacts : [],
    stop_rule_hit: partial.stop_rule_hit || 'none',
    diagnostics,
  };
}

function computeDecision(cwd) {
  const paceDir = path.join(cwd, '.pace');
  const session = loadSession(cwd);
  const diagnostics = {
    pace_dir: paceDir,
    session_path: session.sessionPath,
    brownfield: detectBrownfield(cwd),
    current_phase: '',
    phase_type: '',
    owner_skill: '',
    missing_files: [],
  };
  const evidence = [];

  if (!session.exists) {
    evidence.push('缺少 .pace/session.yaml。');
    return buildDecision({
      current_stage: 'route',
      next_stage: 'route',
      next_skill: '无',
      continue_workflow: false,
      needs_user_input: true,
      blocking_code: 'missing_input',
      reason: '当前工作区尚未初始化 session，必须先运行 pace-init.js local。',
      evidence,
    }, {
      ...diagnostics,
      suggested_command: 'node "$HOME/.codex/skills/pace/bin/pace-init.js" local',
      missing_files: ['.pace/session.yaml'],
    });
  }

  const projectPath = path.join(paceDir, 'project.md');
  const requirementsPath = path.join(paceDir, 'requirements.md');
  const roadmapPath = path.join(paceDir, 'roadmap.md');
  const statePath = path.join(paceDir, 'state.md');
  const codebasePath = path.join(paceDir, 'codebase');

  const requiredFiles = [
    ['.pace/project.md', projectPath],
    ['.pace/requirements.md', requirementsPath],
    ['.pace/roadmap.md', roadmapPath],
    ['.pace/state.md', statePath],
  ];
  const missingCore = requiredFiles.filter(([, filePath]) => !fs.existsSync(filePath)).map(([label]) => label);
  diagnostics.missing_files = [...missingCore];

  if (missingCore.length > 0) {
    evidence.push(`缺少最小工作区真相源: ${missingCore.join(', ')}。`);
    return buildDecision({
      current_stage: 'prepare',
      next_stage: 'prepare',
      next_skill: 'pace:bootstrap',
      reason: '本地工作区还没 bootstrap 完成，必须先补齐最小真相源文件。',
      evidence,
    }, diagnostics);
  }

  if (diagnostics.brownfield && !fs.existsSync(codebasePath)) {
    evidence.push('检测到当前仓库是 brownfield，但 .pace/codebase/ 不存在。');
    return buildDecision({
      current_stage: 'prepare',
      next_stage: 'prepare',
      next_skill: 'pace:map-codebase',
      reason: '当前仓库已有代码，但缺少代码地图，先补齐 codebase 缓存更稳定。',
      evidence,
    }, {
      ...diagnostics,
      missing_files: [...diagnostics.missing_files, '.pace/codebase/'],
    });
  }

  const state = parseStateMarkdown(readFileIfExists(statePath));
  const roadmap = parseRoadmapMarkdown(readFileIfExists(roadmapPath));
  const requirements = parseRequirementsMarkdown(readFileIfExists(requirementsPath));
  const requirementIssues = findRequirementOwnerIssues(requirements, roadmap);

  if (roadmap.phases.length === 0 || (requirements.active.length === 0 && !cleanScalar(state.currentPhase))) {
    if (roadmap.phases.length === 0) {
      evidence.push('roadmap.md 当前没有可执行 phase。');
    }
    if (requirements.active.length === 0) {
      evidence.push('requirements.md 当前没有 active requirements。');
    }
    return buildDecision({
      current_stage: 'issue_intake',
      next_stage: 'issue_intake',
      next_skill: 'pace:intake',
      reason: '当前工作区还没有稳定的 requirement/phase 归属，先进入 intake。',
      evidence,
    }, diagnostics);
  }

  if (requirementIssues.length > 0) {
    evidence.push(...requirementIssues);
    return buildDecision({
      current_stage: 'issue_intake',
      next_stage: 'issue_intake',
      next_skill: 'pace:intake',
      reason: 'requirements 与 roadmap 的归属关系不完整，需要先修正 intake 结果。',
      evidence,
    }, diagnostics);
  }

  const resolvedPhase = resolveCurrentPhase(roadmap, state, evidence);
  if (!resolvedPhase.phase) {
    return buildDecision({
      current_stage: 'route',
      next_stage: 'route',
      next_skill: 'pace:roadmap',
      continue_workflow: false,
      needs_user_input: true,
      blocking_code: 'state_conflict',
      reason: 'Current Phase 与 roadmap 不一致，必须先修正 phase 路由。',
      evidence,
    }, diagnostics);
  }

  const phase = resolvedPhase.phase;
  diagnostics.current_phase = phase.id;
  diagnostics.phase_type = phase.type || '';
  diagnostics.owner_skill = phase.ownerSkill || '';
  evidence.push(`当前 phase 解析为 ${phase.id} (${phase.type || 'unknown'})。`);

  if (!phase.type) {
    evidence.push(`${phase.id} 缺少 Type 字段。`);
    return buildDecision({
      current_stage: 'route',
      next_stage: 'route',
      next_skill: 'pace:roadmap',
      continue_workflow: false,
      needs_user_input: true,
      blocking_code: 'state_conflict',
      reason: 'roadmap 中当前 phase 缺少 Type，workflow 无法稳定路由。',
      evidence,
    }, diagnostics);
  }

  const artifacts = collectPhaseArtifacts(cwd, phase);
  diagnostics.phase_dir = toPosix(path.relative(cwd, artifacts.phaseDir) || '.');
  diagnostics.plan_count = artifacts.planFiles.length;
  diagnostics.run_count = artifacts.runFiles.length;
  diagnostics.verification_status = artifacts.verification.finalStatus || '';

  if (phase.type === 'tech') {
    if (!cleanScalar(phase.ownerSkill)) {
      evidence.push(`${phase.id} 是 tech phase，但未声明 Owner Skill。`);
      return buildDecision({
        current_stage: 'route',
        next_stage: 'route',
        next_skill: '无',
        continue_workflow: false,
        needs_user_input: true,
        blocking_code: 'missing_input',
        reason: 'tech phase 缺少 Owner Skill，不能继续自动路由。',
        evidence,
      }, diagnostics);
    }

    if ((phase.expectedOutputs || []).length === 0) {
      evidence.push(`${phase.id} 是 tech phase，但未声明 Expected Outputs。`);
      return buildDecision({
        current_stage: 'route',
        next_stage: 'route',
        next_skill: 'pace:roadmap',
        continue_workflow: false,
        needs_user_input: true,
        blocking_code: 'state_conflict',
        reason: 'tech phase 缺少 Expected Outputs，先修正 roadmap 再继续。',
        evidence,
      }, diagnostics);
    }

    const missingOutputs = artifacts.expectedOutputs.filter((item) => !item.exists);
    if (missingOutputs.length > 0) {
      evidence.push(`缺少 tech phase Expected Outputs: ${missingOutputs.map((item) => item.declared).join(', ')}。`);
      return buildDecision({
        current_stage: 'route',
        next_stage: 'route',
        next_skill: phase.ownerSkill,
        reason: 'tech phase 产物尚未齐备，先执行 Owner Skill。',
        evidence,
      }, diagnostics);
    }

    if (!artifacts.verificationExists) {
      evidence.push('tech phase 产物已存在，但 verification.md 缺失。');
      return buildDecision({
        current_stage: 'closeout',
        next_stage: 'closeout',
        next_skill: 'pace:verify',
        reason: 'tech phase 已具备预期产物，进入 verify。',
        evidence,
      }, diagnostics);
    }

    if (artifacts.verification.finalStatus === 'pass') {
      evidence.push('verification.md 的 Final Status = pass。');
      return buildDecision({
        current_stage: 'closeout',
        next_stage: 'closeout',
        next_skill: 'pace:archive',
        closed: 'verified-pass',
        reason: 'tech phase 已验证通过，进入 archive。',
        evidence,
      }, diagnostics);
    }

    const recommended = cleanScalar(artifacts.verification.recommendedNextStep) || cleanScalar(phase.ownerSkill) || '无';
    if (['partial', 'fail'].includes(artifacts.verification.finalStatus)) {
      evidence.push(`verification.md 的 Final Status = ${artifacts.verification.finalStatus}。`);
      if (cleanScalar(artifacts.verification.recommendedNextStep)) {
        evidence.push(`verification.md 推荐下一步: ${artifacts.verification.recommendedNextStep}。`);
      }
      return buildDecision({
        current_stage: 'closeout',
        next_stage: nextStageForSkill(recommended),
        next_skill: recommended,
        reason: 'tech phase 验证未通过，按 verification 路由回修复步骤。',
        evidence,
      }, diagnostics);
    }

    evidence.push('verification.md 存在，但 Final Status 不可识别。');
    return buildDecision({
      current_stage: 'route',
      next_stage: 'route',
      next_skill: 'pace:verify',
      continue_workflow: false,
      needs_user_input: true,
      blocking_code: 'state_conflict',
      reason: 'verification.md 的 Final Status 非法，必须先修正状态文件。',
      evidence,
    }, diagnostics);
  }

  if (phase.type !== 'requirement') {
    evidence.push(`${phase.id} 的 Type=${phase.type} 不在支持范围内。`);
    return buildDecision({
      current_stage: 'route',
      next_stage: 'route',
      next_skill: 'pace:roadmap',
      continue_workflow: false,
      needs_user_input: true,
      blocking_code: 'state_conflict',
      reason: '当前 phase 类型不受支持，必须先修正 roadmap。',
      evidence,
    }, diagnostics);
  }

  const missingPhaseRequirements = findMissingPhaseRequirements(phase, requirements);
  if (missingPhaseRequirements.length > 0) {
    evidence.push(`${phase.id} 引用了 requirements.md 中不存在的 requirement: ${missingPhaseRequirements.join(', ')}。`);
    return buildDecision({
      current_stage: 'issue_intake',
      next_stage: 'issue_intake',
      next_skill: 'pace:intake',
      reason: '当前 requirement phase 缺少有效的 requirement 绑定，需要先修正 intake/roadmap。',
      evidence,
    }, diagnostics);
  }

  const executionAnalysis = analyzePlanExecutionStatus(artifacts);
  const inactivePhaseRequirements = findInactivePhaseRequirements(phase, requirements);
  const canKeepDoneRequirementsInCloseout = inactivePhaseRequirements.every((item) => item.status === 'done')
    && (executionAnalysis.allExecuted || artifacts.verificationExists);
  if (inactivePhaseRequirements.length > 0 && !canKeepDoneRequirementsInCloseout) {
    evidence.push(
      `${phase.id} 绑定了非 active requirement: ${inactivePhaseRequirements.map((item) => `${item.id}:${item.status}`).join(', ')}。`
    );
    return buildDecision({
      current_stage: 'issue_intake',
      next_stage: 'issue_intake',
      next_skill: 'pace:intake',
      reason: '当前 requirement phase 绑定的 requirement 已失效，需要先修正 intake/roadmap。',
      evidence,
    }, diagnostics);
  }

  if (!artifacts.contextExists || !artifacts.context.complete) {
    if (!artifacts.contextExists) {
      evidence.push('当前 requirement phase 缺少 context.md。');
    } else {
      evidence.push(`context.md 缺少必要章节: ${artifacts.context.missingSections.join(', ')}。`);
    }
    return buildDecision({
      current_stage: 'phase_manage',
      next_stage: 'phase_manage',
      next_skill: 'pace:discuss',
      reason: 'requirement phase 的上下文还不完整，先回到 discuss 锁定边界。',
      evidence,
    }, diagnostics);
  }

  if (artifacts.planFiles.length === 0) {
    evidence.push('当前 requirement phase 还没有 plans/*.plan.md。');
    return buildDecision({
      current_stage: 'phase_manage',
      next_stage: 'phase_manage',
      next_skill: 'pace:plan',
      reason: 'context 已齐备，但还没有可执行计划，进入 plan。',
      evidence,
    }, diagnostics);
  }

  if (!executionAnalysis.allExecuted) {
    if (!artifacts.executionLogExists) {
      evidence.push('execution-log.md 缺失。');
    } else if (executionAnalysis.missingExecutionLogPlans.length > 0) {
      evidence.push(`execution-log.md 缺少这些 plan 的状态: ${executionAnalysis.missingExecutionLogPlans.join(', ')}。`);
    } else if (executionAnalysis.notDonePlans.length > 0) {
      evidence.push(`execution-log.md 仍有未完成状态: ${executionAnalysis.notDonePlans.join(', ')}。`);
    } else if (executionAnalysis.staleExecutionLogPlans.length > 0) {
      evidence.push(`execution-log.md 早于这些 plan 的最新版本: ${executionAnalysis.staleExecutionLogPlans.join(', ')}。`);
    }
    if (artifacts.runFiles.length === 0) {
      evidence.push('runs/ 目录中没有 run summaries。');
    } else if (executionAnalysis.missingRunPlans.length > 0) {
      evidence.push(`runs/ 目录缺少这些 plan 对应的 run summaries: ${executionAnalysis.missingRunPlans.join(', ')}。`);
    } else if (executionAnalysis.staleRunPlans.length > 0) {
      evidence.push(`runs/ 目录中这些 run summaries 早于 plan 最新版本: ${executionAnalysis.staleRunPlans.join(', ')}。`);
    }
    return buildDecision({
      current_stage: 'delivery',
      next_stage: 'delivery',
      next_skill: 'pace:execute',
      reason: '计划已生成，但执行产物还没闭环，继续 execute。',
      evidence,
    }, diagnostics);
  }

  if (!artifacts.verificationExists) {
    evidence.push('execution 已完成，但 verification.md 缺失。');
    return buildDecision({
      current_stage: 'closeout',
      next_stage: 'closeout',
      next_skill: 'pace:verify',
      reason: '执行已完成，进入 verify。',
      evidence,
    }, diagnostics);
  }

  if (artifacts.verification.finalStatus === 'pass') {
    evidence.push('verification.md 的 Final Status = pass。');
    return buildDecision({
      current_stage: 'closeout',
      next_stage: 'closeout',
      next_skill: 'pace:archive',
      closed: 'verified-pass',
      reason: 'requirement phase 已验证通过，进入 archive。',
      evidence,
    }, diagnostics);
  }

  if (artifacts.verification.finalStatus === 'partial' || artifacts.verification.finalStatus === 'fail') {
    const fallbackSkill = artifacts.verification.finalStatus === 'partial' ? 'pace:plan' : 'pace:execute';
    const nextSkill = cleanScalar(artifacts.verification.recommendedNextStep) || fallbackSkill;
    evidence.push(`verification.md 的 Final Status = ${artifacts.verification.finalStatus}。`);
    if (cleanScalar(artifacts.verification.recommendedNextStep)) {
      evidence.push(`verification.md 推荐下一步: ${artifacts.verification.recommendedNextStep}。`);
    }
    return buildDecision({
      current_stage: 'closeout',
      next_stage: nextStageForSkill(nextSkill),
      next_skill: nextSkill,
      reason: 'requirement phase 验证未通过，按 verification 路由回补齐步骤。',
      evidence,
    }, diagnostics);
  }

  evidence.push('verification.md 存在，但 Final Status 不可识别。');
  return buildDecision({
    current_stage: 'route',
    next_stage: 'route',
    next_skill: 'pace:verify',
    continue_workflow: false,
    needs_user_input: true,
    blocking_code: 'state_conflict',
    reason: 'verification.md 的 Final Status 非法，必须先修正状态文件。',
    evidence,
  }, diagnostics);
}

function collectFingerprintPaths(cwd, decision) {
  const candidates = [
    path.join(cwd, '.pace', 'session.yaml'),
    path.join(cwd, '.pace', 'project.md'),
    path.join(cwd, '.pace', 'requirements.md'),
    path.join(cwd, '.pace', 'roadmap.md'),
    path.join(cwd, '.pace', 'state.md'),
  ];
  const phaseDir = decision?.diagnostics?.phase_dir
    ? path.resolve(cwd, decision.diagnostics.phase_dir)
    : '';
  if (phaseDir && fs.existsSync(phaseDir)) {
    const queue = [phaseDir];
    while (queue.length > 0) {
      const current = queue.shift();
      const stat = fs.statSync(current);
      if (stat.isDirectory()) {
        candidates.push(current);
        for (const entry of fs.readdirSync(current)) {
          queue.push(path.join(current, entry));
        }
      } else {
        candidates.push(current);
      }
    }
  }
  return Array.from(new Set(candidates.filter((filePath) => fs.existsSync(filePath)))).sort();
}

function signatureFromDecision(decision) {
  return JSON.stringify({
    current_stage: decision.current_stage,
    next_stage: decision.next_stage,
    next_skill: decision.next_skill,
    blocking_code: decision.blocking_code,
    closed: decision.closed,
  });
}

function applyRuntimeGuard(cwd, decision, options = {}) {
  if (options.record === false) {
    return decision;
  }

  const runtimeDir = path.join(cwd, '.pace', 'runtime');
  const runtimePath = path.join(runtimeDir, 'workflow-state.json');
  const fingerprint = crypto.createHash('sha1');
  for (const filePath of collectFingerprintPaths(cwd, decision)) {
    const stat = fs.statSync(filePath);
    fingerprint.update(`${toPosix(path.relative(cwd, filePath))}:${stat.size}:${Math.round(stat.mtimeMs)}\n`);
  }
  const workspaceFingerprint = fingerprint.digest('hex');
  const signature = signatureFromDecision(decision);
  let previous = null;

  if (fs.existsSync(runtimePath)) {
    try {
      previous = JSON.parse(fs.readFileSync(runtimePath, 'utf8'));
    } catch {
      previous = null;
    }
  }

  const sameDecision = previous
    && previous.workspace_fingerprint === workspaceFingerprint
    && previous.signature === signature;
  const repeatCount = sameDecision ? Number(previous.repeat_count || 0) + 1 : 1;
  const finalDecision = {
    ...decision,
    diagnostics: {
      ...decision.diagnostics,
      runtime_path: toPosix(path.relative(cwd, runtimePath)),
      workspace_fingerprint: workspaceFingerprint,
      repeat_count: repeatCount,
    },
  };

  if (
    repeatCount >= 2 &&
    finalDecision.continue_workflow &&
    !finalDecision.needs_user_input &&
    finalDecision.blocking_code === 'none'
  ) {
    finalDecision.continue_workflow = false;
    finalDecision.needs_user_input = true;
    finalDecision.stop_rule_hit = 'repeat_stage_without_new_artifacts';
    finalDecision.reason = `${finalDecision.reason} 同一路由在未检测到新产物时重复出现，自动续跑已停止。`.trim();
    finalDecision.evidence = [
      ...finalDecision.evidence,
      'workflow runtime 检测到相同 fingerprint 下重复出现同一路由。',
    ];
  }

  fs.mkdirSync(runtimeDir, { recursive: true });
  fs.writeFileSync(runtimePath, JSON.stringify({
    schema_version: 1,
    updated_at: new Date().toISOString(),
    workspace_fingerprint: workspaceFingerprint,
    signature,
    repeat_count: repeatCount,
  }, null, 2), 'utf8');

  finalDecision.updated_artifacts = Array.from(new Set([
    ...finalDecision.updated_artifacts,
    toPosix(path.relative(cwd, runtimePath)),
  ]));

  return finalDecision;
}

function renderDecisionText(decision) {
  const lines = [
    `current_stage: ${decision.current_stage}`,
    `next_stage: ${decision.next_stage}`,
    `next_skill: ${decision.next_skill}`,
    `continue_workflow: ${decision.continue_workflow}`,
    `needs_user_input: ${decision.needs_user_input}`,
    `closed: ${decision.closed}`,
    `blocking_code: ${decision.blocking_code}`,
    `reason: ${decision.reason}`,
    `stop_rule_hit: ${decision.stop_rule_hit}`,
    'evidence:',
    ...(decision.evidence.length ? decision.evidence.map((item) => `- ${item}`) : ['- 无']),
    'updated_artifacts:',
    ...(decision.updated_artifacts.length ? decision.updated_artifacts.map((item) => `- ${item}`) : ['- 无']),
  ];
  return `${lines.join('\n')}\n`;
}

module.exports = {
  allPlansExecuted,
  applyRuntimeGuard,
  collectPhaseArtifacts,
  computeDecision,
  detectBrownfield,
  parseContextMarkdown,
  parseExecutionLogMarkdown,
  parseRequirementsMarkdown,
  parseRoadmapMarkdown,
  parseStateMarkdown,
  parseVerificationMarkdown,
  renderDecisionText,
};
