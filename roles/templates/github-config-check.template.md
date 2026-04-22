# GitHub 配置检查模板

```md
## GitHub 配置检查

- 仓库：<tracker.github.repo>
- 仓库来源：<用户手动输入 | 初始化参数文档 | 缺失>
- 分支：<git.branch>
- 分支来源：<用户手动输入 | 初始化参数文档 | 缺失>
- GitHub 用户（仓库 checkout / GitHub 访问使用）：<tracker.github.username>
- GitHub 用户来源：<用户手动输入 | 初始化参数文档 | 缺失>
- gh 已安装：<已安装 | 未安装>
- gh 已登录：<已登录 | 未登录>
- gh 当前用户：<当前 gh 登录用户；如有切换则写切换后的用户>
- 仓库访问：<可访问 | 失败>
- Git Name：<git.name>
- Git Name 来源：<用户手动输入 | 初始化参数文档 | 缺失>
- Git Email：<git.email>
- Git Email 来源：<用户手动输入 | 初始化参数文档 | 缺失>
- 配置是否就绪：<是 | 否>
- 备注：<若 GitHub 用户 / repo / branch / Git Name / Git Email 任一为缺失，必须停止并改发 github-init-params-request.template.md；首次接管时这 5 项必须来自用户手动输入，不能从 issue 正文、外部编排器参数或本地 gh / git 状态补齐>
```
