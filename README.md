# PACE - Plan, Act, Check, Evolve

轻量级项目管理 Skills，用 phase 式工作流从需求到交付。

支持两层抽象：

- `skills` 负责具体动作执行
- `roles` 负责在外部流程系统里做阶段管理、追踪同步和路由

同时支持 **Claude Code** 和 **Codex CLI**。

## 安装

### Claude Code

```bash
/plugin marketplace add Ghost233/pace
/plugin install pace@pace
```

### Codex CLI

```bash
curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | bash
```

安装后，PACE 会被更新到用户目录，而不是项目目录：

- skills → `~/.codex/skills/pace/`
- helpers → `~/.codex/bin/pace-merge`、`~/.codex/bin/pace-init`

把 `~/.codex/bin` 加进 PATH：

```bash
export PATH="$HOME/.codex/bin:$PATH"
```

后续更新时，直接重复执行同一条命令即可：

```bash
curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | bash
```

如果你要使用 GitHub 相关流程，例如：

- 创建或更新 GitHub issue
- 写 GitHub issue comment
- 读取 GitHub issue 状态

则必须先安装并登录 GitHub CLI：

```bash
brew install gh
gh auth login
```

之后所有 GitHub 命令都必须先切换到目标仓库配置里指定的用户：

```bash
gh auth switch -u <tracker.github.username>
```

如果当前机器没有 `gh`，或者 `gh` 当前/指定用户无权访问目标仓库，则 GitHub 流程不能继续，必须显式提示用户去登录或切换到正确账号。

如果流程会产出 git 提交，还必须在配置里明确指定：

- `git.name`
- `git.email`

不要依赖机器上的默认全局 git 身份，尤其是在多 GitHub 账号场景下。

## 快速开始

```bash
# 1. 合并配置（根据执行环境选择）
pace-merge local     # 本地模式
pace-merge multica   # multica 模式

# 2. 初始化当前会话
pace-init local
# 或
pace-init multica --repo <owner/repo> --github-user <username>

# 3. 开始使用
/pace:bootstrap → 创建新项目的 .pace/ 工作区
/pace:status    → 查看当前进度和下一步默认 skill
```

## 工作流

```text
初始化闭环：
bootstrap → status

tech phase：
roadmap/status → owner_skill → verify → archive

requirement phase：
intake → discuss → plan → execute → verify → archive
                          ↑                    │
                          └────────────────────┘
```

| Skill | 作用 |
|-------|------|
| `pace:config` | 配置工作区（追踪方式、并发数、模型档位） |
| `pace:bootstrap` | 初始化项目工作区 `.pace/` |
| `pace:map-codebase` | 分析现有代码库结构 |
| `pace:intake` | 接收新需求，归入 requirements |
| `pace:discuss` | 收敛 phase 边界，锁定决策 |
| `pace:plan` | 生成可执行计划 |
| `pace:execute` | 通过子代理执行计划 |
| `pace:verify` | 验证交付是否满足目标 |
| `pace:archive` | 归档已完成的 phase |
| `pace:status` | 查看当前状态和下一步 |
| `pace:roadmap` | 维护 phase 结构 |
| `pace:milestone` | 管理 milestone 生命周期 |

## 双层架构

PACE 现在推荐拆成两层：

- **Skills 层**：`pace:intake`、`pace:discuss`、`pace:plan`、`pace:execute`、`pace:verify` 等，负责把某一步真正做完。
- **Roles 层**：只用于 `executor=multica` 且 `tracker.type=github` 的 requirement phase，负责“什么时候调用哪个 skill”“阶段之间如何交接”“什么时候同步到 GitHub issue comment”。

推荐的最小角色集：

| Role | 作用 |
|------|------|
| `PACE-调度经理` | 当当前状态不明确时先做分诊和路由，决定交给哪个角色；仍不确定时退回用户 |
| `PACE-需求接管经理` | 新 issue 首次接管；补齐 GitHub issue 链接；建立追踪上下文 |
| `PACE-阶段经理` | 管 `intake → discuss → plan` 的阶段推进和边界收敛 |
| `PACE-交付经理` | 管 `execute` 的分发、阻塞汇报和阶段交接 |
| `PACE-验收归档经理` | 管 `verify → archive` 的验收、结案和收尾同步 |

角色定义和模板位于 [`roles/`](roles/)。

确定性边界：

- `tech` phase 不走 roles 链路；它只由 roadmap 中声明的 `Owner Skill` 执行，然后进入 `pace:verify` 与 `pace:archive`
- `tech` phase 必须在 roadmap 中声明 `Expected Outputs`，否则 `status / verify / archive` 无法确定它是否完成
- `requirement` phase 才进入 `PACE-需求接管经理 → PACE-阶段经理 → PACE-交付经理 → PACE-验收归档经理`
- `PACE-调度经理` 只在入口冲突、状态冲突或回退时使用，不是标准新 issue 的第一站

## Multica 追踪约束

当 `executor = multica` 且 `tracker.type = github` 时，以下规则是硬约束：

1. 每个新 issue 在进入 phase 流程前，必须有一个规范的 GitHub issue URL。
2. 如果用户没有提供 GitHub issue URL，则由 `PACE-需求接管经理` 创建，并回填到当前流程系统的 issue 元数据中。
3. 每次阶段切换至少同步一条 GitHub comment：
   `intake`、`discuss`、`plan`、`execute`、`verify`、`archive`
4. 当 `tracker.type = github` 且 `executor = multica` 时，阶段日志必须同步到 GitHub issue；GitHub issue 必须能独立还原当前阶段的关键日志，不允许只写结论摘要。
5. 在 `tracker.type = github` 模式下，GitHub issue 的追踪块、阶段 comment 和阶段日志镜像才是跨轮次真相源；`.pace/` 只是当前工作区产物，不保证持续存在。
6. 阶段日志过长时，必须分成多条连续 comment 上传；每条 comment 最多 6000 个字符，必须带 `第 x/n 段` 标记，并保持原文顺序。
5. 在任何 GitHub 操作前，必须先用 `gh auth switch -u <tracker.github.username>` 切到配置中的用户；如果没有 `gh` 或该用户无权访问仓库，必须停止并明确要求用户介入。
6. 如果流程会产出提交，必须同时明确使用哪个 GitHub 用户、哪个 git `name`、哪个 git `email`，不能依赖本机默认身份。

完整的 multica 落地流程、角色创建方式、阶段切换和 GitHub comment 同步规则，见 [README.multica.md](README.multica.md)。

## 配置

PACE 现在区分两类文件：

- 模板配置：`.pace/config.yaml`、`.pace/config.local.yaml`、`.pace/config.multica.yaml`
- 会话配置：`.pace/session.yaml`

模板配置用于提供默认值，会话配置用于提供“本次运行的真实输入”，包括 issue、PR、分支、当前角色等上下文。

模板文件位于 `.pace/` 目录下，支持分层合并：

```
.pace/
├── config.yaml           # 基础配置（所有环境共享）
├── config.local.yaml     # 本地 Claude Code 覆盖
└── config.multica.yaml   # multica 编排覆盖
```

合并命令：

```bash
pace-merge local     # → .pace-config.yaml
pace-merge multica   # → .pace-config.yaml
```

推荐入口：

```bash
pace-init local
pace-init multica --repo <owner/repo> --github-user <username>
```

`pace-init` 会基于模板配置生成 `.pace/session.yaml`，并把当前 issue / PR / branch / role 一起写进去，作为本次运行的真相源。

配置字段：

```yaml
# 执行引擎
executor: claude-code    # claude-code | multica | manual

# 文档追踪
tracker:
  type: local            # local | github
  github:
    repo: ""             # owner/repo
    username: ""         # GitHub 用户名
    verified: false      # gh 连通性验证
    create_missing_issue: false
    sync_stage_comments: false

git:
  name: ""               # git commit user.name
  email: ""              # git commit user.email

roles:
  enabled: false
  definitions_path: "roles"
  managers:
    dispatch: PACE-调度经理
    issue_intake: PACE-需求接管经理
    phase: PACE-阶段经理
    delivery: PACE-交付经理
    closeout: PACE-验收归档经理

# 子代理设置
agents:
  max_concurrent: 3      # 最大并行数 (1-5)
  model_profile: balanced # quality | balanced | budget | adaptive
```

会话文件字段：

```yaml
config:
  executor: multica
  tracker:
    type: github
    github:
      repo: owner/repo
      username: your-username
      verified: true
  git:
    name: Your Name
    email: you@example.com

context:
  issue:
    url: https://github.com/owner/repo/issues/123
    number: 123
    title: 问题标题
    type: bug
  pr:
    url: ""
    number: null
  git:
    branch: fix-branch
    base_branch: main
    head_sha: abcdef
  role:
    current: PACE-需求接管经理
    previous: ""
  session:
    mode: multica
    started_at: 2026-04-18T12:34:56.000Z
```

## 卸载

```bash
/plugin uninstall pace@pace
```

## 项目结构

```
pace/
├── .claude-plugin/           # Claude Code 插件配置
│   ├── plugin.json
│   ├── marketplace.json
│   └── skills/              # Skills（Claude Code 从此加载）
│       ├── archive/
│       ├── bootstrap/
│       ├── config/
│       ├── discuss/
│       ├── execute/
│       ├── intake/
│       ├── map-codebase/
│       ├── milestone/
│       ├── plan/
│       ├── roadmap/
│       ├── status/
│       └── verify/
├── .agents/plugins/          # Codex CLI 插件配置
│   ├── plugin.json
│   └── marketplace.json
├── .pace/                    # 配置文件（提交到 git）
│   ├── config.yaml
│   ├── config.local.yaml
│   └── config.multica.yaml
├── roles/                    # 给 multica 等外部编排系统使用的角色定义
│   ├── README.md
│   ├── 需求接管经理.md
│   ├── 阶段经理.md
│   ├── 交付经理.md
│   ├── 验收归档经理.md
│   └── templates/
├── bin/
│   ├── install-codex.sh        # 一条命令安装到 ~/.codex
│   └── pace-merge.js         # 配置合并脚本
├── README.md
├── README.multica.md
└── package.json
```

## 名称含义

PACE = **P**lan, **A**ct, **C**heck, **E**volve

对应核心循环：规划 → 执行 → 验证 → 归档迭代
