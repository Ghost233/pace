# GitHub 初始化参数补充模板

```md
## 请补充初始化参数

当前不能继续接管，因为以下字段必须由你在本轮手动输入，不能猜测，也不能从 checkout 目录、当前分支、issue 外部上下文、外部编排器参数或本地 `gh` / `git` 状态补齐。

- GitHub 用户（仓库 checkout / GitHub 访问使用的用户名）：<必填>
- 仓库地址（owner/repo）：<必填>
- 起始分支（从哪个分支开始修复）：<必填>
- Git Name：<必填>
- Git Email：<必填>

回显给用户时，必须遵守：

- 只允许填写 issue 正文或 issue 元数据里已经明确给出的值
- 没有明确给出的字段，一律显示 `<未提供>`
- 禁止把当前 checkout 到的仓库目录、当前 git 分支、当前机器上的 `gh` / `git` 配置抄进模板

请直接按下面格式回复，不要省略字段；若当前 issue 未明确提供某个值，就先写 `<未提供>`：

github_user: <username | 未提供>
repo: <owner/repo | 未提供>
branch: <branch | 未提供>
git_name: <name | 未提供>
git_email: <email | 未提供>
config_confirmed: <是|否>
```
