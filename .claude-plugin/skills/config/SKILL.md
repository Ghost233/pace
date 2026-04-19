---
name: pace:config
description: 交互式配置 pace 工作区，包括追踪方式（本地/GitHub Issues）、角色层开关、子代理并发数和模型档位。首次使用或需要修改配置时触发。
---

# PACE Config

## 默认约定

- 配置文件路径：`.pace/session.yaml`
- 如果 `.pace/` 不存在，先创建目录
- 已有配置时，展示当前值并询问是否修改
- 配置变更后输出摘要确认
- 当用户明确说明运行在外部编排系统时，`executor` 必须写为 `multica`
- 当 `tracker.type=github` 且 `executor=multica` 时，默认开启 roles 配置

## 必需产物

- `.pace/session.yaml`

## 最小流程

### 第一步：读取现有配置

读取 `.pace/session.yaml`。如果不存在，则展示“当前尚未初始化”，并继续进入配置流程；不要再回退读取 `.pace-config.yaml`。

如果配置存在，解析并展示当前配置摘要：

```
当前配置：
- 执行模式：{config.executor}
- 追踪方式：{config.tracker.type}
- GitHub 仓库：{config.tracker.github.repo}（{config.tracker.github.username}）
- git 身份：{config.git.name} <{config.git.email}>
- 自动补建 GitHub issue：{config.tracker.github.create_missing_issue}
- 阶段 comment 同步：{config.tracker.github.sync_stage_comments}
- 角色层：{config.roles.enabled}
- 最大并发子代理：{config.agents.max_concurrent}
- 模型档位：{config.agents.model_profile}
```

然后问用户是否要重新配置。如果不需要，直接结束。

### 第二步：选择追踪方式

询问用户：

- **本地** — 所有工作日志保存在 `.pace/` 目录，不依赖外部服务
- **GitHub Issues** — 将工作日志同步到 GitHub Issues，支持层级结构（Project → Phase → Wave）

### 第二步补充：选择执行模式

询问用户：

- **本地执行** — `executor=claude-code`，主要依赖本地 skills 推进
- **外部编排** — `executor=multica`，由 roles 管理阶段推进和 GitHub 同步

### 第三步（仅 GitHub 模式）：配置 GitHub

1. 询问 `owner/repo` 格式的仓库名
2. 询问 GitHub 用户名
3. 询问 git commit 使用的名字
4. 询问 git commit 使用的邮箱
5. 运行 `which gh` 检查 gh CLI 是否安装
   - 未安装：提示用户先在流程外安装（`brew install gh` 或参考 https://cli.github.com/），然后跳过验证，标记 `verified: false`
   - 已安装：继续验证
6. 运行 `gh auth status` 检查当前登录状态
   - 未登录：提示用户先在流程外运行 `gh auth login`，标记 `verified: false`
   - 已登录但用户不匹配：提示后续流程默认优先使用 `pace-gh` / `pace-git` 自动切用户；若必须直接使用原生 `gh`，再手工 `gh auth switch`，标记 `verified: false`
   - 已登录且用户匹配：标记 `verified: true`

**重要：**

- 在后续任何需要调用 GitHub 的 skill 或 role 中，默认优先使用 `pace-gh`；它只会在当前机器已完成 GitHub 登录的前提下按 `.pace/session.yaml` 切换到配置中的 GitHub 用户。
- 只有当 wrapper 未覆盖该操作时，才允许直接使用原生 `gh`；这属于例外路径，不是默认流程。此时执行前必须先检查当前 gh 用户是否与配置中的 `username` 一致，并手工执行：
  `gh auth switch -u <tracker.github.username>`
- 所有 git 提交都必须使用配置中的：
  - `git.name`
  - `git.email`
- 如果没有 `gh`、没有登录、或者指定用户无权访问目标仓库，则必须停止当前 GitHub 流程，并明确提示用户在流程外处理：
  - 先安装 `gh`
  - 先执行 `gh auth login`
  - 如果当前机器已完成登录但账号不匹配，再切换到 `tracker.github.username`
- GitHub 不可达时，不能假装继续创建 issue / comment。
- 如果 `git.name` / `git.email` 未配置，也不能假装继续进入需要提交的流程。

### 第三步补充（仅 GitHub 模式）：配置同步策略

继续询问：

- 是否在缺失 GitHub issue URL 时自动创建 issue
- 是否在每个阶段边界自动同步主 issue comment

默认值：

- `create_missing_issue: true`
- `sync_stage_comments: true`

只有当用户明确说只做本地追踪时，才关闭这两个开关。

### 第四步：配置角色层

询问用户是否启用 roles 层：

- **关闭** — 只用 skills，本地手动推进
- **开启** — 在 multica 等系统中用角色做阶段管理

如果开启，写入默认 managers：

- `dispatch: PACE-调度经理`
- `setup: PACE-初始化经理`
- `issue_intake: PACE-需求接管经理`
- `phase: PACE-阶段经理`
- `delivery: PACE-交付经理`
- `closeout: PACE-验收归档经理`

### 第五步：配置子代理并发数

询问最大并行子代理数：

- **1** — 串行执行，适合复杂依赖或调试场景
- **2** — 轻度并行
- **3**（默认）— 平衡模式，适合大多数项目
- **4** — 较高并行，适合独立任务多的项目
- **5** — 最大并行，注意 API 速率限制

### 第六步：配置模型档位

询问模型档位：

- **quality** — 所有子代理使用 Opus，适合关键项目，成本最高
- **balanced**（默认） — 规划/验证用 Opus，执行用 Sonnet，研究用 Sonnet
- **budget** — 规划用 Sonnet，执行和研究用 Haiku，成本最低
- **adaptive** — 根据任务复杂度自动选择，规划类用 Opus，其余用 Sonnet

### 第七步（按需）：按 agent 覆盖模型

仅当用户明确要求按 agent 覆盖模型时，才执行这一步；否则写入空 `model_overrides` 并跳过。

常见 agent 类型：pace-executor, pace-planner, pace-verifier, pace-phase-researcher, pace-code-reviewer

### 第八步：写入配置

将配置写入 `.pace/session.yaml`，格式如下：

```yaml
# PACE 会话配置
# 由 pace:config 生成

config:
  executor: claude-code                # claude-code | multica | manual
  tracker:
    type: local                        # local | github
    github:
      repo: ""                         # owner/repo
      username: ""                     # GitHub 用户名
      verified: false                  # gh 连通性是否已验证
      create_missing_issue: false      # 缺失 GitHub issue URL 时是否自动创建
      sync_stage_comments: false       # 是否在阶段边界同步 comment
  git:
    name: ""                           # git commit user.name
    email: ""                          # git commit user.email
  roles:
    enabled: false
    definitions_path: "roles"
    managers:
      dispatch: PACE-调度经理
      setup: PACE-初始化经理
      issue_intake: PACE-需求接管经理
      phase: PACE-阶段经理
      delivery: PACE-交付经理
      closeout: PACE-验收归档经理
  agents:
    max_concurrent: 3
    model_profile: balanced

context:
  issue:
    url: ""
    number: null
    title: ""
    type: ""
  pr:
    url: ""
    number: null
  git:
    branch: ""
    base_branch: ""
    head_sha: ""
  role:
    current: ""
    previous: ""
  session:
    mode: ""
    started_at: ""
```

如果原来的 `.pace/session.yaml` 已存在，写入时保留原有 `context` 区块，除非用户明确要求一起覆盖当前 issue / PR / branch / role。

### 第九步：输出确认摘要

```
配置已保存到 .pace/session.yaml

执行模式：{config.executor}
追踪方式：{config.tracker.type}
{如果是 GitHub：GitHub 仓库：{config.tracker.github.repo}（{config.tracker.github.username}）验证状态：{config.tracker.github.verified}}
git 身份：{config.git.name} <{config.git.email}>
{如果是 GitHub：自动补建 issue：{config.tracker.github.create_missing_issue}；阶段 comment 同步：{config.tracker.github.sync_stage_comments}}
角色层：{config.roles.enabled}
最大并发子代理：{config.agents.max_concurrent}
模型档位：{config.agents.model_profile}
{如果有覆盖：模型覆盖：{overrides}}
```

## 边界

- 不要修改 `.pace/` 下的其他文件
- 不要在配置过程中执行任何 pace workflow 操作
- GitHub 验证失败时只记录当前机器的检查结果，不代表已完成认证登录
- 不处理 gh CLI 安装，只提示
- 不要在这里直接创建 GitHub issue；这里只配置策略，不执行业务同步
- 但必须明确告诉后续角色：优先使用 `pace-gh`；只有在当前机器已完成 GitHub 登录时，才允许在已登录账号之间切换；直接使用原生 `gh` 时，仍需要手工 `gh auth switch -u <tracker.github.username>`
- 也必须明确告诉后续角色：所有 git 提交都要使用 `git.name` 和 `git.email`

## 后续路由

- 首次配置完成后：
  - `multica + roles`：交给 `PACE-初始化经理`
  - `local / skills-only`：`pace:bootstrap`
- 已有 workflow 修改配置：回到之前的 skill 继续工作
