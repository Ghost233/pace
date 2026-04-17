---
name: pace:verify
description: 验证某个 phase 的交付是否满足目标、计划和关键决策，将验证结论写入 `.pace/phases/` 与 `.pace/state.md`。当某个 phase 的 plans 执行完成、需要确认交付标准时触发。
---

# PACE Verify

## 配置读取

执行任何操作前，先读取 `.pace-config.yaml`。如果文件不存在，提示用户先运行 `pace:config` 初始化配置，然后使用默认值继续。如果文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。

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

优先使用：

- `templates/verification.template.md`

## 验证目标

验证的不是“任务看起来做了”，而是：

- phase goal 是否达成
- plan objective 是否兑现
- locked decisions 是否被遵守
- 关键 checks 是否通过

## 验证流程

1. 解析目标 phase
2. 读取该 phase 的 roadmap goal
3. 汇总该 phase 的 plans 与 runs
4. 若存在 `context.md`，提取 locked decisions
5. 若存在 `coverage.md`，检查是否有 Status != `done` 的行
6. 对照以下五类事实做验证：
   - roadmap goal
   - plan objectives
   - locked decisions
   - coverage.md 全覆盖
   - automated checks
7. 输出通过、失败或部分通过结论

## 验证手段

优先使用这些检查：

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
- overall verdict
- checks run
- evidence
- failed or uncertain items
- recommended next step

推荐 verdict：

- `pass`
- `partial`
- `fail`

## 路由规则

- `pass`：通常进入 `pace:archive` 或下一 phase
- `partial`：通常回到 `pace:plan` 或 `pace:execute`
- `fail`：必须明确指出失败点，并建议先修复再验证

## 边界

- 不要把执行工作混进 verify，除非用户明确要求边验边修
- 不要仅凭 run summary 就判定通过
- 不要省略 evidence

## 后续路由

- 验证通过：`pace:archive`
- 发现缺口：`pace:plan` 或 `pace:execute`
- 无法判断当前状态：`pace:status`
