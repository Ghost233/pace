# PACE for Multica

这个文档只回答一件事：

如何把 PACE 作为一套“角色 + skills”的流程系统，运行在 multica 上，并从创建 issue 一直推进到归档。

如果你要看项目本身的通用介绍、安装和基础配置，请先看 [README.md](README.md)。

## 适用场景

适用于以下形态：

- 仓库里已经接入了 PACE
- 你准备用 multica 来承载外部流程编排
- `skills` 负责执行动作
- `roles` 负责工作区前置准备、requirement phase 的阶段管理、handoff 和 GitHub 同步

## 核心原则

1. 必须先读取 `tracker.type`，再判断当前工作的真相源。
2. 当 `tracker.type = github` 时，跨轮次真相源分成两层：
   - 主 issue 的追踪块与阶段结论 comment
   - 文档 root issue、初始化参数文档 issue、各 phase 文档 issue 的最新版 body 与审计 comment
   `.pace/` 只是当前工作区的本地产物，不保证下轮还在。
3. `.pace/session.yaml` 只负责本轮会话；它可以每轮重建。`.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md` 与 `.pace/codebase/` 只是本地缓存，缺失不自动等于“还没初始化过”。
4. 当 `tracker.type = github` 且 `executor = multica` 时，稳定阶段文档必须进入 GitHub 文档层；不能只同步 handoff 摘要。
5. Multica issue 是流程入口和协作面。
6. GitHub 主 issue 是阶段状态时间线与总入口；GitHub 文档 root issue 负责索引；初始化参数文档 issue 负责恢复参数；各 phase 文档 issue 负责 phase 级正文持久层。
7. 文档之间只通过“主 issue 的受控索引 comment + 文档 root issue 的索引正文 / JSON + 文档 issue URL”关联；不依赖 GitHub 原生 `sub-issue / parent-issue` 功能。
8. 如果索引层发生冲突，优先级固定为：文档 root issue 的 JSON 索引 > 初始化参数文档 issue / 各 phase 文档 issue 正文 > 主 issue 的受控索引 comment。
9. 主 issue 的受控索引 comment 是首选入口，但不是唯一入口；如果它缺失、损坏或漂移，允许从文档 root issue 的 JSON 索引反查恢复，并自动补回该 comment。
10. 角色负责决定“下一步做什么”，skill 负责把这一步做完。
11. 只要要访问 GitHub，用户必须先在流程外完成 `gh` 安装与登录；如果使用 `pace-gh` / `pace-git`，它们只会在当前机器已完成登录的前提下，在已登录账号之间按 session 切换 GitHub 用户。
12. 如果流程会产出 git 提交，必须明确使用配置中的 `git.name` 和 `git.email`，不能依赖机器默认身份。
13. 如果流程会产出 git 操作，推荐只使用 `pace-git`，不要直接运行原生 `git`。
14. 如果流程会产出 GitHub issue 读取、评论或附件下载，推荐只使用 `pace-gh`，不要直接运行原生 `gh`。
15. 如果流程会产出 multica issue 读取、评论、状态变更或角色切换，推荐只使用 `pace-multica`，不要直接运行原生 `multica issue ...`
16. `tech` phase 不进入 roles 链路；它只能由 roadmap 中的 `Owner Skill` 处理，随后进入 `pace:verify` 和 `pace:archive`。
17. `tech` phase 必须在 roadmap 中声明 `Expected Outputs`，否则 `pace:status`、`pace:verify` 和 `pace:archive` 无法确定完成状态。

## 前置准备

### 0. 执行器前置阶段

在进入任何 PACE role 之前，执行器必须先完成：

1. 从 multica issue 或其关联描述中解析目标 GitHub issue URL
2. 从 GitHub issue URL 解析目标仓库
3. 执行 `multica repo checkout <repo-url>`，把目标仓库 checkout 到当前工作目录
4. 切换到目标仓库根目录
5. 切换到本轮目标分支；若当前主 issue 已有初始化参数文档 issue，则以其中声明的 `git.branch` 为准；若是首次进入，则以当前显式提供给 `pace-init.js` 的 `--branch` 为准

只有以上五步都完成后，才允许开始任何角色的“首步动作”。

硬规则：

- 如果当前 cwd 还是空目录，或还不是目标仓库根目录，不能进入 `PACE-初始化经理`、`PACE-需求接管经理` 或其他任何角色正文
- 如果当前仓库分支与初始化参数声明的目标分支不一致，不能进入任何角色正文；执行器应先切到目标分支，再重新进入当前角色
- 这类情况属于“执行器前置阶段未完成”，不是角色内失败
- 角色之间的 handoff 只发生在“已经进入目标仓库”之后

执行器在空目录里最多只能做：

- 读取 multica issue
- 解析 GitHub issue URL
- 执行 `multica repo checkout <repo-url>`

不能在空目录里提前做：

- `.pace/` 是否存在的判断
- `.pace/session.yaml` 是否缺失后的角色路由
- `PACE-初始化经理` / `PACE-需求接管经理` / `PACE-阶段经理` 的正式进入

推荐最小前置命令：

```bash
multica repo checkout <repo-url>
cd <checkout 后的仓库根目录>
```

进入角色后，平台侧推荐最小命令：

```bash
node "$HOME/.codex/skills/pace/bin/pace-multica.js" issue-get --issue <multica-issue-id>
node "$HOME/.codex/skills/pace/bin/pace-multica.js" comment-list --issue <multica-issue-id> --limit 50
```
### 1. 重建 multica 会话

在项目仓库根目录执行：

```bash
node "$HOME/.codex/skills/pace/bin/pace-init.js" multica \
  --repo <owner/repo> \
  --branch <branch> \
  --github-user <username> \
  --git-name "<git name>" \
  --git-email "<git email>" \
  --issue-url "<issue url>" \
  --issue-title "<issue title>" \
  --issue-type "<bug|feature|task>" \
  --current-role "PACE-需求接管经理"
```

这会生成 `.pace/session.yaml`，把本次 multica 运行所需的配置和上下文一次性写好。
其中执行仓库地址和执行分支都必须显式指定，不能只给 repo 不给 branch。
分支名还必须能反向追踪到 GitHub issue；统一使用 `agent/github/issue-<number>-<slug>`。
如果参数填错，直接用正确参数重新执行一次 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica` 即可覆盖 `.pace/session.yaml`。

如果当前 shell 里没有 `pace-init` 这个命令，不代表没安装；这里默认不再暴露 PATH 命令入口，直接检查脚本文件：

```bash
ls -l ~/.codex/skills/pace/bin/pace-init.js
node "$HOME/.codex/skills/pace/bin/pace-init.js" --help
```

只有当 `~/.codex/skills/pace/bin/pace-init.js` 本身不存在时，才说明还没安装。

如果你只想看底层模板合并结果，才使用：

```bash
node "$HOME/.codex/skills/pace/bin/pace-merge.js" multica
```

`pace-merge` 只用于排查模板合并结果，不是 multica 正常流程的必经步骤。

如果本轮会产出提交，推荐先确认：

```bash
node "$HOME/.codex/skills/pace/bin/pace-git.js" info
node "$HOME/.codex/skills/pace/bin/pace-git.js" status
node "$HOME/.codex/skills/pace/bin/pace-gh.js" repo-check
```

### 2. 首次初始化与本地缓存恢复

不要把下面三件事混成一次“初始化”：

- `session re-init`：每轮都允许执行，只负责重建 `.pace/session.yaml`
- `first bootstrap`：第一次在本地建立 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`
- `local cache rehydrate`：新 checkout / 新 worktree 只有 `.pace/session.yaml` 时，把本地缓存重新补齐

只有第一次接入项目或 GitHub 文档链尚未建立时，才是“首次初始化”。

```text
PACE-初始化经理 -> first bootstrap
PACE-初始化经理 -> pace:map-codebase（brownfield 时）
```

如果 GitHub 文档链和初始化参数文档已经存在，但当前 checkout 缺少 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`，这叫“本地缓存恢复”，不是再次初始化：

```text
PACE-初始化经理 -> local cache rehydrate
PACE-初始化经理 -> pace:bootstrap
PACE-初始化经理 -> pace:map-codebase（仅当当前角色确实需要代码地图）
```

### 3. 推荐配置

推荐使用以下配置：

```yaml
executor: multica

tracker:
  type: github
  github:
    create_missing_issue: true
    sync_stage_comments: true

git:
  name: "Your Name"
  email: "you@example.com"

roles:
  enabled: true
```

### 4. GitHub CLI 前置要求

如果当前流程要触发 GitHub 操作，用户必须先在流程外满足：

```bash
brew install gh
gh auth login
```

如果你直接使用原生 `gh`，则必须在每次 GitHub 命令前先切到配置中的目标用户：

```bash
gh auth switch -u <tracker.github.username>
```

如果出现以下任一情况，角色必须停止，并要求用户在流程外介入：

- 没有安装 `gh`
- `gh` 未登录
- 当前登录用户不是配置中的 `tracker.github.username`
- 指定用户无权访问 `tracker.github.repo`
- 没有配置 `git.name` / `git.email`，但流程需要产出提交

## 受限 Git 入口

推荐只通过 `pace-git` 执行仓库操作。

允许的命令：

- `node "$HOME/.codex/skills/pace/bin/pace-git.js" status`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" diff`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" stage`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" unstage`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" commit -m "..."`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" push`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" branch`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" log`
- `node "$HOME/.codex/skills/pace/bin/pace-git.js" info`

`pace-git` 会限制危险行为；在当前机器已完成 GitHub 登录时，它才可以按 session 切换用户：

- 不支持 `reset / checkout / switch / rebase / merge / cherry-pick / clean / stash`
- 不支持强制 push
- `commit` 必须显式带 `-m`
- `push` 固定推送到 `origin` 当前分支

## 受限 GitHub 入口

推荐只通过 `pace-gh` 执行 GitHub issue 相关操作。

允许的命令：

- `node "$HOME/.codex/skills/pace/bin/pace-gh.js" whoami`
- `node "$HOME/.codex/skills/pace/bin/pace-gh.js" repo-check`
- `node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-read`
- `node "$HOME/.codex/skills/pace/bin/pace-gh.js" issue-comment`
- `node "$HOME/.codex/skills/pace/bin/pace-gh.js" attachment-download`
- `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" ensure-root`
- `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" upsert-doc`
- `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" check-body`
- `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" append-audit`

`pace-gh` 会限制危险行为；在当前机器已完成 GitHub 登录时，它才可以切换到 session 中配置的 GitHub 用户：

- 不支持任意 gh 子命令透传
- 不支持 issue 删除 / 编辑 / close / reopen
- 不支持 PR 操作
- 不支持 release / workflow / repo 管理操作

## 受限 multica 平台入口

推荐只通过 `pace-multica` 执行 multica issue 相关操作。

允许的命令：

- `node "$HOME/.codex/skills/pace/bin/pace-multica.js" issue-get --issue <multica-issue-id>`
- `node "$HOME/.codex/skills/pace/bin/pace-multica.js" comment-list --issue <multica-issue-id> --limit 50`
- `node "$HOME/.codex/skills/pace/bin/pace-multica.js" comment-add --issue <multica-issue-id> --body-file /tmp/comment.md`
- `node "$HOME/.codex/skills/pace/bin/pace-multica.js" status --issue <multica-issue-id> --value blocked`
- `node "$HOME/.codex/skills/pace/bin/pace-multica.js" assign --issue <multica-issue-id> --to "PACE-初始化经理"`
- `node "$HOME/.codex/skills/pace/bin/pace-multica.js" handoff --issue <multica-issue-id> --to "PACE-初始化经理" --status blocked --body-file /tmp/final.md`

限制规则：

- 不支持任意 `multica issue` 参数透传
- 不允许只写 handoff comment 而不切 assignee
- `handoff` 的成功条件是：comment（可选）已发布、目标角色 assignee 已切换、必要状态已同步
- 如果 `pace-multica` 失败，不能直接 fallback 到原生 `multica issue ...`
- `pace-gh`、`pace-git`、`pace-multica` 任一失败时，都应先修正 wrapper 或输入，再重试；不要直接切回原生命令继续跑主流程

`pace-issue-doc` 负责 issue 文档层：

- 先为主 issue 创建或复用一个文档 root issue，例如 `issue-54-doc`
- 初始化参数也要作为一个标准文档 issue 保存，而不是只散落在 session 或 comment 中
- 初始化参数文档 issue 里必须包含执行仓库地址与执行分支
- 推荐收敛成 `2 + N`：主 issue + 文档 root issue + 初始化参数文档 issue + 每个 phase 一个文档 issue
- phase 内的 `tracking / context / plan / execution / verification / archive` 推荐合并到同一个 phase 文档 issue 的不同 section，而不是继续“一文一 issue”
- `pace-issue-doc upsert-doc --section <key>` 已支持按 section 更新 phase 文档 issue；其余 roles / skills 仍应继续向这版协议收敛
- 用文档 issue body 保存最新版文档
- 用 comment 追加审计记录
- 默认限制 body 小于 `60000` 字符
- 创建或更新文档后，会自动把文档 root issue 与文档索引回填到主 issue 的受控 comment
- 文档层恢复与定位只依赖主 issue 的受控索引 comment、文档 root issue 的索引正文 / JSON、初始化参数文档 issue 与各 phase 文档 issue URL；不要依赖 GitHub 原生 sub-issue 关系
- 若主 issue 的受控索引 comment 缺失、损坏或漂移，应允许从文档 root issue 的 JSON 索引反查恢复，并以该 JSON 为准重新回填主 issue 的受控索引 comment
- 在 `multica + github` 下，不要直接使用 `create-doc` / `update-body` 这种低层正文命令绕过索引回填
- 交接模板必须列出当前文档集合；若正文滚动到新文档 issue，也必须把滚动链写进模板字段
- 从这里开始，正式协议只有这一套：主 issue comment + 主 issue 受控索引 comment + 文档 root issue + 初始化参数文档 issue + phase 文档 issue body/comment；不要再把“全文镜像日志 comment”当成另一套并行协议

## 角色设计

在 multica 中，推荐创建 6 个固定角色 agent：

1. `PACE-调度经理`
2. `PACE-初始化经理`
3. `PACE-需求接管经理`
4. `PACE-阶段经理`
5. `PACE-交付经理`
6. `PACE-验收归档经理`

对应的角色定义：

- [`roles/调度经理.md`](roles/调度经理.md)
- [`roles/初始化经理.md`](roles/初始化经理.md)
- [`roles/需求接管经理.md`](roles/需求接管经理.md)
- [`roles/阶段经理.md`](roles/阶段经理.md)
- [`roles/交付经理.md`](roles/交付经理.md)
- [`roles/验收归档经理.md`](roles/验收归档经理.md)

推荐约定：

- 一个角色 agent 覆盖一个稳定阶段
- 不要把每个 skill 都单独做成一个 multica agent
- 角色 agent 只负责流程推进，不替代 `.pace/` 产物
- 每个角色在本轮开始前都必须确保 `.pace/session.yaml` 已由 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica` 初始化
- 这一步只是 `session re-init`，不是“重新初始化项目”
- 除 `PACE-需求接管经理` 的首次接管外，其余角色在本轮开始前都应先通过 `node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" resolve-init --issue <main-issue>` 读取主 issue 对应的初始化参数，再调用 `pace-init.js`
- `resolve-init` 默认直接输出一条可执行的 `pace-init.js multica ...` 命令；如需机器消费，可改用 `--format args` 或 `--format json`
- 对全新的主 issue，`PACE-需求接管经理` 允许先使用当前已知参数调用 `pace-init.js`，随后立即创建文档 root issue 与初始化参数文档 issue
- 首次进入时，“当前已知参数”只允许来自：multica issue / GitHub issue 中已经明确给出的初始化参数、外部编排器显式传入的参数、以及当前轮用户补充；禁止从本地 git/gh 状态猜测补齐
- 分支命名固定为 `agent/github/issue-<number>-<slug>`；第二级 `github` 用来区分运行模式，且分支名必须包含主 issue 编号，方便从分支名反向追踪到 GitHub issue
- 本地 `gh auth status`、`gh api user`、`git config` 只允许校验当前机器状态，不允许拿来补齐缺失的 `pace-init.js` 参数
- 若 `pace-init.js` 报缺参，必须按脚本列出的缺失清单一次性向用户索取，不要逐个试错
- 在 `pace-init.js` 成功前，禁止调用 `pace-gh`、禁止尝试读取 GitHub 文档链、禁止写 GitHub comment
- `pace-init.js` 成功后，如果当前唯一问题是本地 `.pace/` 缓存缺失，而 GitHub 文档链已足够确认当前目标、当前阶段与下一入口条件，这不算“未初始化”；应优先按 GitHub 真相继续路由，只有确实需要本地缓存时才进入 `PACE-初始化经理`
- 如果阻塞来自目标分支被其他 worktree 占用、无法切到目标分支，必须把它归类为 `branch/worktree conflict`，不要伪装成“缺少 `.pace/` 核心产物”
- 每个角色如果通过 `pace-gh` / `pace-git` 执行命令，只会在当前机器已完成 GitHub 登录的前提下按 session 切换 GitHub 用户；只有直接使用原生 `gh` 时，才需要手工执行 `gh auth switch -u <tracker.github.username>`
- 在 multica 角色模式下，`handoff: <角色>` 不只是评论里的语义文本；必须进一步通过 `pace-multica.js handoff --issue <multica-issue-id> --to <角色>` 落成真实 reassignment
- `pace-gh`、`pace-git`、`pace-multica` 任一失败时，都不能直接 fallback 到对应的原生命令；除非角色/skill 文档明确把该原生命令列为唯一允许例外
- `PACE-初始化经理` 只处理会话与工作区前置准备，不接管 requirement 内容
- 其余角色只处理 `Type = requirement` 的当前 phase；若当前 phase 是 `tech`，必须退出角色链并改走 `Owner Skill`

## 可执行工作流

PACE 在 multica 中可稳定构建的是下面这条 requirement 闭环：

1. `PACE-初始化经理`
   条件：首次初始化，或当前 checkout 确实需要本地缓存恢复 / 代码地图恢复
   产物：`.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`、必要时 `.pace/codebase/`
2. `PACE-需求接管经理`
   条件：issue 尚无追踪块或 GitHub issue URL
   产物：tracking block、tracking-init comment、归类结果、文档 root issue、初始化参数文档 issue、追踪相关文档 issue
3. `PACE-阶段经理`
   条件：requirement 信息已接管，但 `context.md` 或 checker 通过的 `plans/` 尚未齐备
   产物：`requirements.md`、`context.md`、`discussion-log.md`、`coverage.md`、`plans/`、主 issue 阶段 comment、对应 phase 文档 issue body / section 与审计 comment
4. `PACE-交付经理`
   条件：checker 通过的 `plans/` 已存在，且当前 phase 的 `execution` section 尚未完成
   产物：执行阶段摘要、`runs/`、执行覆盖摘要、execute comment、对应 phase 文档 issue body / section 与审计 comment
5. `PACE-验收归档经理`
   条件：当前 phase 为 `requirement`，且执行已完成，进入 verify/archive
   产物：验证结论、archive comment、归档结论、对应 phase 文档 issue body / section 与审计 comment

tech phase 的闭环单独处理：

1. `pace:status` 或 `pace:roadmap` 识别当前 phase `Type = tech`
2. 执行 roadmap 中声明的 `Owner Skill`
3. 进入 `pace:verify`
4. 验证通过后进入 `pace:archive`

## 标准流程

### 阶段 1：在 Multica 创建新 Issue

你先在 Multica 创建 issue。

这个 issue 可以来自：

- 新需求
- 现有功能扩展
- 缺陷修复
- 某个 phase 的阻塞升级

如果当前仓库还没有完成工作区初始化，第一位接手者必须是：

`PACE-初始化经理`

工作区已就绪后，标准新 issue 的第一位接手者必须是：

`PACE-需求接管经理`

只有以下情况才先交给：

`PACE-调度经理`

- 当前不是标准新 issue，而是流程中途回退
- 当前 issue 状态混乱，无法判断下一步
- 当前真相源互相冲突
- 用户只给了目标，没有给出当前阶段、已完成产物或阻塞位置

### 阶段 2：PACE-调度经理

这个角色只负责做一件事：

判断当前 issue 的唯一下一角色。

它必须分析以下内容：

- 当前 issue 是新需求、阶段变更、执行中阻塞，还是验收回退
- 当前 `.pace/session.yaml` 中的 config / context
- 当前 issue 描述是否足以判断目标、当前阶段、已完成产物、下一阶段入口条件
- 当前是否已经存在 phase / plans / execution / verification 产物

它的输出只能是两类：

1. `handoff: <某个明确角色>`
2. `needs_user_input: true`

如果它能判断清楚，就直接移交给：

- `PACE-初始化经理`
- `PACE-需求接管经理`
- `PACE-阶段经理`
- `PACE-交付经理`
- `PACE-验收归档经理`

如果分析后仍然不能唯一判断下一步，就必须明确指出缺什么信息并退回用户，不允许空白等待。

如果当前 phase 明确是 `tech`，调度经理必须停止 requirement 角色链，并要求改走 roadmap 中的 `Owner Skill`。

标准新 issue 不经过调度经理；调度经理只在入口不清晰时使用。调度完成后，若判断为标准新 issue，则交给：

`PACE-需求接管经理`

### 阶段 3：PACE-需求接管经理

这个角色负责第一次接管 issue。

它不等于 `pace:intake`。
它负责 issue 首次接管、`tracking-init`、追踪块与 GitHub 文档链起步；真正的 `pace:intake` 由 `PACE-阶段经理` 视 requirement 信息是否齐备来决定是否执行。

它必须完成：

1. 检查当前 issue 是否已有 GitHub issue URL。
2. 如果 `tracker.type = github` 且没有 URL，则创建 GitHub issue。
3. 把 GitHub issue URL 回填到当前 multica issue 的元数据或描述中。
4. 建立追踪块，必须直接使用：
   [`roles/templates/tracking-block.template.md`](roles/templates/tracking-block.template.md)
   至少包含：
   `GitHub Issue / Current Stage / Current Step / Current Role / Last Synced At`
5. 写第一条追踪初始化 comment 到 GitHub 主 issue。
6. 第一轮必须明确告诉用户：
   - 当前指定的 GitHub 用户：`tracker.github.username`
   - 当前指定的 git name：`git.name`
   - 当前指定的 git email：`git.email`
7. 判断这个 issue 是：
   - 新 requirement
   - 已有 phase 变更
   - bug
   - blocker
8. 给出 handoff。

如果 GitHub issue URL 缺失且还没补齐，流程不能继续往下走。
如果 `gh` 不存在、未登录、用户不匹配或无仓库权限，流程也不能继续往下走，必须由用户在流程外处理。
如果 `git.name` / `git.email` 缺失且后续会涉及提交，流程也不能继续往下走。

完成后，移交给：

`PACE-阶段经理`

### 阶段 4：PACE-阶段经理

这个角色负责：

```text
[按条件执行 pace:intake] -> pace:discuss -> pace:plan
```

默认顺序是：

1. requirement 字段不完整时，先执行 `pace:intake`
2. 再执行 `pace:discuss`
3. 最后执行 `pace:plan`

如果 requirement ID、目标、非目标、phase 归属、成功标准、外部依赖这 6 项已经齐备，则可以跳过 `pace:intake`，直接进入 `pace:discuss`。

它要完成的事情：

1. 把 issue 挂到 requirement / roadmap / 当前 phase。
2. 收敛灰区，形成 Locked Decisions。
3. 生成 executor 可以消费的 plan。
4. 在阶段边界向 GitHub 主 issue 写 comment：
   - intake comment
   - discuss comment
   - plan comment
5. 同步以下稳定文档到 GitHub 文档层：
   - intake：受影响的 requirement 条目、受影响的 roadmap phase 条目
   - discuss：`discussion-log.md`、`context.md`、`coverage.md`
   - plan：全部 plan 文件、更新后的 `coverage.md`
   - 规则：最新版正文写入文档 issue body，更新记录写成审计 comment

如果这一阶段仍存在未决项，不允许进入执行阶段。

只有当 plan 已经 ready for execute 时，才移交给：

`PACE-交付经理`

### 阶段 5：PACE-交付经理

这个角色负责：

```text
pace:execute
```

它关注的是执行推进，不负责重写需求边界。

主要职责：

1. 调度执行。
2. 跟踪 wave 级进展。
3. 识别 blocker / retry / rescope。
4. 在以下时机同步 GitHub 主 issue comment：
   - execute 开始
   - 每完成一个 plan task
   - 出现 blocker 或需要回退
   - execute 完成
5. 同步以下执行文档到 GitHub 文档层：
   - 当前 phase 文档 issue 的 `execution` section
   - 其中聚合 `execution-log`、`run summary` 与 execute 阶段 `coverage` 摘要
   - 规则：最新版正文写入 phase 文档 issue 的 `execution` section，更新记录写成审计 comment

comment 重点写：

- 完成了什么
- 当前卡点是什么
- 下一步去哪里

如果执行中发现 scope、约束、拒绝项或外部依赖变化，必须退回：

`PACE-阶段经理`

如果只是执行失败但范围没变，则继续留在本角色内处理。

执行完成后，移交给：

`PACE-验收归档经理`

### 阶段 6：PACE-验收归档经理

这个角色只处理 requirement phase 的：

```text
pace:verify -> pace:archive
```

它要输出两类明确结论：

1. `verify` 结论：
   - pass
   - partial
   - fail
2. `archive` 结论：
   - archived
   - reopen execute
   - reopen phase

如果需要执行 `reopen execute`、`reopen phase` 或显式放弃当前 phase，统一通过 `pace:recover` 落成，不要手写 state 回滚或直接删 archive 产物。

GitHub issue 上至少补两条最终 comment：

- `verify` comment
- `archive` comment

同时必须同步以下文档：

- 当前 phase 文档 issue 的 `verification` section
- `.pace/archive/index.md` 中当前 phase 对应条目
- 规则：最新版正文写入 phase 文档 issue 的 `verification` section，更新记录写成审计 comment

角色最终 comment 模板：

- 初始化经理：[`roles/templates/init-final-comment.template.md`](roles/templates/init-final-comment.template.md)
- 调度经理：[`roles/templates/dispatch-final-comment.template.md`](roles/templates/dispatch-final-comment.template.md)
- 需求接管经理：[`roles/templates/issue-intake-final-comment.template.md`](roles/templates/issue-intake-final-comment.template.md)
- 阶段经理：[`roles/templates/phase-final-comment.template.md`](roles/templates/phase-final-comment.template.md)
- 交付经理：[`roles/templates/delivery-final-comment.template.md`](roles/templates/delivery-final-comment.template.md)
- 验收归档经理 verify：[`roles/templates/closeout-verify-comment.template.md`](roles/templates/closeout-verify-comment.template.md)
- 验收归档经理 archive：[`roles/templates/closeout-archive-comment.template.md`](roles/templates/closeout-archive-comment.template.md)

如果验证失败：

- scope 不变 -> 退回 `PACE-交付经理`
- plan 本身失真 -> 退回 `PACE-阶段经理`

## 标准流转图

```text
Multica 新建标准 issue
  -> PACE-初始化经理（仅当工作区未就绪）
  -> PACE-需求接管经理
  -> PACE-阶段经理
  -> PACE-交付经理
  -> PACE-验收归档经理
  -> archived
```

## 常见回退路径

- 当前不知道该交给谁：先交给 `PACE-调度经理`
- 缺 GitHub issue URL：停在 `PACE-需求接管经理`
- 范围不清或需求变化：`PACE-交付经理 -> PACE-阶段经理`
- 验收失败但 scope 不变：`PACE-验收归档经理 -> PACE-交付经理`
- 验收失败且 plan 失真：`PACE-验收归档经理 -> PACE-阶段经理`
- 已归档 phase 需要重开：使用 `pace:recover`
- 用户长时间未回复或当前 session 中断：保持当前角色为 `resume_role`，恢复后先从 GitHub 文档链恢复，再继续当前角色或 skill；不要空白等待，也不要擅自 `closed`

## GitHub 同步要求

下面这些主 issue comment 是硬要求：

1. `tracking-init`
2. `intake`
3. `discuss`
4. `plan`
5. `execute`
6. `verify`
7. `archive`

下面这些稳定文档也必须进入 GitHub 文档层：

1. `init-params`
2. 当前 phase 文档 issue中的 `tracking-summary`
3. 当前 phase 文档 issue中的 `requirement-summary`
4. 当前 phase 文档 issue中的 `context`
5. 当前 phase 文档 issue中的 `discussion-log`
6. 当前 phase 文档 issue中的 `plan`
7. 当前 phase 文档 issue中的 `execution`
8. 当前 phase 文档 issue中的 `verification`
9. 当前 phase 文档 issue中的 `archive-status`

中间阶段 comment 与审计信息可以用：

- [`roles/templates/github-issue-comment.template.md`](roles/templates/github-issue-comment.template.md)
- [`roles/templates/stage-log-sync-comment.template.md`](roles/templates/stage-log-sync-comment.template.md)

最终 handoff / closeout comment 不要复用通用模板，必须使用上面的按角色模板。
文档审计 comment 也不要混进最终 handoff comment，必须单独发。

## 会话真相源

multica 模式下，本轮执行先读：

1. `.pace/session.yaml`
2. GitHub 主 issue 的追踪块与阶段结论 comment
3. GitHub 文档 root issue、初始化参数文档 issue与 phase 文档 issue 的最新版 body 与审计 comment
4. `.pace/` 阶段产物

唯一判定规则：

- `.pace/session.yaml` 只负责本轮 config + context
- `session re-init` 可以每轮发生，不表示项目又被“初始化了一次”
- 主 issue comment 只负责阶段状态、handoff、closeout
- 文档 root issue 只负责索引
- 初始化参数文档 issue 只负责后续角色复用的初始化参数
- phase 文档 issue body 只负责该 phase 的最新版稳定正文
- 文档 issue comment 只负责正文更新审计
- `.pace/` 只负责本轮工作区缓存副本
- 本地 `.pace/` 缓存缺失只表示“当前 checkout 没恢复出来”，不自动等于“流程未初始化”
- 任何跨轮次冲突都按这条优先级处理：
  - 阶段状态 / handoff / closeout：主 issue comment 优先
  - 正文内容：文档 issue body 优先
  - 本地 `.pace/` 永远不能覆盖 GitHub 文档层

如果 `.pace/session.yaml` 缺失，roles 必须停止并要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica`。

## 文档同步规则

当某个稳定阶段文档被创建或更新后，必须同步到 GitHub 文档层。

同步规则：

1. 最新版正文写入对应 phase 文档 issue 的 body，优先通过 `pace-issue-doc upsert-doc`
2. 每次正文更新后，必须追加一条审计 comment
3. 审计 comment 必须使用 [`roles/templates/stage-log-sync-comment.template.md`](roles/templates/stage-log-sync-comment.template.md)
4. 审计 comment 只记录来源文件、文档类型、修订号、变更摘要，不再承担全文镜像
5. 单个 phase 文档 issue 的 body 默认限制 `60000` 字符
6. 超过限制时，必须创建新的 phase 文档 issue，更新主 issue 或交接 comment 中的索引
7. 最终 handoff comment 只能引用这些文档 issue / 审计 comment，不能替代正文
8. 上面这组规则就是唯一正式协议；主 issue comment、主 issue 受控索引 comment、文档 root issue、初始化参数文档 issue与 phase 文档 issue body/comment 之外，不再定义第二套并行持久化协议

## 一条完整示例

```text
1. 你在 Multica 创建 issue: "支持批量导出订单 CSV"
2. 如果当前 issue 是第一次进入 PACE，或当前角色确实需要本地缓存恢复，才交给 PACE-初始化经理
3. 工作区就绪后，分配给 PACE-需求接管经理
4. 它发现没有 GitHub issue URL，于是创建 GitHub issue 并回填链接
5. 它写追踪初始化 comment，确保存在文档 root issue 与初始化参数文档 issue，并创建或更新追踪相关文档 issue，然后 handoff 给 PACE-阶段经理
6. PACE-阶段经理 先判断 requirement 字段是否齐备；若不齐再跑 pace:intake，然后继续 pace:discuss / pace:plan
7. plan ready 后，handoff 给 PACE-交付经理
8. PACE-交付经理 跑 pace:execute，并持续写执行进展 comment，同时更新当前 phase 文档 issue
9. 执行完成后，handoff 给 PACE-验收归档经理
10. PACE-验收归档经理 跑 pace:verify / pace:archive
11. GitHub 主 issue 留下最终验收与归档 comment，相关 phase 文档 issue 留下最新版正文与审计记录，流程结束
```

## 日常使用规则

1. 人只负责创建 issue、补充业务目标、查看进度时间线。
2. 第一次初始化或确实需要本地缓存恢复时第一位角色才是 `PACE-初始化经理`；标准新 issue 在工作区已就绪后，第一位角色是 `PACE-需求接管经理`；只有入口不明确时才先交给 `PACE-调度经理`。
3. 不要跳过 GitHub issue URL、主 issue 阶段 comment 和文档 issue 正文同步。
4. 不要只靠 `.pace/` 本地缓存判断跨轮次状态；若与 GitHub 冲突，以 GitHub 为准。
5. 卡住时先看 `pace:status` 和当前角色是否必须 handoff，而不是直接改角色职责。
