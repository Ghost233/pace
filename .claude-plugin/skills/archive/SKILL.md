---
name: pace:archive
description: 归档已完成的 phase，将 phase 级产物移动到 `.pace/archive/`，更新索引与 state。当某个 phase 已完成、需要把活跃工作区收口但保留历史上下文时触发。
---

# PACE Archive

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 只做 phase 级归档
- 归档位置为 `.pace/archive/`
- 保留活跃项目级文件
- 先读取 `.pace/roadmap.md`，确认当前 phase 的 `Type`
- `multica + github` 下，以上本地文件只在工作区已从 GitHub 主 issue、主 issue 的受控索引 comment、文档 root issue、初始化参数子 issue、各文档子 issue 恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，必须先停止并要求恢复/同步，不能直接继续 archive

## 必需产物

- `.pace/archive/` 下的 phase 归档目录
- 更新后的 `.pace/archive/index.md`
- 更新后的 `.pace/state.md`
- `multica + github` 下，上述稳定正文只有在同步到对应文档子 issue 的 body，并由主 issue 受控索引 comment 与文档 root issue 收录后，才算跨轮次持久化完成
- `multica + github` 下，还必须产出对应的文档同步动作：archive 文档子 issue body 更新、审计 comment、文档 root issue 索引更新、主 issue 受控索引 comment 回填

## 最小归档集合

- `requirement` phase 必须归档：
  - `.pace/phases/<phase>/context.md`
  - `.pace/phases/<phase>/discussion-log.md`
  - `.pace/phases/<phase>/plans/`
  - `.pace/phases/<phase>/runs/`
  - `.pace/phases/<phase>/verification.md`
- `tech` phase 必须归档：
  - `.pace/phases/<phase>/verification.md`
  - 一份 `Expected Outputs` 结果清单或引用记录，列出真实交付路径、存在性检查结果与对应证据

## 索引字段

`.pace/archive/index.md` 至少记录：

- archive id
- source path
- date
- included artifacts

## GitHub 文档层同步（仅 `multica + github`）

- 先执行 `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue <main-issue>`
- 再执行 `upsert-doc` 同步 `archive-entry` 到对应文档子 issue body
- 如有归档摘要、重新打开原因或 live outputs 校验说明，配套写审计 comment
- 只有当文档 root issue 与主 issue 受控索引 comment 已回填最新索引后，才算 archive 完成

## 边界

- milestone 级归档暂不处理
- 不要静默删除历史
- 不要把 archive 变成第二个 bootstrap
- `verification.md` 的 `Final Status` 不等于 `pass` 时禁止归档
- `tech` phase 的归档不能移动或覆盖工作树中的 live outputs；archive 只记录它们的路径、校验结果与验证证据

## 后续路由

phase 归档后，下一步路由必须按“下一个 phase 的类型 + 实际产物”决定：

- 下一个 phase `Type = tech`：路由到它的 `Owner Skill`
- 下一个 phase `Type = requirement` 且缺 `context.md`：路由 `pace:discuss`
- 下一个 phase `Type = requirement` 且有 `context.md` 但缺 `plans/`：路由 `pace:plan`
