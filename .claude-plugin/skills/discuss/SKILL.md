---
name: pace:discuss
description: 针对某个 phase 收敛边界、锁定决策、拒绝项和参考输入，写出下游 planning 可直接消费的 context。当某个 phase 还存在关键歧义、需要在 planning 前锁定边界和决策时触发。
---

# PACE Discuss

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应按当前场景停止并要求先初始化：

- multica / GitHub 角色链：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica ...`
- 本地模式：要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。启动研究子代理和审查子代理时使用对应的 model 参数。

## 默认约定

- 读取 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- 若存在 `.pace/codebase/`，一并读取
- phase 级产物写入 `.pace/phases/<phase>/`
- 讨论聚焦在边界、风险、参考和拒绝项，不展开实现细节
- `multica + github` 下，以上本地文件只在工作区已从 GitHub 主 issue、主 issue 的受控索引 comment、文档 root issue、初始化参数子 issue、各文档子 issue 恢复后才可信；若检测到缺失恢复、状态冲突或副本不完整，必须先停止并要求恢复/同步，不能直接继续 discuss

## 必需产物

- `.pace/phases/<phase>/context.md`
- `.pace/phases/<phase>/discussion-log.md`
- `.pace/phases/<phase>/coverage.md`
- `multica + github` 下，上述稳定正文只有在同步到对应文档子 issue 的 body，并由主 issue 受控索引 comment 与文档 root issue 收录后，才算跨轮次持久化完成
- `multica + github` 下，还必须产出对应的文档同步动作：文档子 issue body 更新、审计 comment、文档 root issue 索引更新、主 issue 受控索引 comment 回填

使用：

- `templates/context.template.md`
- `templates/discussion-log.template.md`
- `templates/coverage.template.md`
- `references/question-framework.md`
- `references/gray-area-rules.md`
- `references/context-writing-rules.md`

## 最小流程

1. 从 roadmap 解析当前 phase
2. 读取 prior context，避免重复提问
3. 如有代码地图，做轻量 scout
4. 只识别会改变 `scope`、`acceptance`、`dependency`、`data model` 或 `external integration` 的 gray areas；纯文案偏好和实现细节不列为 gray area
5. 对需要技术调查的 gray area，启动**研究子代理**：
   - 触发条件：涉及不熟悉的技术栈、库选型对比、SOTA 判断、架构模式验证
   - 将 phase goal、相关 requirements、代码地图（如有）发给研究子代理
   - 研究子代理调查方向：
     - 当前生态的标准技术栈是什么
     - 主流架构模式及适用场景
     - 常见陷阱和"不要自己造"的轮子
     - Claude 训练数据可能过时的部分（以官方文档为准）
   - 研究结果直接注入对应 gray area 的选项分析，作为步骤 6 中“推荐选项”和“不推荐原因”的依据
   - 不需要调查的 gray area（纯业务逻辑、用户偏好等）跳过此步骤
6. 将每个 gray area 的选项整理后**呈现给用户**，每个选项必须包含：
   - 选项描述
   - **推荐选项**：基于代码分析和上下文，给出推荐选项及原因
   - **其他选项不推荐的原因**：简要说明每个未推荐选项为什么不合适（基于代码分析或研究结果）
7. 基于用户回复形成 Locked Decisions
8. 用户可以只回答部分问题、变更部分选项，接受增量式答复
9. 若仍有未决 gray area，再次整理并呈现给用户，继续等待
10. 所有关键 gray area 收敛后，启动**子代理审查**：
   - 将 phase goal、requirements、locked decisions、discussion-log 发给审查子代理
   - 审查子代理逐项核查：
     - Locked Decisions 是否完整覆盖 phase goal
     - 是否存在未识别的 gray area（与 goal 相关但未被讨论的决策点）
     - 是否存在隐含假设（某个 decision 依赖了未讨论的前提）
     - Phase Boundary 是否清晰（scope in / scope out 是否明确）
     - Deferred Ideas 是否合理（是否有本该讨论但被不当延迟的内容）
   - 审查子代理返回 verdict：pass | revise
   - 若 verdict = revise，附带遗漏的 gray area 清单，回到步骤 5 继续讨论
   - 若 verdict = pass，继续下一步
11. 写 `context.md`
12. 写 `discussion-log.md`
13. 从 Locked Decisions 和讨论结果中提取编号化交付物，写 `coverage.md`
14. 若当前是 `multica + github`，必须立即执行文档层同步：
   - 先执行 `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue <main-issue>`
   - 再分别执行 `upsert-doc` 同步 `context`、`discussion-log`、`coverage` 到对应文档子 issue body
   - 每次 `upsert-doc` 如有摘要或变更说明，配套写审计 comment
   - 只有当文档 root issue 与主 issue 受控索引 comment 已回填最新索引后，才算 discuss 完成
15. 将讨论摘要和最终决策结果**打印到对话中**，供用户复查

## 输出要求（硬性）

discuss 完成后，必须在对话中输出以下内容：

### 讨论摘要

- 参与讨论的 gray area 数量
- 每个 gray area 的最终决策（用户选了哪个）
- 每个被否决方案及否决原因
- 被延迟到后续 phase 的想法

### Locked Decisions 列表

- 逐条列出所有 Locked Decisions（D-01、D-02 ...），包含决策内容和选择原因

### Coverage 概览

- 交付物总数及 ID 列表
- 每个 coverage 项的一句话描述

不要只说"已完成讨论，详见 context.md"。用户需要直接在对话中看到结论。

## 决策规则（硬性）

- **禁止替用户做选择**：每个 gray area 的选项必须呈现给用户，由用户拍板
- **禁止在用户回复前写入 context.md 或 discussion-log.md**：决策文件是讨论的结论，不是讨论的前提
- **禁止用代码分析结果直接推导选项**：代码分析用于缩小选项范围和排除明显不可行方案，但不能代替用户决策
- **每次只呈现当前未决的 gray areas**：已确认的不要重复问

## 完成标准

- phase goal 清楚
- 所有关键 gray area 已由用户确认
- `Locked Decisions` 已形成，且每个决策都来自用户选择而非自行推断
- `Phase Boundary` 已明确
- `Deferred Ideas` 已隔离
- `References` 已能支撑下游 planning
- planner 读完 `context.md` 后不需要再反向问同类问题

## 边界

- 不做 planning
- 不把新能力直接扩进当前 phase
- 不替用户选择方案
- 不在用户回复前生成决策文件
- 方法论细节放在 `references/`，不放在主文档里

## 后续路由

成功完成 discuss 后，默认下一步是 `pace:plan`；只有用户明确指定其他目标时才偏离该路由。
