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

如果你要固定到某个 tag 或自定义归档地址，推荐这样执行：

```bash
curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | \
  PACE_INSTALL_REF_TYPE=tags PACE_INSTALL_REF=<tag> bash

curl -fsSL https://raw.githubusercontent.com/Ghost233/pace/main/bin/install-codex.sh | \
  PACE_INSTALL_ARCHIVE_URL=<tarball-url> bash
```

安装后，PACE 会被更新到用户目录，而不是项目目录：

- skills → `~/.codex/skills/pace/`
- scripts → `~/.codex/skills/pace/bin/pace-merge.js`、`~/.codex/skills/pace/bin/pace-init.js`、`~/.codex/skills/pace/bin/pace-git.js`、`~/.codex/skills/pace/bin/pace-gh.js`、`~/.codex/skills/pace/bin/pace-issue-doc.js`、`~/.codex/skills/pace/bin/pace-multica.js`

这些脚本直接用 `node` 调用，不再额外生成 PATH 命令入口。

常用调用方式：

```bash
node "$HOME/.codex/skills/pace/bin/pace-init.js" local
node "$HOME/.codex/skills/pace/bin/pace-init.js" multica \
  --repo <owner/repo> \
  --branch <branch> \
  --github-user <username> \
  --git-name "<git name>" \
  --git-email "<git email>" \
  --issue-url "<issue url>" \
  --issue-title "<issue title>" \
  --issue-type "<bug|feature|task>" \
  --current-role "<PACE-...>"
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

如果你之前在这些路径下塞过自定义文件，先从备份目录里检查和迁移，不要假设升级会保留它们。

如果你要使用 GitHub 相关流程，例如：

- 创建或更新 GitHub issue
- 写 GitHub issue comment
- 读取 GitHub issue 状态

则必须先在流程外安装并登录 GitHub CLI：

```bash
brew install gh
gh auth login
```

如果你直接使用原生 `gh`，所有 GitHub 命令都必须先切换到目标仓库配置里指定的用户：

```bash
gh auth switch -u <tracker.github.username>
```

如果当前机器没有 `gh`，或者 `gh` 当前/指定用户无权访问目标仓库，则 GitHub 流程不能继续，必须显式要求用户在流程外完成安装/登录或切换到正确账号。

如果你希望限制 GitHub 误操作，推荐只通过 `pace-gh` 访问 issue，而不要直接运行原生 `gh`。`pace-gh` 只开放受限的 issue 读取、issue 评论发送、附件下载等白名单操作，并且只会在当前机器已完成 GitHub 登录的前提下按 `.pace/session.yaml` 切换 GitHub 用户。

如果你希望限制 multica 平台误操作，推荐只通过 `pace-multica` 访问 multica issue，而不要直接运行原生 `multica issue ...`。`pace-multica` 只开放 issue 读取、评论、状态变更、指派与 handoff，并把 handoff 落成真实 reassignment，而不是只写 comment 文本。

如果流程会产出 git 提交，还必须在配置里明确指定：

- `git.name`
- `git.email`

不要依赖机器上的默认全局 git 身份，尤其是在多 GitHub 账号场景下。

如果你希望限制误操作，推荐只通过 `pace-git` 操作仓库，而不要直接运行原生 `git`。`pace-git` 只开放少量安全子命令，并默认拒绝危险操作；如果 session 中配置了 GitHub 用户，它也只会在当前机器已完成 GitHub 登录的前提下切到对应用户。

脚本职责：

- `pace-init.js`：初始化 `.pace/session.yaml`
- `pace-merge.js`：查看模板合并结果
- `pace-git.js`：受限 git 操作
- `pace-gh.js`：受限 GitHub issue 操作
- `pace-issue-doc.js`：维护主 issue、文档 root issue、子文档 issue 之间的索引、正文与审计 comment
- `pace-multica.js`：受限 multica issue 平台动作

## 快速开始

```bash
# 本地 / skills-only
node "$HOME/.codex/skills/pace/bin/pace-init.js" local
/pace:bootstrap
/pace:status

# multica + roles
multica repo checkout <repo-url>
# 再进入 checkout 后的仓库根目录
node "$HOME/.codex/skills/pace/bin/pace-init.js" multica \
  --repo <owner/repo> \
  --branch <branch> \
  --github-user <username> \
  --git-name "<git name>" \
  --git-email "<git email>" \
  --issue-url "<issue url>" \
  --issue-title "<issue title>" \
  --issue-type "<bug|feature|task>" \
  --current-role "<PACE-...>"
# 然后进入 PACE-初始化经理

# 受限 git 操作（推荐）
node "$HOME/.codex/skills/pace/bin/pace-git.js" status
node "$HOME/.codex/skills/pace/bin/pace-git.js" info

# 受限 GitHub 操作（推荐）
node "$HOME/.codex/skills/pace/bin/pace-gh.js" whoami
node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-read --issue 72
node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue 72
node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" resolve-init --issue 72
node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" check-body --body-file /tmp/doc.md
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

## 双层架构

PACE 现在推荐拆成两层：

- **Skills 层**：`pace:intake`、`pace:discuss`、`pace:plan`、`pace:execute`、`pace:verify` 等，负责把某一步真正做完。
- **Roles 层**：用于 `executor=multica` 且 `tracker.type=github` 的工作区前置准备与 requirement phase 管理，负责“什么时候调用哪个 skill”“阶段之间如何交接”“什么时候同步到 GitHub 主 issue、文档 root issue、初始化参数子 issue与文档 issue”。

推荐的最小角色集：

| Role | 作用 |
|------|------|
| `PACE-调度经理` | 当当前状态不明确时先做分诊和路由，决定交给哪个角色；仍不确定时退回用户 |
| `PACE-初始化经理` | 补齐 `.pace/` 工作区核心产物和代码地图，只负责 `bootstrap / map-codebase` 前置准备 |
| `PACE-需求接管经理` | 新 issue 首次接管；补齐 GitHub issue 链接；建立追踪上下文与 `tracking-init` |
| `PACE-阶段经理` | 管 `intake → discuss → plan` 的阶段推进和边界收敛 |
| `PACE-交付经理` | 管 `execute` 的分发、阻塞汇报和阶段交接 |
| `PACE-验收归档经理` | 管 requirement phase 的 `verify → archive` 验收、结案和收尾同步 |

角色定义和模板位于 [`roles/`](roles/)。

确定性边界：

- `tech` phase 不走 roles 链路；它只由 roadmap 中声明的 `Owner Skill` 执行，然后进入 `pace:verify` 与 `pace:archive`
- `tech` phase 必须在 roadmap 中声明 `Expected Outputs`，否则 `status / verify / archive` 无法确定它是否完成
- 若 `.pace/` 工作区核心产物缺失，必须先进入 `PACE-初始化经理`
- `PACE-需求接管经理` 负责 issue 首次接管与 `tracking-init`，不等于 `pace:intake`
- `pace:intake` 由 `PACE-阶段经理` 在 requirement 信息不完整时调用；若 requirement 字段已经齐备，可以直接进入 `pace:discuss`
- `requirement` phase 才进入 `PACE-需求接管经理 → PACE-阶段经理 → PACE-交付经理 → PACE-验收归档经理`
- `PACE-调度经理` 只在入口冲突、状态冲突或回退时使用，不是标准新 issue 的第一站

## Multica 追踪约束

当 `executor = multica` 且 `tracker.type = github` 时，以下规则是硬约束：

1. 每个新 issue 在进入 phase 流程前，必须有一个规范的 GitHub issue URL。
2. 如果用户没有提供 GitHub issue URL，则由 `PACE-需求接管经理` 创建，并回填到当前流程系统的 issue 元数据中。
3. 每次阶段切换至少同步一条 GitHub 主 issue comment：
   `tracking-init`、`intake`、`discuss`、`plan`、`execute`、`verify`、`archive`
4. 当 `tracker.type = github` 且 `executor = multica` 时，稳定阶段文档必须同步到 GitHub 文档层：
   - 主 issue comment：阶段结论、handoff、阻塞、归档状态，以及文档索引回填
   - 文档 root issue：当前 issue 对应的文档索引，例如 `issue-54-doc`
   - 初始化参数子 issue：后续角色复用的初始化参数，例如 `issue-54-init-params`
   - 文档 issue body：最新版正文，例如 `context.md`、计划文件、`execution-log.md`、`verification.md`
   - 文档审计 comment：记录某次 body 更新来自哪个文件、哪个角色、哪个修订
5. 在 `tracker.type = github` 模式下，跨轮次真相源不是 `.pace/`，而是：
   - 主 issue 的追踪块与阶段结论 comment
   - 文档 root issue、初始化参数子 issue、文档 issue 的最新版 body
   - 文档 root issue、初始化参数子 issue、文档 issue 的审计 comment
6. 文档正文默认限制在 `60000` 字符以内；超过限制时，必须新建下一个文档 issue，而不是继续把全文拆成多条 comment。
7. 如果使用 `pace-gh` / `pace-git`，它们只会在当前机器已完成 GitHub 登录的前提下按 `.pace/session.yaml` 切换 GitHub 用户；如果直接使用原生 `gh`，则必须先手工执行 `gh auth switch -u <tracker.github.username>`。如果没有 `gh`、未登录或该用户无权访问仓库，必须停止并明确要求用户在流程外介入。
8. 如果流程会产出提交，必须同时明确使用哪个 GitHub 用户、哪个 git `name`、哪个 git `email`，不能依赖本机默认身份。

完整的 multica 落地流程、角色创建方式、阶段切换和 GitHub 文档同步规则，见 [README.multica.md](README.multica.md)。

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

如果你只想检查模板合并结果，再使用：

```bash
node "$HOME/.codex/skills/pace/bin/pace-merge.js" local     # → .pace-config.yaml
node "$HOME/.codex/skills/pace/bin/pace-merge.js" multica   # → .pace-config.yaml
```

正常入口：

```bash
node "$HOME/.codex/skills/pace/bin/pace-init.js" local
node "$HOME/.codex/skills/pace/bin/pace-init.js" multica \
  --repo <owner/repo> \
  --branch <branch> \
  --github-user <username> \
  --git-name "<git name>" \
  --git-email "<git email>" \
  --issue-url "<issue url>" \
  --issue-title "<issue title>" \
  --issue-type "<bug|feature|task>" \
  --current-role "<PACE-...>"
```

`pace-init` 会基于模板配置生成 `.pace/session.yaml`，并把当前 issue / PR / branch / role 一起写进去，作为本次运行的真相源。
在 `multica` 模式下，GitHub 用户、执行仓库地址、执行分支、`git.name`、`git.email` 都必须先有显式来源。
首次接管时，这 5 个值只能来自当前轮用户手动输入；后续角色重入时，才允许来自已存在的初始化参数文档。
不能从 issue 正文、外部编排器参数、本地 `gh` / `git config` 推断、抄回或补齐成用户输入。
其中 `github_user` 用于绑定仓库 checkout / GitHub 访问所使用的指定账号，不是一个可省略的展示字段。
如果参数填错，直接用正确参数重新执行一次 `pace-init` 即可覆盖 `.pace/session.yaml`。
`pace-merge` 只用于排查模板值，不是正常流程的必经步骤。

统一初始化原则：

- 不管是 `local` 还是 `multica`，进入正式流程前的第一步都应调用 `pace-init.js`
- `pace-init.js` 负责 CLI 层缺参校验；对于 `multica` 的首次 issue 接管，角色协议还要求 `github_user / repo / branch / git.name / git.email` 先由用户手动输入
- 如果 `pace-init.js` 失败，必须立即停止，不能跳过到后续 skill / role
- 除首次 issue 接管必须要求的显式来源约束外，不要在 roles / skills / README 里再发明另一套与 `pace-init.js` 冲突的必填逻辑

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

受限 GitHub 入口：

```bash
node "$HOME/.codex/skills/pace/bin/pace-gh.js" whoami
node "$HOME/.codex/skills/pace/bin/pace-gh.js" repo-check
node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-read --issue 72 --comments
node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-comment --issue 72 --body "已完成 discuss 阶段"
node "$HOME/.codex/skills/pace/bin/pace-gh.js" attachment-download --issue 72 --url "https://github.com/user-attachments/files/xxx/file.png"
node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root --issue 72
node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" upsert-doc --issue 72 --doc-key context --title "issue-72-context" --body-file /tmp/doc.md
```

`pace-gh` 只开放白名单命令：

- `whoami`
- `repo-check`
- `issue-read`
- `issue-comment`
- `attachment-download`

`pace-issue-doc` 只处理文档层：

- `ensure-root`
- `upsert-doc`
- `check-body`
- `append-audit`

约束：

- 先为主 issue 创建或复用一个文档 root issue
- 初始化参数也应作为标准子文档 issue 保存
- 每个子文档 issue 创建或更新后，都要把链接和修订回填到文档 root issue
- 同时把文档 root issue 与子文档索引回填到主 issue comment
- 在 `multica + github` 下，不要直接用低层正文命令绕过 `ensure-root / upsert-doc`

不支持：

- 任意 gh 参数透传
- issue 删除 / 编辑 / reopen / close
- PR 操作
- release / workflow / repo 管理操作

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

multica 模式示例：

```yaml
executor: multica

tracker:
  type: github
  github:
    repo: "owner/repo"
    username: "github-user"
    verified: true
    create_missing_issue: true
    sync_stage_comments: true

git:
  name: "Your Name"
  email: "you@example.com"

roles:
  enabled: true
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
- 如果当前 phase 是 `tech`，roles 链必须退出并改走 roadmap 中的 `Owner Skill`
