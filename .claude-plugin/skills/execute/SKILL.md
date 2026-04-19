---
name: pace:execute
description: 通过子代理执行轻量 workflow 中的 phase plans，主代理负责调度和审查，不直接修改代码。当 plans 已经存在、用户希望落代码时触发。
---

# PACE Execute

主代理不直接修改代码。主代理负责：读取 plan、分配子代理、审查结果、更新 coverage。子代理负责：读取 plan、写代码、跑验证。

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local` 或 `pace:config`

如果配置文件存在，提取以下配置并应用于后续流程：
- `agents.max_concurrent`：直接控制每个 wave 的子代理并行数上限
- `agents.model_profile`：子代理模型选择档位，分配子代理时使用对应的 model 参数
- `agents.model_overrides`：特定 agent 类型的模型覆盖

## 默认约定

- 从 `.pace/phases/<phase>/plans/` 读取计划文件
- 如果存在，读取 `.pace/phases/<phase>/coverage.md`
- 更新 `.pace/state.md`
- 将 run summaries 写入 `.pace/phases/<phase>/runs/`
- `multica + github` 下，以上本地文件只在工作区已从 GitHub 主 issue / 文档 issue 恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，必须先停止并要求恢复/同步，不能直接继续 execute
- 默认按 wave 并行执行，以下情况串行：
  - 两个 plan 修改同一文件
  - 两个 plan 有显式 Depends On 关系
  - 两个 plan 都修改共享状态文件（如 config、schema）
- wave 分组前，扫描所有 plan 的 Files 项检测路径重叠

## 主代理职责

- 读取和索引所有 plan
- 按 wave 分组并调度子代理
- **每次分配任务前**，将分配记录写入执行日志
- **每次子代理完成后**，立即将结果写入 coverage.md 和 run summary
- 审查子代理产出（验证命令 + coverage 对账）
- 不通过则要求子代理重做
- 执行 coverage gate

## 子代理职责

- 接收单个 plan，读取对应文件
- 按计划修改代码
- 跑验证（测试、typecheck、build）
- 返回执行结果摘要（不返回代码正文）

## 必需产物

- 仓库中的实际代码变更（由子代理完成）
- `.pace/phases/<phase>/execution-log.md`（主代理维护的执行日志）
- 每个已执行 plan 对应一份 run summary
- 更新后的 coverage.md
- 更新后的 state.md

## 执行流程

### 1. 初始化

- 解析目标 phase
- 若 `multica + github` 且当前工作区未确认已恢复，立即停止并要求先恢复/同步
- 索引该 phase 下所有 plan 文件
- 分离 complete 与 incomplete plans
- 读取 coverage.md
- 创建 `execution-log.md`，记录当前待执行 plan 列表

### 2. Wave 调度

- 将剩余 plans 按 wave 分组
- plans 独立时并行，有依赖或冲突时串行

### 3. 分配子代理

每个子代理必须收到：

- plan 文件内容
- coverage.md 中该 plan 负责的交付物 ID
- 相关 context（locked decisions、依赖 plan 的产出摘要）
- 验证要求

**分配前必须更新 execution-log.md**：

```markdown
## Plan 01-auth
- Status: executing
- 子代理分配时间: <时间>
- 负责的 coverage 项: D-01, D-02
```

### 4. 子代理完成后立即更新

**每个子代理完成后，主代理必须立刻做三件事**（不要攒到一起批量更新）：

1. **写 run summary**：记录执行结果
2. **更新 coverage.md**：填充 Run 列，更新 Status 为 `done` 或 `failed`
3. **更新 execution-log.md**：记录完成状态和结果摘要

```markdown
## Plan 01-auth
- Status: done
- 子代理分配时间: <时间>
- 完成时间: <时间>
- 负责的 coverage 项: D-01(done), D-02(done)
- 验证: pnpm test --filter auth - pass
```

### 5. 审查

主代理审查不逐行看代码，聚焦在：

- coverage.md 对应项是否已标记 `done`
- 验证命令是否通过
- plan 的 Files 列表是否都已创建/修改
- run summary 中是否有未解决的 deviations

审查不通过 → 重新分配子代理修复，execution-log.md 记录 `retry`。

### 6. Coverage Gate

所有 plan 执行完毕后：

- 读取 coverage.md
- 检查是否有 Status != `done` 的行
- 如有缺失项，禁止声明完成，必须报告缺失项及原因
- 全部 `done` 后才可更新 state.md

## Execution Log 标准

`execution-log.md` 是主代理的外部记忆。即使上下文被压缩，主代理通过读取此文件恢复完整执行状态。

文件结构：

```markdown
# Phase <phase> Execution Log

## 概览
- 总 plan 数: N
- 已完成: X
- 执行中: Y
- 待执行: Z
- 当前 wave: W

## Plan <plan-id>
- Status: pending | executing | done | failed | retry
- 负责的 coverage 项: D-01, D-02
- 子代理分配时间: <时间>
- 完成时间: <时间>
- 验证结果: <命令> - <pass|fail>
- 重试次数: N
- 备注: <deviations 或 follow-ups>
```

**每次状态变更必须立刻写入，不要延迟。**

## 持续推进机制

主代理不写代码，上下文消耗很低，因此可以在单次 session 中执行大量 plan。以下规则确保持续推进：

### 上下文恢复

当主代理完成一个 wave 的所有子代理后，如果要继续下一个 wave：

1. 将当前执行进度写入 execution-log.md（已经做了）
2. 将 coverage.md 写入磁盘（已经做了）
3. 读取 execution-log.md 概览段恢复全局状态
4. 继续下一个 wave

主代理不需要记住每个子代理的代码细节，只需要记住：
- 哪些 plan 已完成
- 哪些 plan 失败需要重试
- coverage.md 中哪些项已 done

### 跨 wave 持续执行

- 不在 wave 之间暂停等待用户确认（除非用户明确要求）
- 每个 wave 完成后直接进入下一个 wave
- 只在 coverage gate 处暂停汇报结果

### 单 phase 边界

execute 只负责执行当前 `requirement` phase 的 plans。`tech` phase 不进入 `execute`，必须改走 roadmap 中声明的 `Owner Skill -> verify -> archive`。因此 requirement phase 才必须经过 `discuss -> plan -> execute` 的完整流程。

### 执行汇报

当前 phase 所有 plan 通过 coverage gate 后，输出简要汇报：

- 本 phase 完成 plan 数 / 总 plan 数
- 失败重试次数
- coverage 完成率
- 推荐下一步：`pace:verify`

## Run Summary 标准

每份 run summary 应记录：

- plan id
- objective
- files changed
- tests 或 checks
- 执行过程中的 deviations
- 剩余风险或 follow-ups

使用：

- `templates/run.template.md`

## 验证标准

验证依据：

- plan objective
- plan 明确写出的 verification steps
- `context.md` 中的 locked decisions

默认使用以下具体检查：

- 定向测试
- typecheck
- build
- 当自动化验证不足时，写清楚范围明确的手动验证说明

## 边界

- 主代理不直接修改代码
- 不要执行轻量 workspace 中不存在的 plan
- 不要在 execution 阶段自动发明新 phase
- 不要跳过 execution-log.md 的更新

## 后续路由

当某个 phase 的所有 plans 都完成后，默认下一步是 `pace:verify`。只有用户明确要求处理其他目标时，才偏离此路由。
