---
name: pace:status
description: 读取轻量 workflow 的状态与实际产物，输出当前所处位置、缺失关键产物、冲突信息和下一步默认 skill。当用户想知道当前 workflow 到哪里、缺什么、下一步该做什么时触发。
---

# PACE Status

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 先读取 `.pace/state.md`
- 再读取 `.pace/roadmap.md`，确认当前 phase 的 `Type` 与 `Owner Skill`
- 再与 `.pace/phases/<phase>/` 的实际产物交叉验证
- 如果当前 phase `Type = tech`，必须额外读取该 phase 的 `Expected Outputs`
- `multica + github` 下，以上本地文件只在工作区已从外部真相源恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，只能报告“需要先同步/恢复”，不能继续给出确定性路由
- `multica + github` 下：
  - 主 issue comment 用于判断阶段状态、handoff、closeout
  - 主 issue 的受控索引 comment 用于判断文档 root issue 与子文档索引是否一致
  - 文档 root issue 用于判断文档索引是否完整
  - 初始化参数子 issue 用于判断当前角色复用的初始化参数是否最新
  - 文档 issue body 用于判断正文是否最新
- 默认只读；仅当 `state.md` 缺少可从磁盘直接推导的字段，且不涉及 phase/plan 状态变更时，允许修正 `Recommended Next Skill` 与缺失的路径引用；其余冲突只报告，不写盘

## 输出最少要回答

1. 现在在哪个 phase / step
2. 缺哪些关键产物
3. state 与磁盘事实是否冲突
4. 下一步默认 skill 是什么

## 最小检查面

- `context.md`
- `plans/`
- `runs/`
- `verification.md`
- 当前 phase 的 `Type`
- 当前 phase 的 `Owner Skill`
- 当前 phase 的 `Expected Outputs`

## 边界

- 不要变成第二个控制面
- 不要偷偷推进 execution
- 不要做大范围状态改写

## 后续路由

这是统一导航入口，但不是统一编排器。下一步 skill 必须按 phase 类型和缺失产物决定：

- 当前 phase `Type = tech` 且任一 `Expected Outputs` 不存在：路由到 `Owner Skill`
- 当前 phase `Type = tech` 且 `Expected Outputs` 全部存在、但缺 `verification.md`：路由 `pace:verify`
- 当前 phase `Type = tech` 且 `verification.md` 的 `Final Status = pass`：路由 `pace:archive`
- 当前 phase `Type = requirement` 且缺 `context.md`：路由 `pace:discuss`
- 当前 phase `Type = requirement` 且有 `context.md` 但缺 `plans/`：路由 `pace:plan`
- 当前 phase `Type = requirement` 且有 `plans/` 但缺 `runs/` 或 `execution-log.md`：路由 `pace:execute`
- 任意 phase 缺 `verification.md`：路由 `pace:verify`
- 任意 phase `verification.md` 的 `Final Status = pass`：路由 `pace:archive`
- 任意 phase `verification.md` 的 `Final Status = partial|fail`：路由 `verification.md` 里的 `Recommended Next Step`
