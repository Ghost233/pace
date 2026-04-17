---
name: pace:intake
description: 接收新需求或新 phase 描述，分析后归入 requirements 和 roadmap，并路由到下一步。当用户有新需求、新功能点、新 phase 要加入项目时触发。不负责讨论和规划。
---

# PACE Intake

统一的需求/phase 入口。接收用户输入，分析后写入 requirements.md 和 roadmap.md，然后路由到合适的下一步。

## 配置读取

执行任何操作前，先读取 `.pace-config.yaml`。如果文件不存在，提示用户先运行 `pace:config` 初始化配置，然后使用默认值继续。如果文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 前置检查

- 若 `.pace/` 不存在，提示先运行 `pace:bootstrap`
- 若 `.pace/codebase/` 不存在且仓库已有代码，建议先运行 `pace:map-codebase`

## 默认约定

- 读取 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- 不做讨论，不做规划，不做执行
- 只做"归档 + 路由"

## 最小流程

1. 接收用户的需求描述
2. 读取已有 requirements 和 roadmap
3. 分析该需求的状态：
   - 已被现有 requirement 完全覆盖 → 提示已存在，无需新增
   - 部分覆盖 → 补充到已有 requirement 或新建 requirement
   - 完全新 → 创建新 requirement
4. 更新 `requirements.md`
5. 判断 phase 归属：
   - 已有 phase 明确覆盖 → 将 requirement 挂到该 phase 下
   - 需要新建 phase → 在 roadmap 中新增 phase
   - 需求属于某个现有 phase 的子任务但范围较大 → 在该 phase 下插入子 phase（如 2.1）
   - 需求过大需拆分 → 只拆出当前最应推进的 phase，其余列为后续建议
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
- 优先复用已有 requirement ID，避免重复创建
- intake 创建的 phase 类型默认为 `requirement`

## 边界

- 不做 phase 内部的讨论和规划
- 不自动进入 `pace:discuss` 或 `pace:plan`
- 不写代码
- 不替用户决定关键灰区

## 后续路由

- 新 phase 已创建（type: requirement）：`pace:discuss`
- 已有 phase 被更新：`pace:discuss`
- 需求已被完全覆盖：提示无需操作
- 需要技术前置 phase（如代码映射）：`pace:map-codebase`
