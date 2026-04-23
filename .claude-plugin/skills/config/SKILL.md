---
name: pace:config
description: 配置本地 PACE 工作区，收敛 `.pace/config*.yaml` 的本地模式参数，并生成 `pace-init.js local` 所需的最小输入。当用户首次使用、需要修改本地 workflow 配置、或想切换并发数 / 模型档位 / git 身份时触发。
---

# PACE Config

## 当前定义

当前仓库只定义本地模式：

- `executor = claude-code`
- `tracker.type = local`
- `roles.enabled = false`

不要再让用户选择：

- `multica`
- `tracker.type = github`
- `roles.enabled = true`

这些组合都不再是当前支持的主定义。

## 最小流程

1. 读取 `.pace/session.yaml`
2. 如果存在，展示当前本地配置摘要
3. 只询问以下字段：
   - `git.name`
   - `git.email`
   - `agents.max_concurrent`
   - `agents.model_profile`
4. 构造并执行：
   - `node "$HOME/.codex/skills/pace/bin/pace-init.js" local --git-name "<name>" --git-email "<email>"`
5. 输出确认摘要

## 输出摘要至少包含

- 执行模式：`claude-code`
- 追踪方式：`local`
- 角色层：`false`
- git 身份
- 最大并发
- 模型档位

## 边界

- 不要写多角色 managers
- 不要询问 GitHub 仓库、GitHub 用户、主 issue URL
- 不要执行任何 multica / GitHub 文档链初始化
