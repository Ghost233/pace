---
name: pace:workflow
description: 作为 PACE 的本地单入口编排 skill 使用。读取 `.pace/session.yaml`、`.pace/state.md`、`.pace/roadmap.md`、`.pace/requirements.md` 和当前 phase 产物，判断当前子阶段（route、prepare、issue_intake、phase_manage、delivery、closeout），再只调用该子阶段允许的本地执行 skills，最后输出 `current_stage`、`next_stage`、`next_skill`、`continue_workflow`、`needs_user_input`、`closed` 和 `blocking_code`。当用户想在本地用一个 skill 取代多角色 handoff，并保持 workflow 边界时触发。
---

# PACE Workflow

## 用途

这是 PACE 当前推荐的唯一编排入口。

但当前推荐由脚本负责稳定路由，而不是让 prompt 重复手写判定逻辑。
每轮先调用：

- `node "$HOME/.codex/skills/pace/bin/pace-workflow.js" route --json`

把脚本返回结果当成当前轮的路由真相源，再决定是否执行下一 skill。

当前主定义是：

- `local-only`
- `skills/workflow` 驱动
- 本地 `.pace/` 作为工作区状态与执行缓存

## 每轮先读什么

每轮开始固定执行：

1. 先确保 `.pace/session.yaml` 已由 `pace-init.js local` 生成
2. 执行 `pace-workflow.js route --json`
3. 以脚本输出为准读取 `.pace/state.md`
4. 只在需要补充证据时，再读取 `.pace/roadmap.md`、`.pace/requirements.md` 和当前 phase 产物

真相源优先级：

- 当前轮 config / context：`.pace/session.yaml`
- 当前轮路由判定：`pace-workflow.js route --json`
- 当前 workflow 状态：`.pace/state.md`
- phase 结构：`.pace/roadmap.md`
- requirement 归档：`.pace/requirements.md`
- 当前 phase 产物：`.pace/phases/<phase>/...`

## 代码托管边界

- PACE 不把 issue、phase 或 requirement 当成 git 分支真相源
- 如果当前运行环境已经 checkout 仓库并自动创建/切换分支，以实际 checkout 分支为准；不要从编号或 slug 推导“默认分支名”
- PACE 不把 merge 当成默认完成动作
- 如果仓库流程要求 PR / review，默认目标是把变更推进到当前平台要求的 review-ready 状态；PR / 分支可以作为附加交付证据，但不替代平台侧 review handoff
- merge 属于外部托管流程，除非用户明确要求，否则不要写进默认闭环

## 子阶段

保留 6 个逻辑子阶段，但不再要求外部角色：

1. `route`
   - 只做当前阶段判断与下一步路由
2. `prepare`
   - 只做首次初始化或本地缓存恢复
   - 允许：`pace:bootstrap`、`pace:map-codebase`
3. `issue_intake`
   - 只做需求首次接收、归类、挂接到 requirement / roadmap
   - 允许：`pace:intake`
4. `phase_manage`
   - 只做 `pace:discuss`、`pace:plan`、必要时 `pace:roadmap`
5. `delivery`
   - 只做 `pace:execute`
6. `closeout`
   - 只做 `pace:verify`、`pace:archive`、必要时 `pace:recover`

## 每轮固定流程

1. 先执行 `session re-init`
   - 只重建 `.pace/session.yaml`
2. 判断当前 `current_stage`
3. 只执行该 `current_stage` 允许的 skill
4. 写清 `next_stage`
5. 结束当前轮

如果满足以下全部条件，允许自动续跑下一轮 `pace:workflow`：

- `continue_workflow = true`
- `needs_user_input = false`
- `closed = false`
- `blocking_code = none`

## 子阶段判定顺序

以下规则主要约束 `pace-workflow.js` 的实现；`pace:workflow` 不应复制一份独立判定逻辑。

按以下顺序匹配第一条命中的规则：

1. `prepare`
   - 缺 `.pace/project.md`
   - 或缺 `.pace/requirements.md`
   - 或缺 `.pace/roadmap.md`
   - 或缺 `.pace/state.md`
   - 或 brownfield 且缺 `.pace/codebase/`
2. `issue_intake`
   - requirement 尚未归档到 `requirements.md`
   - 或 roadmap / requirement 归属不明确
3. `phase_manage`
   - 缺 `context.md`
   - 或缺 checker 通过的 `plans/`
4. `delivery`
   - 已有可执行 plans
   - 但 execution 尚未完成
5. `closeout`
   - execution 已完成
   - 需要 verify / archive
6. `route`
   - 以上都无法唯一判断
   - 或本地状态之间存在冲突

## 冲突分类

至少分成：

- `missing_session`
- `missing_local_state`
- `state_conflict`
- `external_dependency`
- `plan_drift`
- `missing_input`

## 每轮输出

每轮结束必须显式输出：

- `current_stage`
- `next_stage`
- `next_skill`
- `continue_workflow`
- `needs_user_input`
- `closed`
- `blocking_code`
- `reason`
- `evidence`
- `updated_artifacts`

建议固定字段：

- `current_stage: <route|prepare|issue_intake|phase_manage|delivery|closeout>`
- `next_stage: <... | 无>`
- `next_skill: <pace:workflow|pace:bootstrap|pace:map-codebase|pace:intake|pace:discuss|pace:plan|pace:roadmap|pace:execute|pace:verify|pace:archive|pace:recover|无>`
- `continue_workflow: <true|false>`
- `needs_user_input: <true|false>`
- `closed: <false|archived|verified-pass|abandoned>`
- `blocking_code: <none|missing_input|external_dependency|state_conflict|plan_drift|missing_local_state>`
- `reason: <一句话结论>`
- `evidence: <关键证据>`
- `updated_artifacts: <本轮更新产物>`

## 自动化停止闸门

不要无限循环。

出现以下任一情况，必须停止自动续跑并输出明确阻塞：

- 同一个 `current_stage -> next_stage` 连续重复 2 次且没有新产物
- `.pace/state.md`、`.pace/roadmap.md`、当前 phase 产物都没有变化
- 需要用户决策
- 权限或外部依赖问题

`pace-workflow.js` 默认会把重复路由记录到：

- `.pace/runtime/workflow-state.json`

role / skill 不要自己再发明第二套重复检测缓存。

## 路由边界

- `current_stage = prepare`
  - 只允许 `pace:bootstrap` / `pace:map-codebase`
- `current_stage = issue_intake`
  - 不做 discuss / plan / execute
- `current_stage = phase_manage`
  - 不写代码
- `current_stage = delivery`
  - 不改 requirement 边界
- `current_stage = closeout`
  - 不把 partial / fail 包装成完成
  - 不把“已开 PR / 待 review”偷换成“已 merge”

## 技术 phase

`tech` phase 不进入 requirement 编排闭环。

如果 roadmap 显示当前 phase `Type = tech`：

- 输出 `needs_user_input: true` 或明确改走 `Owner Skill`
- 不进入 `issue_intake / phase_manage / delivery`
- `Owner Skill` 产物齐备后进入 `closeout`，继续走 `pace:verify / pace:archive`
