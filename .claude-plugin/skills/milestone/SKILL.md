---
name: pace:milestone
description: 管理轻量 workflow 的 milestone 生命周期，包括创建、关闭和归档。当用户需要创建新 milestone、关闭当前 milestone 或归档已完成 milestone 时触发。
---

# PACE Milestone

管理 milestone 级别的生命周期操作。phase 级结构维护由 `pace:roadmap` 负责。

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`；如果不存在，再回退读取 `.pace-config.yaml` 兼容旧工作区。如果两个文件都不存在，提示用户先运行 `pace-init local`、`pace-init multica` 或 `pace:config` 初始化配置；本次执行仅使用以下固定默认值继续：`tracker.type=local`、`agents.max_concurrent=1`、`agents.model_profile=balanced`、`agents.model_overrides={}`。如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 读取 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- milestone 变更后同步更新 roadmap.md 和 state.md

## 负责的动作

### 创建 Milestone

- 在 roadmap.md 中新增 milestone section
- 将相关 phases 归入该 milestone
- 同步 state.md 的 Current Milestone

### 关闭 Milestone

- 确认该 milestone 下所有 phase 已归档或显式跳过
- 更新 roadmap.md 中 milestone 状态
- 同步 state.md

### 归档 Milestone

- 在每个 `.pace/archive/<archive-id>/meta.md` 写入 `milestone: <milestone-id>` 和 `milestone_status: archived`
- 更新 `.pace/archive/index.md`
- 保留 roadmap.md 中的历史记录，标注已归档

## 必需产物

- 更新后的 `.pace/roadmap.md`
- 更新后的 `.pace/state.md`

## 边界

- 不做 phase 级操作（由 roadmap 负责）
- 不静默关闭包含未完成 phase 的 milestone
- 不删除历史 milestone 记录

## 后续路由

- milestone 创建后：`pace:roadmap`（规划 phase 结构）
- milestone 关闭后：创建新 milestone 或结束项目
