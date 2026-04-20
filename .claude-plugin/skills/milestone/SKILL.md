---
name: pace:milestone
description: 管理轻量 workflow 的 milestone 生命周期，包括创建、关闭和归档。当用户需要创建新 milestone、关闭当前 milestone 或归档已完成 milestone 时触发。
---

# PACE Milestone

管理 milestone 级别的生命周期操作。phase 级结构维护由 `pace:roadmap` 负责。

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 读取 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- milestone 变更后同步更新 roadmap.md 和 state.md
- `multica + github` 下，以上本地文件只在工作区已从 GitHub 主 issue、主 issue 的受控索引 comment、文档 root issue、初始化参数子 issue、各文档子 issue 恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，必须先停止并要求恢复/同步
- `multica + github` 下，roadmap/state 仍是工作区副本；milestone 结构变更要继续通过主 issue comment、文档 root issue 与文档子 issue 协议对外持久化，不能把本地副本当成第二真相源

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
- `multica + github` 下，若 milestone 结构变更需要跨轮次持久化，还必须同步对应文档子 issue body，并回填文档 root issue 与主 issue 受控索引 comment

## GitHub 文档层同步（仅 `multica + github`）

- 先执行 `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue <main-issue>`
- 再执行 `upsert-doc` 同步 `roadmap-entry:<milestone-id>` 或其他对应里程碑文档
- 如有变更摘要，配套写审计 comment
- 只有当文档 root issue 与主 issue 受控索引 comment 已回填最新索引后，才算 milestone 变更完成

## 边界

- 不做 phase 级操作（由 roadmap 负责）
- 不静默关闭包含未完成 phase 的 milestone
- 不删除历史 milestone 记录

## 后续路由

- milestone 创建后：`pace:roadmap`（规划 phase 结构）
- milestone 关闭后：创建新 milestone 或结束项目
