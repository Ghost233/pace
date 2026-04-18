---
name: pace:bootstrap
description: 初始化轻量 workflow 的最小真相源，识别 greenfield 或 brownfield；若是 brownfield 且缺少代码地图，则先路由到代码库映射，再创建 project、requirements、roadmap seed 和 state。当用户想在当前仓库启动一套新的轻量 workflow（而非维护已有 phase 结构）时触发。
---

# PACE Bootstrap

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`；如果不存在，再回退读取 `.pace-config.yaml` 兼容旧工作区。如果两个文件都不存在，提示用户先运行 `pace-init local`、`pace-init multica` 或 `pace:config` 初始化配置；本次执行仅使用以下固定默认值继续：`tracker.type=local`、`agents.max_concurrent=1`、`agents.model_profile=balanced`、`agents.model_overrides={}`。如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 所有工作流产物写入 `.pace/`
- 除非用户明确要求迁移，否则不要修改现有 `.planning/`
- brownfield 且 `.pace/codebase/` 不存在时，`Recommended Next Skill` 必须写为 `pace:map-codebase`
- bootstrap 只做初始化，不做后续 roadmap 维护

## 必需产物

- `.pace/project.md`
- `.pace/requirements.md`
- `.pace/roadmap.md`
- `.pace/state.md`

使用：

- `templates/project.template.md`
- `templates/requirements.template.md`
- `../pace:roadmap/templates/roadmap.template.md`
- `../pace:roadmap/templates/state.template.md`

## 最小流程

1. 判断当前仓库是 greenfield 还是 brownfield
2. 若是 brownfield 且无代码地图，`Recommended Next Skill` 必须写为 `pace:map-codebase`
3. 获取项目简述
4. 写 `project.md`
5. 写 `requirements.md`
6. 写最小 `roadmap seed`
7. 写 `state.md`

## 输出要求

`project.md` 最少要有：

- What This Is
- Who It Is For
- Core Value
- Constraints
- Non-Goals

`requirements.md` 最少要有：

- 稳定的 requirement ID
- Goal
- Success Criteria
- Non-Goals
- External Dependencies
- Owner Phase

`roadmap.md` 在 bootstrap 阶段至少必须包含：

- Phase ID
- Title
- Type（tech 或 requirement）
- Owner Skill（`tech` phase 必填，`requirement` phase 填 `n/a`）
- Expected Outputs（`tech` phase 必填，列出文件或目录路径；`requirement` phase 填 `n/a`）
- Goal
- Requirements
- Non-Goals
- Success Criteria
- Entry Criteria
- Done Criteria
- Depends On
- Status

至少存在 1 个 phase，且每个 phase 必须完整填写以上字段，否则 bootstrap 不算完成。

Type 规则：
- 代码映射、环境搭建等技术前置 phase 标记为 `tech`
- 产品需求 phase 标记为 `requirement`
- `tech` phase 的 `Recommended Next Skill` 必须等于 `Owner Skill`
- `requirement` phase 的 `Owner Skill` 固定写 `n/a`
- `tech` phase 的 `Expected Outputs` 必须列出可检查的文件或目录路径，不能写抽象描述

`state.md` 最少要有：

- Current Milestone
- Current Phase
- Current Step
- Recommended Next Skill
- Known Blockers

## 边界

- 不要在 bootstrap 阶段做完整 phase 拆分优化
- 不要在这里执行 add / insert / remove / reorder phase
- 后续 roadmap 结构维护统一交给 `pace:roadmap`

## 后续路由

- brownfield 且缺代码地图：`pace:map-codebase`
- 首个 phase 为 `tech`：路由到该 phase 的 `Owner Skill`
- 首个 `requirement` phase：默认路由 `pace:discuss`
  原因：bootstrap 不生成 `context.md`，因此 requirement phase 不能直接进入 `pace:plan`
