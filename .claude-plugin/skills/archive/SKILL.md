---
name: pace:archive
description: 归档已完成的 phase，将 phase 级产物移动到 `.pace/archive/`，更新索引与 state。当某个 phase 已完成、需要把活跃工作区收口但保留历史上下文时触发。
---

# PACE Archive

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`；如果不存在，再回退读取 `.pace-config.yaml` 兼容旧工作区。如果两个文件都不存在，提示用户先运行 `pace-init local`、`pace-init multica` 或 `pace:config` 初始化配置；本次执行仅使用以下固定默认值继续：`tracker.type=local`、`agents.max_concurrent=1`、`agents.model_profile=balanced`、`agents.model_overrides={}`。如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 只做 phase 级归档
- 归档位置为 `.pace/archive/`
- 保留活跃项目级文件
- 先读取 `.pace/roadmap.md`，确认当前 phase 的 `Type`

## 必需产物

- `.pace/archive/` 下的 phase 归档目录
- 更新后的 `.pace/archive/index.md`
- 更新后的 `.pace/state.md`

## 最小归档集合

- `requirement` phase 必须归档：
  - `.pace/phases/<phase>/context.md`
  - `.pace/phases/<phase>/discussion-log.md`
  - `.pace/phases/<phase>/plans/`
  - `.pace/phases/<phase>/runs/`
  - `.pace/phases/<phase>/verification.md`
- `tech` phase 必须归档：
  - roadmap 中 `Expected Outputs` 列出的产物
  - `.pace/phases/<phase>/verification.md`

## 索引字段

`.pace/archive/index.md` 至少记录：

- archive id
- source path
- date
- included artifacts

## 边界

- milestone 级归档暂不处理
- 不要静默删除历史
- 不要把 archive 变成第二个 bootstrap
- `verification.md` 的 `Final Status` 不等于 `pass` 时禁止归档

## 后续路由

phase 归档后，下一步路由必须按“下一个 phase 的类型 + 实际产物”决定：

- 下一个 phase `Type = tech`：路由到它的 `Owner Skill`
- 下一个 phase `Type = requirement` 且缺 `context.md`：路由 `pace:discuss`
- 下一个 phase `Type = requirement` 且有 `context.md` 但缺 `plans/`：路由 `pace:plan`
