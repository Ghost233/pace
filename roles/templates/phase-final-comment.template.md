# 阶段经理最终评论模板

```md
## [PACE] 阶段结论 - <可进入执行 | 需要补充 | 回退阶段>

- 角色：PACE-阶段经理
- 阶段：<阶段编号>
- 主 Issue：<issue 链接>
- 文档 Root Issue：<issue 链接 | 无>
- 初始化参数 Issue：<issue 链接 | 无>
- 主 Issue 文档索引 Comment：<comment 链接 | 无>
- 执行仓库：<owner/repo | 无>
- 执行分支：<branch | 无>
- 结果类型：<可进入执行 | 需要补充 | 回退阶段>
- 覆盖的需求：
  - <REQ-001, REQ-002>
- 已锁定决策：
  - <D-01 summary>
- 已就绪产物：
  - `phase-section:context`
  - `phase-section:discussion-log`
  - `phase-section:plan`
- 文档集合：
  - `phase:<phase-id>`: <issue 链接 @ rev-N>
  - `phase-section:context`: <已更新 | 无>
  - `phase-section:discussion-log`: <已更新 | 无>
  - `phase-section:plan`: <已更新 | 无>
  - `phase-section:requirement-summary`: <已更新 | 无>
- 最新正文节点：
  - <phase-issue -> issue 链接 @ rev-N (latest)>
- 文档滚动链：
  - <没有则写 无>
- 审计 Comment：
  - <comment 链接列表；没有则写 无>
- Checker 结果：
  - <通过(pass)>
- 当前结论：<为什么已可进入执行>
- 终态：<handoff | needs_user_input | closed>
- handoff：<PACE-交付经理 | PACE-阶段经理 | Owner Skill:<skill> | 无>
- needs_user_input：<true | false>
- closed：<true | false>
- 下一角色：<PACE-交付经理 | PACE-阶段经理 | 无>
- 下一技能：<pace:execute | pace:discuss | pace:plan | Owner Skill:<skill> | 无>
- 恢复角色：<PACE-阶段经理 | 无>
- 下一阶段必需输入：
  - phase-section:plan
  - 覆盖项摘要与计划映射
  - 已锁定决策
  - 验证预期
- 剩余风险：
  - <没有则写 无>
- 缺失项 / 仍需用户输入：
  - <没有则写 无>
```
