# PACE - Plan, Act, Check, Evolve

轻量级项目管理 Skills，用 phase 式工作流从需求到交付。

当前主定义已经收敛为：

- `local-only`
- `skills/workflow` 驱动
- 本地 `.pace/` 作为工作区状态与执行缓存

当前推荐的最小抽象只有两层：

- `pace:workflow` 负责编排、路由和阶段切换
- 其他 `pace:*` skills 负责把某一步真正做完

`multica + github issue + 多角色 handoff` 不再是当前支持的主工作流定义，只保留为历史兼容代码，不建议继续使用。

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

如果你要固定到某个 tag 或自定义归档地址，推荐这样执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | \
  PACE_INSTALL_REF_TYPE=tags PACE_INSTALL_REF=<tag> bash

curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | \
  PACE_INSTALL_ARCHIVE_URL=<tarball-url> bash
```

安装后，PACE 会被更新到用户目录，而不是项目目录：

- skills → `~/.codex/skills/pace/`
- primary scripts → `~/.codex/skills/pace/bin/pace-merge.js`、`~/.codex/skills/pace/bin/pace-init.js`、`~/.codex/skills/pace/bin/pace-workflow.js`、`~/.codex/skills/pace/bin/pace-git.js`
- compatibility scripts → `~/.codex/skills/pace/bin/pace-gh.js`、`~/.codex/skills/pace/bin/pace-issue-doc.js`、`~/.codex/skills/pace/bin/pace-multica.js`

这些脚本直接用 `node` 调用，不再额外生成 PATH 命令入口。

常用调用方式：

```bash
node "$HOME/.codex/skills/pace/bin/pace-init.js" local
node "$HOME/.codex/skills/pace/bin/pace-workflow.js" route --json
```

如果你之前按旧习惯直接输入 `pace-init`，当前 shell 提示 `command not found` 是正常的；现在优先按下面顺序排查：

1. `ls -l ~/.codex/skills/pace/bin/pace-init.js`
2. `node "$HOME/.codex/skills/pace/bin/pace-init.js" --help`

第一步存在且第二步能输出帮助，就说明不是“没安装”，而只是之前把它误当成了 PATH 命令。

后续更新时，直接重复执行同一条命令即可：

```bash
curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | bash
```

安装脚本会在替换 PACE 管理路径前，先把旧安装备份到：

- `~/.codex/backups/pace/<timestamp>/`

它只替换 PACE 管理的路径：

- `skills/`
- `bin/`
- `.pace/`
- `roles/`

当前安装脚本会按 manifest 维护这些路径下的 PACE 托管条目：

- 只删除“上一次安装由 PACE 创建、这一次源码里已不存在”的路径
- 未被 manifest 记录的未知自定义内容会保留
- 如果你的自定义条目与 PACE 托管路径同名，托管路径仍会覆盖它
- 首次升级到 manifest 模式时，会按旧安装约定接管 `bin/`、`.pace/`、`roles/` 中的 PACE 条目，并清理其中已不再存在的托管路径
- 如果托管路径发生目录/文件类型冲突且会覆盖未托管内容，安装会直接失败，而不是静默删除

如果你之前在这些路径下放过重要自定义内容，仍然建议先从备份目录里检查和迁移。

如果流程会产出 git 提交，还必须在配置里明确指定：

- `git.name`
- `git.email`

不要依赖机器上的默认全局 git 身份，尤其是在多 GitHub 账号场景下。

如果你希望限制误操作，推荐只通过 `pace-git` 操作仓库，而不要直接运行原生 `git`。`pace-git` 只开放少量安全子命令，并默认拒绝危险操作；如果 session 中配置了 GitHub 用户，它也只会在当前机器已完成 GitHub 登录的前提下切到对应用户。

脚本职责：

- `pace-init.js`：初始化 `.pace/session.yaml`
- `pace-workflow.js`：脚本化判定当前阶段与下一步 skill，并记录重复路由 runtime
- `pace-merge.js`：查看模板合并结果
- `pace-git.js`：受限 git 操作

以下脚本仍保留在仓库中，但仅作为历史兼容代码，不再属于当前推荐主路径：

- `pace-gh.js`
- `pace-issue-doc.js`
- `pace-multica.js`

## 快速开始

```bash
# local-only / workflow
node "$HOME/.codex/skills/pace/bin/pace-init.js" local
node "$HOME/.codex/skills/pace/bin/pace-workflow.js" route --json
/pace:workflow
/pace:bootstrap
/pace:status

# 受限 git 操作（推荐）
node "$HOME/.codex/skills/pace/bin/pace-git.js" status
node "$HOME/.codex/skills/pace/bin/pace-git.js" info
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
| `pace:recover` | 受控恢复 phase 状态，支持重开 archive、撤销验证结论或放弃当前 phase |
| `pace:status` | 查看当前状态和下一步 |
| `pace:roadmap` | 维护 phase 结构 |
| `pace:milestone` | 管理 milestone 生命周期 |

当前未纳入版本：

- `pace-pr.js`
- `pace-config` CLI

## 当前架构

PACE 当前推荐拆成两层：

- **Workflow 层**：`pace-workflow.js` 负责脚本化读状态、判阶段、决定下一步 skill；`pace:workflow` 只消费脚本结果
- **Skill 层**：`pace:bootstrap`、`pace:map-codebase`、`pace:intake`、`pace:discuss`、`pace:plan`、`pace:execute`、`pace:verify`、`pace:archive`、`pace:recover`

当前主路径不再依赖：

- 多角色 handoff
- Multica assignee
- GitHub issue / root issue / init-params issue / phase issue 作为工作流主真相源

如果你仍然需要一个基础 prompt，可使用 [`roles/流程经理.md`](roles/流程经理.md)，但它现在只是本地 workflow 的极薄兼容层，不再是多角色系统。

确定性边界：

- `tech` phase 不再靠角色链路；它仍然由 roadmap 中声明的 `Owner Skill` 处理，然后进入 `pace:verify` 与 `pace:archive`
- `.pace/session.yaml` 缺失时，必须先运行 `pace-init.js`
- `.pace/` 是当前本地工作区状态与缓存
- `pace-workflow.js` 是当前默认路由器；不要跳过它直接猜下一步 skill
- `pace:workflow` 应先读取 `pace-workflow.js route --json` 的结果，再决定是否调用下一 skill
- `continue_workflow / needs_user_input / closed / blocking_code` 是当前统一终态协议

## 配置

PACE 当前主要使用两类文件：

- 模板配置：`.pace/config.yaml`、`.pace/config.local.yaml`
- 会话配置：`.pace/session.yaml`

模板配置用于提供默认值，会话配置用于提供“本次运行的真实输入”，包括 issue、PR、分支、当前角色等上下文。

模板文件位于 `.pace/` 目录下，支持分层合并：

```
.pace/
├── config.yaml           # 基础配置（所有环境共享）
└── config.local.yaml     # 本地 Claude Code 覆盖
```

如果你只想检查模板合并结果，再使用：

```bash
node "$HOME/.codex/skills/pace/bin/pace-merge.js" local     # → .pace-config.yaml
node "$HOME/.codex/skills/pace/bin/pace-merge.js" multica   # → .pace-config.yaml
```

正常入口：

```bash
node "$HOME/.codex/skills/pace/bin/pace-init.js" local
node "$HOME/.codex/skills/pace/bin/pace-workflow.js" route --json
```

`pace-init` 会基于模板配置生成 `.pace/session.yaml`，并把当前 issue / PR / branch / role 一起写进去，作为本次运行的真相源。
`pace-workflow` 会读取 `.pace/` 真相源和当前 phase 产物，输出结构化路由结果，并默认写入 `.pace/runtime/workflow-state.json` 来阻止无新产物时的重复续跑。
当前主路径只定义本地模式：

- `tracker.type = local`
- `executor = claude-code`
- `roles.enabled = false`

推荐分支命名：

- `agent/local/<slug>`
如果参数填错，直接用正确参数重新执行一次 `pace-init` 即可覆盖 `.pace/session.yaml`。
`pace-merge` 只用于排查模板值，不是正常流程的必经步骤。

不要把下面三件事都叫“初始化”：

- `session re-init`：每轮都允许重跑 `pace-init.js`，只重建 `.pace/session.yaml`
- `first bootstrap`：第一次建立 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md` 与 `.pace/codebase/`
- `local cache rehydrate`：新 worktree 只有 `.pace/session.yaml` 时，把本地缓存重新补齐；这属于恢复，不等于首次初始化

统一初始化原则：

- 进入正式流程前的第一步应调用 `pace-init.js`
- `pace-init.js` 负责 CLI 层缺参校验
- 如果 `pace-init.js` 失败，必须立即停止，不能跳过到后续 skill
- 不要在 roles / skills / README 里再发明另一套与 `pace-init.js` 冲突的必填逻辑

受限 git 入口：

```bash
node "$HOME/.codex/skills/pace/bin/pace-git.js" status
node "$HOME/.codex/skills/pace/bin/pace-git.js" diff --staged README.md
node "$HOME/.codex/skills/pace/bin/pace-git.js" stage README.md bin/pace-git.js
node "$HOME/.codex/skills/pace/bin/pace-git.js" commit -m "docs: update workflow"
node "$HOME/.codex/skills/pace/bin/pace-git.js" push
```

`pace-git` 只开放白名单命令：

- `status`
- `diff`
- `stage`
- `unstage`
- `commit`
- `push`
- `branch`
- `log`
- `info`

不支持：

- `reset`
- `checkout`
- `switch`
- `rebase`
- `merge`
- `cherry-pick`
- `clean`
- `stash`
- 强制 push

遗留 GitHub / 外部编排脚本：

- `pace-gh.js`
- `pace-issue-doc.js`
- `pace-multica.js`

它们仍保留在仓库中，但不再属于当前推荐主路径。
如果你看到这些脚本，不要把它们当成现在的 workflow 定义来源。

配置字段：

本地模式示例：

```yaml
executor: claude-code

tracker:
  type: local
  github:
    repo: ""
    username: ""
    verified: false
    create_missing_issue: false
    sync_stage_comments: false

git:
  name: ""
  email: ""

roles:
  enabled: false
```

会话文件字段：

```yaml
config:
  executor: claude-code
  tracker:
    type: local
    github:
      repo: ""
      username: ""
      verified: false
  git:
    name: Your Name
    email: you@example.com

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
    branch: agent/local/your-work-branch
    base_branch: main
    head_sha: abcdef
  role:
    current: ""
    previous: ""
  session:
    mode: local
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
├── .pace/                    # 本地配置与工作区状态
│   ├── config.yaml
│   ├── config.local.yaml
│   └── config.multica.yaml   # 已归档，仅为旧工具链兼容保留
├── roles/                    # 兼容提示词与 workflow 输出模板
│   ├── 流程经理.md
│   └── templates/
├── bin/
│   ├── install-codex.sh      # 一条命令安装到 ~/.codex
│   ├── pace-init.js          # 初始化 .pace/session.yaml
│   ├── pace-workflow.js      # 脚本化 workflow 路由器
│   ├── pace-git.js           # 受限 git 操作
│   ├── pace-merge.js         # 配置合并脚本
│   ├── pace-gh.js            # 旧兼容 GitHub 脚本
│   ├── pace-issue-doc.js     # 旧兼容文档链脚本
│   └── pace-multica.js       # 旧兼容 multica 脚本
├── README.md
├── README.multica.md         # 已归档的 multica 模式说明
└── package.json
```

## 名称含义

PACE = **P**lan, **A**ct, **C**heck, **E**volve

对应核心循环：规划 → 执行 → 验证 → 归档迭代
- 如果当前 phase 是 `tech`，workflow 编排必须退出并改走 roadmap 中的 `Owner Skill`
