---
name: pace:archive
description: 归档已完成的 phase，将 phase 级产物移动到 `.pace/archive/`，更新索引与 state。当某个 phase 已完成、需要把活跃工作区收口但保留历史上下文时触发。
---

# PACE Archive

## 配置读取

执行任何操作前，先读取 `.pace-config.yaml`。如果文件不存在，提示用户先运行 `pace:config` 初始化配置，然后使用默认值继续。如果文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 只做 phase 级归档
- 归档位置为 `.pace/archive/`
- 保留活跃项目级文件

## 必需产物

- `.pace/archive/` 下的 phase 归档目录
- 更新后的 `index.md`
- 更新后的 `.pace/state.md`

## 最小归档集合

- `.pace/phases/<phase>/context.md`
- `.pace/phases/<phase>/discussion-log.md`
- `.pace/phases/<phase>/plans/`
- `.pace/phases/<phase>/runs/`
- `.pace/phases/<phase>/verification.md`

## 索引字段

`index.md` 至少记录：

- archive id
- source path
- date
- included artifacts

## 边界

- milestone 级归档暂不处理
- 不要静默删除历史
- 不要把 archive 变成第二个 bootstrap

## 后续路由

phase 归档后，如需继续推进后续 phase，可转到 discuss 或 plan。
