---
name: pace:config
description: 交互式配置 pace 工作区，包括追踪方式（本地/GitHub Issues）、子代理并发数和模型档位。首次使用或需要修改配置时触发。
---

# PACE Config

## 默认约定

- 配置文件路径：`.pace-config.yaml`
- 如果 `.pace/` 不存在，先创建目录
- 已有配置时，展示当前值并询问是否修改
- 配置变更后输出摘要确认

## 必需产物

- `.pace-config.yaml`

## 最小流程

### 第一步：读取现有配置

用 Read 读取 `.pace-config.yaml`。如果存在，解析并展示当前配置摘要：

```
当前配置：
- 追踪方式：{tracker.type}
- GitHub 仓库：{tracker.github.repo}（{tracker.github.username}）
- 最大并发子代理：{agents.max_concurrent}
- 模型档位：{agents.model_profile}
```

然后问用户是否要重新配置。如果不需要，直接结束。

### 第二步：选择追踪方式

用 AskUserQuestion 询问：

- **本地** — 所有工作日志保存在 `.pace/` 目录，不依赖外部服务
- **GitHub Issues** — 将工作日志同步到 GitHub Issues，支持层级结构（Project → Phase → Wave）

### 第三步（仅 GitHub 模式）：配置 GitHub

1. 用 AskUserQuestion 询问 `owner/repo` 格式的仓库名
2. 用 AskUserQuestion 询问 GitHub 用户名
3. 用 Bash 运行 `which gh` 检查 gh CLI 是否安装
   - 未安装：提示用户安装（`brew install gh` 或参考 https://cli.github.com/），然后跳过验证，标记 `verified: false`
   - 已安装：继续验证
4. 用 Bash 运行 `gh auth status` 检查当前登录状态
   - 未登录：提示运行 `gh auth login`，标记 `verified: false`
   - 已登录但用户不匹配：提示运行 `gh auth switch` 切换到配置的用户，标记 `verified: false`
   - 已登录且用户匹配：标记 `verified: true`

**重要：** 在后续任何需要调用 `gh` 命令的 skill 中，执行前必须先检查当前 gh 用户是否与 config 中的 username 一致。如果不一致，提示用户先执行 `gh auth switch`。

### 第四步：配置子代理并发数

用 AskUserQuestion 询问最大并行子代理数：

- **1** — 串行执行，适合复杂依赖或调试场景
- **2** — 轻度并行
- **3**（默认）— 平衡模式，适合大多数项目
- **4** — 较高并行，适合独立任务多的项目
- **5** — 最大并行，注意 API 速率限制

### 第五步：配置模型档位

用 AskUserQuestion 询问模型档位：

- **quality** — 所有子代理使用 Opus，适合关键项目，成本最高
- **balanced**（默认） — 规划/验证用 Opus，执行用 Sonnet，研究用 Sonnet
- **budget** — 规划用 Sonnet，执行和研究用 Haiku，成本最低
- **adaptive** — 根据任务复杂度自动选择，规划类用 Opus，其余用 Sonnet

### 第六步（可选）：按 agent 覆盖模型

询问用户是否需要为特定 agent 指定不同模型。如果需要，询问 agent 名称和模型。

常见 agent 类型：pace-executor, pace-planner, pace-verifier, pace-phase-researcher, pace-code-reviewer

### 第七步：写入配置

用 Write 工具将配置写入 `.pace-config.yaml`，格式如下：

```yaml
# PACE 工作区配置
# 由 pace:config 生成，请勿手动编辑首行以外的注释

tracker:
  type: local                          # local | github
  github:
    repo: ""                           # owner/repo
    username: ""                       # GitHub 用户名
    verified: false                    # gh 连通性是否已验证

agents:
  max_concurrent: 3                    # 最大并行子代理数 (1-5)
  model_profile: balanced              # quality | balanced | budget | adaptive
  # model_overrides: {}                # 可选：按 agent 类型覆盖模型
  #   pace-executor: opus
  #   pace-planner: sonnet
```

### 第八步：输出确认摘要

```
配置已保存到 .pace-config.yaml

追踪方式：{type}
{如果是 GitHub：GitHub 仓库：{repo}（{username}）验证状态：{verified}}
最大并发子代理：{max_concurrent}
模型档位：{model_profile}
{如果有覆盖：模型覆盖：{overrides}}
```

## 边界

- 不要修改 `.pace/` 下的其他文件
- 不要在配置过程中执行任何 pace workflow 操作
- GitHub 验证失败时只标记状态，不阻塞配置写入
- 不处理 gh CLI 安装，只提示

## 后续路由

- 首次配置完成后：`pace:bootstrap`
- 已有 workflow 修改配置：回到之前的 skill 继续工作
