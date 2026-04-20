---
name: pace:plan
description: 基于 context、requirements、roadmap 和代码证据生成可执行的 phase 计划，通过子代理 checker 回路确认 plans 可以安全进入 execute。当某个 phase 需要被拆成可执行 plans 时触发。
---

# PACE Plan

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。启动 checker 子代理时使用对应的 model 参数。

## 默认约定

- 读取 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- 如果存在，读取 `.pace/phases/<phase>/context.md`
- 如果存在，读取 `.pace/phases/<phase>/coverage.md`
- 如果存在，读取 `.pace/codebase/`
- `multica + github` 下，以上本地文件只在工作区已从 GitHub 主 issue、主 issue 的受控索引 comment、文档 root issue、初始化参数子 issue、各文档子 issue 恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，必须先停止并要求恢复/同步，不能直接继续 plan
- plans 写入 `.pace/phases/<phase>/plans/`
- 保留 planner + checker 的两层结构

## 必需产物

- `.pace/phases/<phase>/plans/` 下的一份或多份计划文件
- checker 的修订结果，直接回写到 plans 或单独写一个简短 review note
- `multica + github` 下，上述稳定正文只有在同步到对应文档子 issue 的 body，并由主 issue 受控索引 comment 与文档 root issue 收录后，才算跨轮次持久化完成
- `multica + github` 下，还必须产出对应的文档同步动作：plan 文档子 issue body 更新、审计 comment、文档 root issue 索引更新、主 issue 受控索引 comment 回填

使用：

- `templates/PLAN.template.md`
- `templates/plan-check.template.md`
- `references/phases-layout.md`

## 最小流程

1. 判断当前 phase 是否已有足够 context；仅当 `context.md` 同时包含 `Goal`、`Phase Boundary`、结构化 `Locked Decisions`、`References` 四项时，才允许继续；若任一项缺失，停止并路由 `pace:discuss`
2. 生成初版 plans
3. 读取 coverage.md，为每个交付物分配到对应 plan，填充 Plan 列
4. 使用子代理执行 checker 核查（保持主代理上下文干净）：
   - 将 plans、context 和 coverage.md 发给 checker 子代理
   - checker 按 plan-check 模板逐项核查：goal coverage、requirement coverage、context compliance、task completeness、dependency/wave sanity、verification quality、split signal
   - checker 额外核查 coverage.md 全局覆盖：每一行都必须有 Plan 赋值，否则 verdict = revise
   - checker 返回 verdict：pass | revise | split
5. 若 verdict = revise，根据 Required Revisions 同时修订 plans 和 coverage.md，然后重新提交 checker
6. 若 verdict = split，停止当前 plan 编写并路由 `pace:roadmap`
7. 若 verdict = pass，且当前是 `multica + github`，必须立即执行文档层同步：
   - 先执行 `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue <main-issue>`
   - 再分别执行 `upsert-doc` 同步 `coverage`、每份 `plan-file`、必要时的 checker review note 到对应文档子 issue body
   - 每次 `upsert-doc` 如有修订摘要，配套写审计 comment
   - 只有当文档 root issue 与主 issue 受控索引 comment 已回填最新索引后，才算 plan 完成
8. 若 verdict = pass，结束并路由 `pace:execute`

## 通过条件

- 至少有一份可执行 plan
- 当前 phase requirements 已覆盖
- `Locked Decisions` 没有被遗漏或篡改
- 每个 plan 都必须包含 `Objective`、`Scope Boundaries`、`Requirements Covered`、`Inputs`、`Files`、`Tasks`、`Verification`
- 每个 task 都必须包含 `Files`、`Action`、`Verify`、`Done`
- checker 必须通过

## 边界

- 不做 execution
- 不在主文档重复模板结构
- 不允许悄悄缩减用户已经锁定的决策
- phase 太大时必须 split，而不是把压力塞进一个 plan

## 后续路由

plan 完成后，下一步是 `pace:execute`。
