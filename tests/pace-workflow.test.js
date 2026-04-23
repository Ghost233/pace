const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { applyRuntimeGuard, computeDecision, parseRequirementsMarkdown } = require('../bin/lib/workflow');

function makeTempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pace-workflow-test-'));
}

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

function writeSession(root) {
  writeFile(root, '.pace/session.yaml', [
    'config:',
    '  executor: claude-code',
    '  tracker:',
    '    type: local',
    'context:',
    '  role:',
    '    current: PACE-流程经理',
  ].join('\n'));
}

function writeCoreFiles(root, options = {}) {
  writeSession(root);
  writeFile(root, '.pace/project.md', '# Project\n');
  writeFile(root, '.pace/requirements.md', options.requirements || [
    '# Requirements',
    '',
    '## Active Requirements',
    '',
    '### REQ-001: 支持当前 phase',
    '- Goal: 完成当前需求',
    '- Success Criteria:',
    '  - 交付功能正常',
    '- Non-Goals:',
    '  - none',
    '- External Dependencies:',
    '  - none',
    '- Owner Phase: Phase 01',
    '- Status: active',
  ].join('\n'));
  writeFile(root, '.pace/roadmap.md', options.roadmap || [
    '# Roadmap',
    '',
    '## Current Milestone',
    '- MVP',
    '',
    '## Phases',
    '',
    '### Phase 01: 当前 phase',
    `- Type: ${options.phaseType || 'requirement'}`,
    `- Owner Skill: ${options.ownerSkill || 'pace:map-codebase'}`,
    ...(options.phaseType === 'tech'
      ? [
        '- Expected Outputs:',
        '  - `src/map.json`',
      ]
      : [
        '- Expected Outputs:',
        '  - n/a',
      ]),
    '- Goal: 完成当前 phase',
    '- Requirements:',
    '  - REQ-001',
    '- Non-Goals:',
    '  - none',
    '- Success Criteria:',
    '  - 交付完成',
    '- Entry Criteria:',
    '  - none',
    '- Done Criteria:',
    '  - 全部完成',
    '- Depends On:',
    '  - none',
    '- Status: planned',
  ].join('\n'));
  writeFile(root, '.pace/state.md', options.state || [
    '# State',
    '',
    '## Current Milestone',
    '- MVP',
    '',
    '## Current Phase',
    '- Phase 01',
    '',
    '## Current Step',
    '- discuss',
    '',
    '## Recommended Next Skill',
    '- pace:discuss',
    '',
    '## Known Blockers',
    '- none',
  ].join('\n'));
}

function writeRequirementPhase(root, overrides = {}) {
  const phaseDir = path.join(root, '.pace/phases/phase-01');
  fs.mkdirSync(phaseDir, { recursive: true });
  if (overrides.context !== false) {
    writeFile(root, '.pace/phases/phase-01/context.md', overrides.context || [
      '# Phase Phase 01: Context',
      '',
      '## Goal',
      '',
      '完成 phase 目标。',
      '',
      '## Phase Boundary',
      '',
      '### In Scope',
      '- 当前范围',
      '',
      '### Out of Scope',
      '- none',
      '',
      '## Locked Decisions',
      '',
      '### D-01',
      '- Decision: 使用当前方案',
      '- Scope: 当前 phase',
      '- Rejected Options:',
      '  - 旧方案 - 成本更高',
      '- Rationale: 简化实现',
      '',
      '## References',
      '',
      '- `src/app.ts` - 当前入口',
    ].join('\n'));
  }
  if (overrides.plans !== false) {
    writeFile(root, '.pace/phases/phase-01/plans/01-main.plan.md', overrides.plans || '# Plan Phase 01-01: Main\n');
  }
  if (overrides.executionLog) {
    writeFile(root, '.pace/phases/phase-01/execution-log.md', overrides.executionLog);
  }
  if (overrides.run) {
    writeFile(root, '.pace/phases/phase-01/runs/01-main.run.md', overrides.run);
  }
  if (overrides.verification) {
    writeFile(root, '.pace/phases/phase-01/verification.md', overrides.verification);
  }
}

test('workflow routes to bootstrap when core local state is missing', () => {
  const repo = makeTempRepo();
  writeSession(repo);

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'prepare');
  assert.equal(decision.next_skill, 'pace:bootstrap');
  assert.match(decision.reason, /bootstrap/);
});

test('workflow routes brownfield repo to map-codebase before continuing', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeFile(repo, 'src/index.ts', 'export const ok = true;\n');

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'prepare');
  assert.equal(decision.next_skill, 'pace:map-codebase');
});

test('workflow routes requirement phase without context to discuss', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, { context: false });

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'phase_manage');
  assert.equal(decision.next_skill, 'pace:discuss');
});

test('workflow routes requirement phase with plans but incomplete execution to execute', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, {
    executionLog: [
      '# Phase Phase 01 Execution Log',
      '',
      '## Plan 01-main',
      '- Status: executing',
    ].join('\n'),
  });

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'delivery');
  assert.equal(decision.next_skill, 'pace:execute');
});

test('workflow does not treat stale execution artifacts as completed plans', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, {
    executionLog: [
      '# Phase Phase 01 Execution Log',
      '',
      '## Plan old-a',
      '- Status: done',
      '',
      '## Plan old-b',
      '- Status: done',
    ].join('\n'),
    run: '# Run old-a\n',
  });
  writeFile(repo, '.pace/phases/phase-01/plans/02-extra.plan.md', '# Plan Phase 01-02: Extra\n');

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'delivery');
  assert.equal(decision.next_skill, 'pace:execute');
  assert.match(decision.evidence.join('\n'), /缺少这些 plan 的状态|缺少这些 plan 对应的 run summaries/);
});

test('workflow does not treat same-key stale execution artifacts as current completion', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, {
    executionLog: [
      '# Phase Phase 01 Execution Log',
      '',
      '## Plan 01-main',
      '- Status: done',
    ].join('\n'),
    run: '# Run 01-main\n',
  });

  const planPath = path.join(repo, '.pace/phases/phase-01/plans/01-main.plan.md');
  const future = new Date(Date.now() + 5_000);
  fs.utimesSync(planPath, future, future);

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'delivery');
  assert.equal(decision.next_skill, 'pace:execute');
  assert.match(decision.evidence.join('\n'), /早于这些 plan 的最新版本/);
});

test('workflow routes requirement phase with completed execution to verify', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, {
    executionLog: [
      '# Phase Phase 01 Execution Log',
      '',
      '## Plan 01-main',
      '- Status: done',
    ].join('\n'),
    run: '# Run 01-main\n',
  });

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'closeout');
  assert.equal(decision.next_skill, 'pace:verify');
});

test('workflow routes verification partial back to recommended skill', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, {
    executionLog: [
      '# Phase Phase 01 Execution Log',
      '',
      '## Plan 01-main',
      '- Status: done',
    ].join('\n'),
    run: '# Run 01-main\n',
    verification: [
      '# Verification Phase 01',
      '',
      '## Final Status',
      '- partial',
      '',
      '## Blocking Gaps',
      '- 1',
      '',
      '## Recommended Next Step',
      '- pace:plan',
    ].join('\n'),
  });

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'closeout');
  assert.equal(decision.next_stage, 'phase_manage');
  assert.equal(decision.next_skill, 'pace:plan');
});

test('workflow routes tech phase with missing outputs to owner skill', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo, {
    phaseType: 'tech',
    ownerSkill: 'pace:map-codebase',
  });

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'route');
  assert.equal(decision.next_skill, 'pace:map-codebase');
});

test('workflow routes requirement phase with missing roadmap requirements back to intake', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo, {
    roadmap: [
      '# Roadmap',
      '',
      '## Current Milestone',
      '- MVP',
      '',
      '## Phases',
      '',
      '### Phase 01: 当前 phase',
      '- Type: requirement',
      '- Owner Skill: pace:map-codebase',
      '- Expected Outputs:',
      '  - n/a',
      '- Goal: 完成当前 phase',
      '- Requirements:',
      '  - REQ-999',
      '- Non-Goals:',
      '  - none',
      '- Success Criteria:',
      '  - 交付完成',
      '- Entry Criteria:',
      '  - none',
      '- Done Criteria:',
      '  - 全部完成',
      '- Depends On:',
      '  - none',
      '- Status: planned',
    ].join('\n'),
  });
  writeRequirementPhase(repo);

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'issue_intake');
  assert.equal(decision.next_skill, 'pace:intake');
  assert.match(decision.evidence.join('\n'), /REQ-999/);
});

test('workflow routes inactive requirement bindings back to intake before phase execution', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo, {
    requirements: [
      '# Requirements',
      '',
      '## Active Requirements',
      '',
      '### REQ-001: Current requirement',
      '- Goal: 完成当前需求',
      '- Success Criteria:',
      '  - 交付功能正常',
      '- Non-Goals:',
      '  - none',
      '- External Dependencies:',
      '  - none',
      '- Owner Phase: Phase 01',
      '- Status: done',
    ].join('\n'),
  });
  writeRequirementPhase(repo);

  const decision = computeDecision(repo);
  assert.equal(decision.current_stage, 'issue_intake');
  assert.equal(decision.next_skill, 'pace:intake');
  assert.match(decision.evidence.join('\n'), /REQ-001:done/);
});

test('workflow diagnostics use canonical phase directory fallback', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);

  const decision = computeDecision(repo);
  assert.equal(decision.diagnostics.phase_dir, '.pace/phases/phase-01');
});

test('parseRequirementsMarkdown excludes done and deferred requirements from active set', () => {
  const parsed = parseRequirementsMarkdown([
    '# Requirements',
    '',
    '## Active Requirements',
    '',
    '### REQ-001: Active requirement',
    '- Goal: goal',
    '- Owner Phase: Phase 01',
    '- Status: active',
    '',
    '### REQ-002: Proposed requirement',
    '- Goal: goal',
    '- Owner Phase: Phase 01',
    '- Status: proposed',
    '',
    '### REQ-003: Done requirement',
    '- Goal: goal',
    '- Owner Phase: Phase 01',
    '- Status: done',
    '',
    '### REQ-004: Deferred requirement',
    '- Goal: goal',
    '- Owner Phase: Phase 01',
    '- Status: deferred',
    '',
    '## Deferred / Future Requirements',
    '',
    '### REQ-FUTURE-001: Future requirement',
    '- Goal: future',
    '- Deferred Reason: later',
  ].join('\n'));

  assert.deepEqual(parsed.active.map((item) => item.id), ['REQ-001', 'REQ-002']);
});

test('workflow runtime guard stops repeated auto-continue without new artifacts', () => {
  const repo = makeTempRepo();
  writeCoreFiles(repo);
  writeRequirementPhase(repo, {
    executionLog: [
      '# Phase Phase 01 Execution Log',
      '',
      '## Plan 01-main',
      '- Status: done',
    ].join('\n'),
    run: '# Run 01-main\n',
  });

  const first = applyRuntimeGuard(repo, computeDecision(repo));
  assert.equal(first.continue_workflow, true);
  const second = applyRuntimeGuard(repo, computeDecision(repo));
  assert.equal(second.continue_workflow, false);
  assert.equal(second.needs_user_input, true);
  assert.equal(second.stop_rule_hit, 'repeat_stage_without_new_artifacts');
});
