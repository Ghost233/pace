---
name: pace:verify
description: 验证某个 phase 的交付是否满足目标、计划和关键决策，将验证结论写入 `.pace/phases/` 与 `.pace/state.md`。当某个 phase 的 plans 执行完成、需要确认交付标准时触发。
---

# PACE Verify

## 配置读取

执行任何操作前，先读取 `.pace-config.yaml`。如果文件不存在，提示用户先运行 `pace:config` 初始化配置；本次执行仅使用以下固定默认值继续：`tracker.type=local`、`agents.max_concurrent=1`、`agents.model_profile=balanced`、`agents.model_overrides={}`。如果文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

## 默认约定

- 读取 `.pace/phases/<phase>/plans/`
- 读取 `.pace/phases/<phase>/runs/`
- 若存在，读取 `.pace/phases/<phase>/context.md`
- 若存在，读取 `.pace/phases/<phase>/coverage.md`
- 读取 `.pace/roadmap.md` 与 `.pace/state.md`
- 将验证结果写入 phase 目录，并同步 state

## 必需产物

- `.pace/phases/<phase>/verification.md`
- 更新后的 `.pace/state.md`

使用：

- `templates/verification.template.md`

## 验证目标

验证的不是“任务看起来做了”，而是：

- phase goal 是否达成
- plan objective 是否兑现
- locked decisions 是否被遵守
- 关键 checks 是否通过
- 如果当前 phase `Type = tech`，则验证 `Owner Skill` 产物是否满足 `Done Criteria`

## 验证流程

1. 解析目标 phase
2. 读取该 phase 的 roadmap goal
3. 如果当前 phase `Type = tech`，同时读取该 phase 的 `Expected Outputs` 与 `Done Criteria`
4. 汇总该 phase 的 plans 与 runs
5. 若存在 `context.md`，提取 locked decisions
6. 若存在 `coverage.md`，检查是否有 Status != `done` 的行
7. 对照以下五类事实做验证：
   - roadmap goal
   - plan objectives
   - locked decisions
   - coverage.md 全覆盖
   - automated checks
8. 如果当前 phase `Type = tech`，还必须核查：
   - `Expected Outputs` 中列出的路径全部存在
   - `Done Criteria` 中每一条都能在证据中找到对应结论
9. 输出通过、失败或部分通过结论

## 验证手段

默认使用这些检查：

- 定向测试
- typecheck
- build
- lint
- 用户要求的专项验证

如果自动验证不足，可以补充范围清晰的人工验证说明，但必须写明：

- 验证了什么
- 没验证什么
- 风险在哪

## Verification 结果格式

`verification.md` 至少包含：

- phase
- final_status
- blocking_gaps
- checks run
- evidence
- failed or uncertain items
- recommended next step

`final_status` 只允许：

- `pass`
- `partial`
- `fail`

## 路由规则

- `pass`：默认进入 `pace:archive`
- `partial`：若问题属于计划覆盖不足，进入 `pace:plan`；若问题属于实现未完成，进入 `pace:execute`
- `fail`：默认进入 `pace:execute`，修复后再回 `pace:verify`

## 边界

- 不要把执行工作混进 verify，除非用户明确要求边验边修
- 不要仅凭 run summary 就判定通过
- 不要省略 evidence

## 后续路由

- 验证通过：`pace:archive`
- 发现缺口：`pace:plan` 或 `pace:execute`
- 无法判断当前状态：`pace:status`
