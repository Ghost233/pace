---
name: pace:roadmap
description: 维护轻量 workflow 的 phase 结构，负责新增、插入、删除和调整 phases，作为唯一的 roadmap/state 结构维护入口。当用户要改 phase 结构（而非初始化新项目）时触发。
---

# PACE Roadmap

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local` 或 `pace:config`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- `.pace/session.yaml` 提供本轮输入
- `multica + github` 下，GitHub 文档层是跨轮次持久真相源
- 主 issue comment 负责阶段状态与 handoff
- 文档 issue body 负责最新版正文
- `.pace/roadmap.md` 是当前工作区中的 phase 结构副本；若与外部真相源冲突，先恢复/同步，再编辑
- `.pace/state.md` 只做状态同步，不单独定义另一套 schema
- bootstrap 只允许创建最小初始 roadmap seed；此后任何新增、插入、拆分、重排、删除 phase 都只能由这个 skill 负责
- 每个 phase 必须标注 Type：
  - `tech`：技术前置 phase（如代码映射），必须额外声明 `Owner Skill`，流程固定为 `owner_skill → verify → archive`
  - `requirement`：需求 phase，流程固定为 `discuss → plan → execute → verify → archive`

## 必需产物

- 更新后的 `.pace/roadmap.md`
- 更新后的 `.pace/state.md`

使用：

- `templates/roadmap.template.md`
- `templates/state.template.md`

## 负责的动作

- 新增 phase
- 插入 phase，例如 `2.1`
- 拆分已有 phase
- 删除未来 phase
- 调整 phase 标题或 goal
- 调整 phase 顺序或依赖

## 最小规则

- 只编辑未来结构，不静默删除已有执行历史
- 若 phase 已有 `context / plans / runs / verification`，先明确如何处理
- roadmap 变更后同步更新 state 的当前 phase、下一步默认 skill 和 blockers
- `pace:intake` 只允许提出 phase 结构变更请求，不允许直接执行结构变更
- 新增 `tech` phase 时必须同时写明 `Owner Skill`、`Expected Outputs`、`Entry Criteria`、`Done Criteria`
- 新增 `requirement` phase 时必须同时写明 `Non-Goals`、`Success Criteria`

## 边界

- 不要在这里生成 `context.md` 或 `plan`
- 不要让 `bootstrap` 再维护另一套 roadmap/state 模板

## 后续路由

- 新增了 type: requirement 的 phase：`pace:discuss`
- 新增了 type: tech 的 phase：必须在 roadmap 中写出 `Owner Skill`，并路由到该 skill（如 `pace:map-codebase`）
- phase 结构改动影响当前上下文时：`pace:status`
