---
name: pace:recover
description: 受控恢复当前 phase 状态，支持重开已归档 phase、撤销验证结论并回退到下游 skill、或显式放弃当前 phase。当用户需要 reopen archived phase、clear verify result 或 abandon current phase 时触发。
---

# PACE Recover

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 读取 `.pace/roadmap.md`
- 读取 `.pace/state.md`
- 若存在，读取 `.pace/phases/<phase>/verification.md`
- 若存在，读取 `.pace/archive/index.md`
- 若存在，读取对应 archive 目录中的 meta / 归档产物清单
- `multica + github` 下，以上本地文件只在工作区已从 GitHub 主 issue、主 issue的受控索引 comment、文档 root issue、初始化参数文档 issue、对应 phase 文档 issue 恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，必须先停止并要求恢复/同步

使用：

- `templates/recovery-note.template.md`

## 支持的动作

`pace:recover` 第一版只支持三类受控恢复：

1. `reopen-archived-phase`
2. `clear-verify-result`
3. `abandon-phase`

不支持：

- `git reset`
- 自动回滚代码
- 删除历史 archive 证据
- 跳过 roadmap/state 直接口头宣布“重开成功”

## 动作 1：重开已归档 phase

适用场景：

- 当前 phase 已归档，但需要重新进入 `execute` / `plan` / `discuss`
- archive 是 requirement phase 的历史快照，不应被删除，但当前工作区要重新进入活跃状态

执行要求：

1. 确认目标 phase 在 roadmap 中仍存在
2. 从 `.pace/archive/` 中定位该 phase 对应的 archive 条目
3. 如果活跃 phase 目录缺失，按 archive 中的产物重新水合到 `.pace/phases/<phase>/`
4. 保留 archive 快照本身，不删除、不覆盖
5. 在活跃 phase 目录写一份 `recovery.md`，说明：
   - action = `reopen-archived-phase`
   - reason
   - source archive id / source path
   - requested next skill
6. 更新 `.pace/state.md`：
   - `Current Phase` = 目标 phase
   - `Current Step` = 与 requested next skill 一致
   - `Recommended Next Skill` = `pace:execute | pace:plan | pace:discuss | pace:status`

## 动作 2：撤销验证结论并回退

适用场景：

- `verification.md` 已存在，但当前结论需要重新进入 `execute` / `plan` / `discuss`
- 需要保留旧验证证据，但不能继续按旧结论推进

执行要求：

1. 保留现有 `verification.md`，不删除历史证据
2. 在当前 phase 目录写一份 `recovery.md`，说明：
   - action = `clear-verify-result`
   - previous verification status
   - reason
   - requested next skill
3. 更新 `.pace/state.md`：
   - `Current Phase` 保持为当前 phase
   - `Current Step` = 与 requested next skill 一致
   - `Recommended Next Skill` = `pace:execute | pace:plan | pace:discuss`

路由建议：

- 实现未完成或只需继续修复：`pace:execute`
- 计划失真但 phase 边界仍成立：`pace:plan`
- 边界、约束或拒绝项变化：`pace:discuss`

## 动作 3：显式放弃当前 phase

适用场景：

- 当前 phase 不再继续
- 用户决定取消这项工作
- 外部前提无法满足，且本轮不再重开

执行要求：

1. 保留现有 phase / archive / verification 历史证据
2. 写一份 `recovery.md` 或等效说明文件，记录：
   - action = `abandon-phase`
   - reason
   - 是否允许后续重开
   - recommended next skill
3. 更新 `.pace/state.md`：
   - 如果 roadmap 中已有明确下一 phase，则将 `Current Phase` 切到下一 phase，并设置对应 `Recommended Next Skill`
   - 如果当前没有安全下一步，则将 `Recommended Next Skill` 设为 `pace:status`

## 必需产物

- 更新后的 `.pace/state.md`
- 一份恢复说明：
  - `.pace/phases/<phase>/recovery.md`
  - 或 `.pace/archive/<archive-id>/recovery.md`

## multica + github 同步（仅 `multica + github`）

- 先执行 `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue <main-issue>`
- requirement phase 默认继续使用当前 phase 的 `doc-key = phase-<NN>`
- 将恢复说明同步到当前 phase 文档 issue 的 `archive-status` 或 `verification` section
- 如恢复动作影响下一步 skill、关闭状态或重新打开执行，还必须补一条主 issue comment 和审计 comment
- 若需要回写 multica 平台 comment / status / handoff，只允许使用 `node "$HOME/.codex/skills/pace/bin/pace-multica.js" ...`，不得直接 fallback 到原生 `multica issue ...`

## 边界

- `pace:recover` 是状态恢复入口，不是代码恢复入口
- 不自动改写 roadmap 中的 phase 结构；如果需要删 phase / 插 phase / 重排 phase，转到 `pace:roadmap`
- 不自动进入代码执行；恢复完成后仍要明确下一步 skill

## 后续路由

- 重开已归档 phase：`pace:execute | pace:plan | pace:discuss | pace:status`
- 撤销验证结论：`pace:execute | pace:plan | pace:discuss`
- 放弃 phase：`pace:status` 或 `pace:roadmap`
