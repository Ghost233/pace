---
name: pace:status
description: 读取轻量 workflow 的状态与实际产物，输出当前所处位置、缺失关键产物、冲突信息和下一步默认 skill。当用户想知道当前 workflow 到哪里、缺什么、下一步该做什么时触发。
---

# PACE Status

## 配置读取

执行任何操作前，先读取 `.pace-config.yaml`。如果文件不存在，提示用户先运行 `pace:config` 初始化配置；本次执行仅使用以下固定默认值继续：`tracker.type=local`、`agents.max_concurrent=1`、`agents.model_profile=balanced`、`agents.model_overrides={}`。如果文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 先读取 `.pace/state.md`
- 再与 `.pace/phases/<phase>/` 的实际产物交叉验证
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

## 边界

- 不要变成第二个控制面
- 不要偷偷推进 execution
- 不要做大范围状态改写

## 后续路由

这是统一导航入口，但不是统一编排器。下一步 skill 必须按缺失产物决定：缺 `context.md` 路由 `pace:discuss`，缺 `plans/` 路由 `pace:plan`，有 `plans/` 但缺 `runs/` 路由 `pace:execute`，缺 `verification.md` 路由 `pace:verify`，phase 已验证通过则路由 `pace:archive`。
