# 验收归档经理验证结论评论模板

```md
## [PACE] 验证结论 - <通过(pass) | 部分通过(partial) | 失败(fail)>

- 角色：PACE-验收归档经理
- 阶段：<阶段编号>
- 主 Issue：<issue 链接>
- 文档 Root Issue：<issue 链接 | 无>
- 初始化参数 Issue：<issue 链接 | 无>
- 主 Issue 文档索引 Comment：<comment 链接 | 无>
- 执行仓库：<owner/repo | 无>
- 执行分支：<branch | 无>
- 最终状态：<通过(pass) | 部分通过(partial) | 失败(fail)>
- 阻塞缺口数：<0 | N>
- 目标检查：
  - <目标是否达成>
- 需求覆盖：
  - <REQ-001 - 通过(pass) / 失败(fail)>
- 证据：
  - `phase-section:verification`
  - <测试 / 运行记录 / 计划文件>
- 文档集合：
  - `phase:<phase-id>`: <issue 链接 @ rev-N>
  - `phase-section:verification`: <已更新 | 无>
- 最新正文节点：
  - <phase-issue -> issue 链接 @ rev-N (latest)>
- 文档滚动链：
  - <没有则写 无>
- 审计 Comment：
  - <comment 链接列表；没有则写 无>
- 当前结论：<为什么通过，或为什么不能归档>
- 终态：<handoff | needs_user_input | closed>
- handoff：<PACE-验收归档经理 | PACE-交付经理 | PACE-阶段经理 | 无>
- needs_user_input：<true | false>
- closed：<true | false>
- 下一角色：<PACE-验收归档经理 | PACE-交付经理 | PACE-阶段经理>
- 下一技能：<pace:archive | pace:execute | pace:plan | pace:discuss>
- 下一阶段必需输入：
  - <如果进入 pace:archive，列出归档所需验证前提>
  - <如果回退，列出必须修复的缺口>
- 剩余风险：
  - <没有则写 无>
```
