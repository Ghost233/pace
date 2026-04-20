---
name: pace:intake
description: 接收新需求或新 phase 描述，分析后归入 requirements 和 roadmap，并路由到下一步。当用户有新需求、新功能点、新 phase 要加入项目时触发。不负责讨论和规划。
---

# PACE Intake

统一的需求/phase 入口。接收用户输入，分析后写入 requirements.md 和 roadmap.md，然后路由到合适的下一步。

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 前置检查

- 若 `.pace/` 不存在：
  - `multica + roles` 场景：提示先交由 `PACE-初始化经理`
  - `local / skills-only` 场景：提示先运行 `pace:bootstrap`
- 若 `.pace/codebase/` 不存在且仓库已有代码：
  - `multica + roles` 场景：记录初始化缺口，并回交 `PACE-初始化经理`
  - `local / skills-only` 场景：`Recommended Next Skill` 可写为 `pace:map-codebase`

## 默认约定

- 读取 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- 不做讨论，不做规划，不做执行
- 只做“归档 + 路由”
- `pace:intake` 不允许新增、插入、拆分、删除或重排 phase；任何 phase 结构变更都必须路由到 `pace:roadmap`
- requirement 记录必须至少包含 `Goal`、`Success Criteria`、`Non-Goals`、`External Dependencies`、`Owner Phase`

## 最小流程

1. 接收用户的需求描述
2. 读取已有 requirements 和 roadmap
3. 分析该需求的状态：
   - 已被现有 requirement 完全覆盖 → 提示已存在，无需新增
   - 部分覆盖且不改变原 requirement 的目标与验收口径 → 补充到已有 requirement
   - 部分覆盖且引入新的目标、验收口径或依赖 → 新建 requirement
   - 完全新 → 创建新 requirement
4. 更新 `requirements.md`
   - 每条 requirement 必须写全 `Goal`、`Success Criteria`、`Non-Goals`、`External Dependencies`、`Owner Phase`
5. 判断 phase 归属：
   - 已有 phase 明确覆盖 → 将 requirement 挂到该 phase 下
   - 需要新增 phase、插入子 phase、拆分 phase 或调整 phase 顺序 → 记录 phase 结构变更请求，并将下一步路由到 `pace:roadmap`
   - 当需求同时包含两个及以上独立验收目标，或需要跨两个及以上子系统协作时，必须拆分为多个 phase；当前只记录最近一项验收目标所需的 phase 结构变更请求
6. 更新 `roadmap.md`
7. 更新 `state.md`（Current Phase、Recommended Next Skill）
8. 输出摘要并推荐下一步

## 必需产物

- 更新后的 `.pace/requirements.md`
- 更新后的 `.pace/roadmap.md`
- 更新后的 `.pace/state.md`

## 输出摘要至少包含

- 新增或变更的 requirement ID
- 归属的 phase
- 是否需要新建 phase
- 推荐的下一步 skill

## 判断规则

- 不要机械重复新增已有 phase 覆盖的内容
- 不要把过大的需求硬塞进一个 phase
- 子 phase 编号遵循父 phase 编号（如 phase 2 的子 phase 为 2.1、2.2）
- phase 名称必须清晰表达核心目标
- 复用已有 requirement ID，避免重复创建
- intake 只处理 requirement 归类，不拥有 phase 结构编辑权

## 边界

- 不做 phase 内部的讨论和规划
- 不自动进入 `pace:discuss` 或 `pace:plan`
- 不写代码
- 不替用户决定关键灰区

## 后续路由

- requirement 已归档到已有 phase：`pace:discuss`
- 需要 phase 结构变更：`pace:roadmap`
- 需求已被完全覆盖：提示无需操作
- 需要技术前置 phase（如代码映射）：
  - `multica + roles` 场景：回交 `PACE-初始化经理`
  - `local / skills-only` 场景：`pace:map-codebase`
