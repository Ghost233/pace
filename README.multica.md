# PACE for Multica

这个文档只回答一件事：

如何把 PACE 作为一套“角色 + skills”的流程系统，运行在 multica 上，并从创建 issue 一直推进到归档。

如果你要看项目本身的通用介绍、安装和基础配置，请先看 [README.md](README.md)。

## 适用场景

适用于以下形态：

- 仓库里已经接入了 PACE
- 你准备用 multica 来承载外部流程编排
- `skills` 负责执行动作
- `roles` 负责 requirement phase 的阶段管理、handoff 和 GitHub 同步

## 核心原则

1. 必须先读取 `tracker.type`，再判断当前工作的真相源。
2. 当 `tracker.type = github` 时，GitHub issue 的追踪块与阶段 comment 是跨轮次唯一真相源；`.pace/` 只是当前工作区的本地产物，不保证下轮还在。
3. 当 `tracker.type = github` 且 `executor = multica` 时，阶段日志必须镜像到 GitHub issue；不能只同步 handoff 摘要。
3. Multica issue 是流程入口和协作面。
4. GitHub issue 是外部追踪时间线。
5. 角色负责决定“下一步做什么”，skill 负责把这一步做完。
6. 只要要访问 GitHub，就必须先安装 `gh` 并确认已登录；如果使用 `pace-gh` / `pace-git`，它们会在执行前自动按 session 切换到配置中的 GitHub 用户。
7. 如果流程会产出 git 提交，必须明确使用配置中的 `git.name` 和 `git.email`，不能依赖机器默认身份。
8. 如果流程会产出 git 操作，推荐只使用 `pace-git`，不要直接运行原生 `git`。
9. 如果流程会产出 GitHub issue 读取、评论或附件下载，推荐只使用 `pace-gh`，不要直接运行原生 `gh`。
10. `tech` phase 不进入 roles 链路；它只能由 roadmap 中的 `Owner Skill` 处理，随后进入 `pace:verify` 和 `pace:archive`。
11. `tech` phase 必须在 roadmap 中声明 `Expected Outputs`，否则 `pace:status`、`pace:verify` 和 `pace:archive` 无法确定完成状态。

## 前置准备

### 1. 初始化 multica 会话

在项目仓库根目录执行：

```bash
node "$HOME/.codex/skills/pace/bin/pace-init.js" multica \
  --repo <owner/repo> \
  --github-user <username> \
  --git-name "<git name>" \
  --git-email "<git email>" \
  --issue-url "<issue url>" \
  --issue-title "<issue title>" \
  --issue-type "<bug|feature|task>" \
  --current-role "PACE-需求接管经理"
```

这会生成 `.pace/session.yaml`，把本次 multica 运行所需的配置和上下文一次性写好。
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

### 2. 初始化 PACE 工作区

第一次接入项目时，至少需要完成：

```text
/pace:config
/pace:bootstrap
```

如果项目不是 greenfield，而是已有代码的仓库，再补一次：

```text
/pace:map-codebase
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

如果当前流程要触发 GitHub 操作，机器上必须满足：

```bash
brew install gh
gh auth login
```

如果你直接使用原生 `gh`，则必须在每次 GitHub 命令前先切到配置中的目标用户：

```bash
gh auth switch -u <tracker.github.username>
```

如果出现以下任一情况，角色必须停止并明确要求用户介入：

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

`pace-git` 会限制危险行为，并在 session 中配置了 GitHub 用户时自动切换用户：

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

`pace-gh` 会限制危险行为，并在执行前自动切换到 session 中配置的 GitHub 用户：

- 不支持任意 gh 子命令透传
- 不支持 issue 删除 / 编辑 / close / reopen
- 不支持 PR 操作
- 不支持 release / workflow / repo 管理操作

## 角色设计

在 multica 中，推荐创建 5 个固定角色 agent：

1. `PACE-调度经理`
1. `PACE-需求接管经理`
2. `PACE-阶段经理`
3. `PACE-交付经理`
4. `PACE-验收归档经理`

对应的角色定义：

- [`roles/调度经理.md`](roles/调度经理.md)
- [`roles/需求接管经理.md`](roles/需求接管经理.md)
- [`roles/阶段经理.md`](roles/阶段经理.md)
- [`roles/交付经理.md`](roles/交付经理.md)
- [`roles/验收归档经理.md`](roles/验收归档经理.md)

推荐约定：

- 一个角色 agent 覆盖一个稳定阶段
- 不要把每个 skill 都单独做成一个 multica agent
- 角色 agent 只负责流程推进，不替代 `.pace/` 产物
- 每个角色在本轮开始前都必须确保 `.pace/session.yaml` 已由 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica` 初始化
- 每个角色如果通过 `pace-gh` / `pace-git` 执行命令，会自动按 session 切换 GitHub 用户；只有直接使用原生 `gh` 时，才需要手工执行 `gh auth switch -u <tracker.github.username>`
- 每个角色只处理 `Type = requirement` 的当前 phase；若当前 phase 是 `tech`，必须退出角色链并改走 `Owner Skill`

## 可执行工作流

PACE 在 multica 中可稳定构建的是下面这条 requirement 闭环：

1. `PACE-需求接管经理`
   条件：issue 尚无追踪块或 GitHub issue URL
   产物：tracking block、tracking-init comment、归类结果、追踪块日志镜像
2. `PACE-阶段经理`
   条件：requirement 信息已接管，但 `context.md` 或 checker 通过的 `plans/` 尚未齐备
   产物：`requirements.md`、`context.md`、`discussion-log.md`、`coverage.md`、`plans/`、阶段 comment、阶段日志镜像
3. `PACE-交付经理`
   条件：checker 通过的 `plans/` 已存在，且 `execution-log.md` 尚未完成
   产物：`execution-log.md`、`runs/`、`coverage.md`、execute comment、执行日志镜像
4. `PACE-验收归档经理`
   条件：执行已完成，进入 verify/archive
   产物：`verification.md`、archive comment、归档结论、验证/归档日志镜像

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

标准新 issue 的第一位接手者必须是：

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

- `PACE-需求接管经理`
- `PACE-阶段经理`
- `PACE-交付经理`
- `PACE-验收归档经理`

如果分析后仍然不能唯一判断下一步，就必须明确指出缺什么信息并退回用户，不允许空白等待。

标准新 issue 不经过调度经理；调度经理只在入口不清晰时使用。调度完成后，若判断为标准新 issue，则交给：

`PACE-需求接管经理`

### 阶段 3：PACE-需求接管经理

这个角色负责第一次接管 issue。

它必须完成：

1. 检查当前 issue 是否已有 GitHub issue URL。
2. 如果 `tracker.type = github` 且没有 URL，则创建 GitHub issue。
3. 把 GitHub issue URL 回填到当前 multica issue 的元数据或描述中。
4. 建立追踪块，至少包含：
   `GitHub Issue / Current Stage / Current Role / Last Synced At`
5. 写第一条追踪初始化 comment 到 GitHub issue。
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
如果 `gh` 不存在、未登录、用户不匹配或无仓库权限，流程也不能继续往下走。
如果 `git.name` / `git.email` 缺失且后续会涉及提交，流程也不能继续往下走。

完成后，移交给：

`PACE-阶段经理`

### 阶段 4：PACE-阶段经理

这个角色负责：

```text
pace:intake -> pace:discuss -> pace:plan
```

执行顺序固定为：

1. `pace:intake`
2. `pace:discuss`
3. `pace:plan`

它要完成的事情：

1. 把 issue 挂到 requirement / roadmap / 当前 phase。
2. 收敛灰区，形成 Locked Decisions。
3. 生成 executor 可以消费的 plan。
4. 在阶段边界向 GitHub issue 写 comment：
   - intake comment
   - discuss comment
   - plan comment
5. 同步以下阶段日志到 GitHub issue：
   - intake：受影响的 requirement 条目、受影响的 roadmap phase 条目
   - discuss：`discussion-log.md`、`context.md`、`coverage.md`
   - plan：全部 plan 文件、更新后的 `coverage.md`

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
4. 在以下时机同步 GitHub comment：
   - execute 开始
   - 每完成一个 plan task
   - 出现 blocker 或需要回退
   - execute 完成
5. 同步以下执行日志到 GitHub issue：
   - `execution-log.md`
   - 每个 `run summary`
   - execute 阶段更新后的 `coverage.md`

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

这个角色负责：

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

GitHub issue 上至少补两条最终 comment：

- `verify` comment
- `archive` comment

同时必须同步以下日志：

- `verification.md`
- `.pace/archive/index.md` 中当前 phase 对应条目

角色最终 comment 模板：

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

## GitHub 同步要求

下面这些 comment 是硬要求：

1. `intake`
2. `discuss`
3. `plan`
4. `execute`
5. `verify`
6. `archive`

下面这些阶段日志镜像也是硬要求：

1. `tracking block`
2. intake 影响到的 `requirements.md` / `roadmap.md` 条目
3. `discussion-log.md`
4. `context.md`
5. `coverage.md`
6. 全部 plan 文件
7. `execution-log.md`
8. 全部 `run summary`
9. `verification.md`
10. 当前 phase 的 archive 条目

中间阶段 comment 与 tracking block 可以用：

- [`roles/templates/github-issue-comment.template.md`](roles/templates/github-issue-comment.template.md)
- [`roles/templates/tracking-block.template.md`](roles/templates/tracking-block.template.md)
- [`roles/templates/stage-log-sync-comment.template.md`](roles/templates/stage-log-sync-comment.template.md)

最终 handoff / closeout comment 不要复用通用模板，必须使用上面的按角色模板。
阶段日志镜像 comment 也不要混进最终 handoff comment，必须单独发。

## 会话真相源

multica 模式下，本轮执行先读：

1. `.pace/session.yaml`
2. GitHub issue 时间线
3. `.pace/` 阶段产物

其中：

- `.pace/session.yaml` 负责提供本轮 config + context
- GitHub issue 负责保存跨轮次 comment 和日志镜像
- `.pace/` 负责保存本轮工作区产物

如果 `.pace/session.yaml` 缺失，roles 必须停止并要求先运行 `node "$HOME/.codex/skills/pace/bin/pace-init.js" multica`。

## 阶段日志同步规则

当某个阶段日志文件被创建或更新后，必须在当前 issue 里追加对应日志 comment。

同步规则：

1. 日志 comment 必须使用 [`roles/templates/stage-log-sync-comment.template.md`](roles/templates/stage-log-sync-comment.template.md)
2. 同步模式固定为“全文镜像”，不能只写摘要
3. 单条 comment 最多 6000 个字符
4. 超过 6000 个字符时，必须拆成多条连续 comment，标题写成 `第 x/n 段`
5. 分段必须保持原文顺序，不能重排内容
6. 每条日志 comment 都必须写明源文件路径
7. 最终 handoff comment 只能引用这些日志 comment，不能替代这些日志 comment

## 一条完整示例

```text
1. 你在 Multica 创建 issue: "支持批量导出订单 CSV"
2. 分配给 PACE-需求接管经理
3. 它发现没有 GitHub issue URL，于是创建 GitHub issue 并回填链接
4. 它写追踪初始化 comment，然后 handoff 给 PACE-阶段经理
5. PACE-阶段经理 依次跑 pace:intake / pace:discuss / pace:plan
6. plan ready 后，handoff 给 PACE-交付经理
7. PACE-交付经理 跑 pace:execute，并持续写执行进展 comment
8. 执行完成后，handoff 给 PACE-验收归档经理
9. PACE-验收归档经理 跑 pace:verify / pace:archive
10. GitHub issue 留下最终验收与归档 comment，流程结束
```

## 日常使用规则

1. 人只负责创建 issue、补充业务目标、查看进度时间线。
2. 标准新 issue 的第一位角色永远是 `PACE-需求接管经理`；只有入口不明确时才先交给 `PACE-调度经理`。
3. 不要跳过 GitHub issue URL 和阶段 comment。
4. 不要靠 comment 反推内部状态，内部状态以 `.pace/` 为准。
5. 卡住时先看 `pace:status` 和当前角色是否必须 handoff，而不是直接改角色职责。
