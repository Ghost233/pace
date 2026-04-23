# README.multica 已归档

`multica + github issue` 这条模式不再是 PACE 当前支持的工作流定义。

原因：

- 已经验证流程只能稳定在本地工作区中运行
- 外部 assignee / handoff / GitHub 文档链会引入额外状态源，导致路由、恢复和自动推进不稳定
- 当前仓库的主定义已经切换为：
  - `local-only`
  - `skills/workflow` 驱动
  - 本地 `.pace/` 作为主工作区状态

## 当前主路径

请改看：

- [README.md](README.md)
- [`.claude-plugin/skills/workflow/SKILL.md`](.claude-plugin/skills/workflow/SKILL.md)
- [`roles/流程经理.md`](roles/流程经理.md)

## 兼容性说明

仓库里仍然保留了一些旧的 `multica` / `GitHub issue` 相关脚本、roles 和 skill 分支，原因仅是：

- 避免一次性删除兼容代码
- 保留历史参考

但它们不再代表当前推荐模式，也不应作为新流程的定义来源。

如果后续继续收敛，应按下面方向处理：

1. `pace:workflow` 作为唯一编排入口
2. `pace:bootstrap / intake / discuss / plan / execute / verify / archive / recover` 作为执行 skills
3. 多角色 handoff 改成单角色内部 `current_stage / next_stage`
4. 不再依赖 Multica assignee、GitHub 主 issue、root issue、init-params issue 作为主工作流真相源
