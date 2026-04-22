# 追踪块 / tracking-init 评论模板

用于 `PACE-需求接管经理`：

- 写入或更新追踪块快照
- 生成第一条 `tracking-init` comment
- 同步 tracking block 到 GitHub 文档层时保持字段结构稳定

```md
## 追踪信息

- 追踪模式：github
- 主 Issue：<https://github.com/owner/repo/issues/123>
- 文档 Root Issue：<https://github.com/owner/repo/issues/456 | 无>
- 初始化参数 Issue：<https://github.com/owner/repo/issues/457 | 无>
- 主 Issue 文档索引 Comment：<https://github.com/owner/repo/issues/123#issuecomment-... | 无>
- 执行仓库：<owner/repo>
- 执行分支：<branch>
- 文档集合：
  - `init-params`: <issue 链接 @ rev-N>
  - `phase:<phase-id | unknown>`: <issue 链接 @ rev-N | 无>
  - `phase-section:tracking-summary`: <已更新 | 无>
  - `phase-section:requirement-summary`: <已更新 | 无>
- 最新正文节点：
  - <phase-issue -> issue 链接 @ rev-N (latest)>
- 文档滚动链：
  - <没有则写 无>
- 当前阶段：<phase-id 或 unknown>
- 当前步骤：<tracking-init(追踪初始化) | intake(接收) | discuss(讨论) | plan(计划) | execute(执行) | verify(验证) | archive(归档)>
- 当前角色：<PACE-需求接管经理>
- 当前阶段类型：<requirement(需求) | tech(技术) | unknown(未知)>
- 最近同步时间：<ISO timestamp>
```
