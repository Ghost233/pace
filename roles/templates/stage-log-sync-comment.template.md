# 阶段日志同步评论模板

```md
## [PACE] 阶段日志同步 - <步骤标识> - <日志类型> - 第 <part>/<total> 段

- 角色：<PACE-...>
- 阶段：<阶段编号或 n/a>
- 当前步骤：<tracking-init(追踪初始化) | intake(接收) | discuss(讨论) | plan(计划) | execute(执行) | verify(验证) | archive(归档)>
- 日志类型：<tracking-block | requirement-entry | roadmap-entry | discussion-log | context | coverage | plan-file | execution-log | run-summary | verification | archive-entry>
- 源文件：
  - `<仓库内路径>`
- 同步模式：全文镜像
- 分段规则：
  - 当前段：<part>/<total>
  - 续传起点：<标题 / 段落 / 文件偏移说明>
- 日志内容：
  ```text
  <这一段的原文内容>
  ```
```
