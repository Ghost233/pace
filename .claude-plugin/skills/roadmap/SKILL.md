---
name: pace:roadmap
description: 维护轻量 workflow 的 phase 结构，负责新增、插入、删除和调整 phases，作为唯一的 roadmap/state 结构维护入口。当用户要改 phase 结构（而非初始化新项目）时触发。
---

# PACE Roadmap

## 配置读取

执行任何操作前，先读取 `.pace-config.yaml`。如果文件不存在，提示用户先运行 `pace:config` 初始化配置，然后使用默认值继续。如果文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- `.pace/roadmap.md` 是 roadmap 真相源
- `.pace/state.md` 只做状态同步，不单独定义另一套 schema
- add / insert / remove / reorder phase 都由这个 skill 负责
- 每个 phase 必须标注 Type：
  - `tech`：技术前置 phase（如代码映射），由特定 skill 直接完成，跳过 discuss → plan → execute 流程
  - `requirement`：需求 phase，走完整 discuss → plan → execute → verify 流程

## 必需产物

- 更新后的 `.pace/roadmap.md`
- 更新后的 `.pace/state.md`

优先使用：

- `templates/roadmap.template.md`
- `templates/state.template.md`

## 负责的动作

- 新增 phase
- 插入 phase，例如 `2.1`
- 删除未来 phase
- 调整 phase 标题或 goal
- 调整 phase 顺序或依赖

## 最小规则

- 只编辑未来结构，不静默删除已有执行历史
- 若 phase 已有 `context / plans / runs / verification`，先明确如何处理
- roadmap 变更后同步更新 state 的当前 phase、下一步建议和 blockers

## 边界

- 不要在这里生成 `context.md` 或 `plan`
- 不要让 `bootstrap` 再维护另一套 roadmap/state 模板

## 后续路由

- 新增了 type: requirement 的 phase：`pace:discuss`
- 新增了 type: tech 的 phase：路由到对应的执行 skill（如 map-codebase）
- phase 结构改动影响当前上下文时：`pace:status`
