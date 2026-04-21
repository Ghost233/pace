# 交付经理最终评论模板

```md
## [PACE] 执行阶段结论 - <可进入验证 | 需回退 | 需要补充>

- 角色：PACE-交付经理
- 阶段：<阶段编号>
- 主 Issue：<issue 链接>
- 文档 Root Issue：<issue 链接 | 无>
- 初始化参数 Issue：<issue 链接 | 无>
- 主 Issue 文档索引 Comment：<comment 链接 | 无>
- 执行仓库：<owner/repo | 无>
- 执行分支：<branch | 无>
- 结果类型：<可进入验证 | 需回退 | 需要补充>
- 已完成计划：
  - <计划编号>
- 覆盖状态：
  - <已完成 X / 总数 Y>
- 产出的运行记录：
  - <已聚合到 phase-section:execution 的 run summary 摘要>
- 执行日志：
  - `phase-section:execution`
- 文档集合：
  - `phase:<phase-id>`: <issue 链接 @ rev-N>
  - `phase-section:execution`: <已更新 | 无>
- 最新正文节点：
  - <phase-issue -> issue 链接 @ rev-N (latest)>
- 文档滚动链：
  - <没有则写 无>
- 审计 Comment：
  - <comment 链接列表；没有则写 无>
- 当前结论：<为什么已可进入验证>
- 终态：<handoff | needs_user_input | closed>
- handoff：<PACE-验收归档经理 | PACE-阶段经理 | PACE-交付经理 | Owner Skill:<skill> | 无>
- needs_user_input：<true | false>
- closed：<true | false>
- 下一角色：<PACE-验收归档经理 | PACE-阶段经理 | PACE-交付经理 | 无>
- 下一技能：<pace:verify | pace:plan | pace:discuss | pace:execute | Owner Skill:<skill> | 无>
- 恢复角色：<PACE-交付经理 | PACE-阶段经理 | 无>
- 下一阶段必需输入：
  - phase-section:execution
  - 运行摘要
  - 执行覆盖摘要
  - 自动/人工验证证据
- 偏差 / 后续事项：
  - <没有则写 无>
- 阻塞缺口：
  - <必须写 无 或明确列出，不能留空>
```
