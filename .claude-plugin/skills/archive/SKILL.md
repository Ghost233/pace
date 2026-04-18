---
name: pace:archive
description: 归档已完成的 phase，将 phase 级产物移动到 `.pace/archive/`，更新索引与 state。当某个 phase 已完成、需要把活跃工作区收口但保留历史上下文时触发。
---

# PACE Archive

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local` 或 `pace:config`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

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
