# PACE 修订版修复计划

更新时间：2026-04-22

## 1. 背景

这份修订版计划基于三部分证据收敛：

- 当前仓库实查：`README.md`、`README.multica.md`、`roles/*.md`、`bin/*.js`、`.claude-plugin/skills/*`
- 上一版 `REPAIR-PLAN.md` 的主审结果
- 三个子代理分别对 `workflow/roles`、`scripts/wrappers`、`skills/templates/tests` 的并行审查

结论很明确：原计划方向大体正确，但有三类问题必须先修正。

1. 有些改动会改坏当前已经成立的合同，尤其是把 `tech phase` 重新接回 roles 链。
2. 有些波次打包过大，把“真实断点修复”“协议扩展”“格式统一优化”混在了一起。
3. 测试和最小回归保护放得太后，无法安全支撑前几波 wrapper 和 workflow 改动。

## 2. 修订原则

- 保持 `skills` 负责执行、`roles` 负责编排，不把两层重新揉成一个系统。
- 保持 `tech phase` 继续在 roles 链外运行；修的是合同漂移，不是重做架构。
- 先修真实断点，再做协议扩展和低优先级整形。
- 先做低风险 wrapper parity，再单独评审任何会改 session/state 协议的改动。
- 最小测试 harness 前移；完整 CI 与安装链 hardening 放后。

## 3. 锁定决策

### D-01 `tech phase` 继续在 roles 链外闭环

`tech phase` 不新增角色，也不重新接入 `PACE-调度经理 -> ... -> PACE-验收归档经理` 这条 requirement 角色链。

唯一允许的闭环仍然是：

1. `pace:status` 或 `pace:roadmap` 识别当前 phase `Type = tech`
2. 执行 roadmap 中声明的 `Owner Skill`
3. 进入 `pace:verify`
4. 验证通过后进入 `pace:archive`

`PACE-调度经理` 只负责在入口冲突或状态不明时明确指出“当前应改走 Owner Skill”，不接管 `tech phase` 的执行或 closeout。

### D-02 workflow 改动必须覆盖六角色和执行器合同

如果某一波修改了 roles 间的 handoff、初始化缺口、或跨轮次真相源判断，就必须把以下合同一起看齐：

- `PACE-初始化经理`
- `PACE-调度经理`
- `PACE-需求接管经理`
- `PACE-阶段经理`
- `PACE-交付经理`
- `PACE-验收归档经理`
- `README.multica.md` 中的执行器前置阶段

不允许只改其中几份角色文档，留下半旧半新的 handoff 规则。

### D-03 wrapper 改动拆成 parity 层和协议层

wrapper 改动分两类：

- parity 层：不改变 session/state 协议，只补现有缺失能力
- 协议层：会引入新的 session 字段、state 字段、branch 语义或恢复语义

本轮先做 parity 层；协议层必须单独成波次。

### D-04 最小测试前移

从第一波开始就补最小测试 harness，至少覆盖：

- exec/timeout/error helper
- issue ref 解析
- `pace-init` 的 probe/must-run 分离逻辑
- `pace-issue-doc` 的 section body 渲染
- 各 wrapper 的 `--help` smoke

完整 CI、更多 unit tests 和安装链 release gate 放后。

### D-05 `pace:recover` 在 archive/state 元数据稳定后再做

`pace:recover` 的方向成立，但它不是模板整理项，也不是第一波功能。

顺序必须是：

1. 先把 archive/state 的可恢复元数据定义清楚
2. 再做最小 `pace:recover`
3. 再考虑 role 层超时/无响应与 `resume_role` 协议

### D-06 `codebase map stale` 是状态协议扩展，不是模板补齐

`codebase_map_status = stale` 这个方向可以保留，但它不属于“给几个 skill 补模板”。

只有在 state/archive/schema 已经稳定时，才评估是否引入。若 schema 代价过高，本轮可以不做。

### D-07 安装链 hardening 继续放后，但作为 release gate 处理

`install-codex.sh` 的版本锁定、备份、非破坏升级仍放后处理；但在真正对外发布前，它必须被视为 release gate，而不是可无限延期的收尾项。

## 4. 修订后的分波次计划

### Wave A：安全基线 + 最小回归保护

优先级：P0

目标：先把“会卡死、会吞错、会误判成功”的底层问题补掉，并建立最小测试护栏。

范围：

- 统一外部命令执行封装
- wrapper 超时和二进制检查
- `pace-init.js` 从“单一 run()”拆成“探测 vs 强校验”
- 最小测试 harness

涉及文件：

- `bin/pace-init.js`
- `bin/pace-git.js`
- `bin/pace-gh.js`
- `bin/pace-multica.js`
- `bin/pace-issue-doc.js`
- `bin/lib/github-cli.js`
- 新增 `bin/lib/exec.js`
- `package.json`
- 新增 `tests/`

明确动作：

- 新增统一执行层，例如：
  - `run()`
  - `runJson()`
  - `ensureBinary()`
  - timeout 错误包装
- 所有 `git`、`gh`、`multica`、`curl` 路径统一走该封装
- `pace-multica.js` 在执行任何命令前先检查 `multica` 二进制是否存在
- `pace-init.js` 把当前 `run()` 拆成两类：
  - `probe()`：允许失败后返回空结果，用于 branch/base/git config 探测
  - `mustRun()`：失败时保留真实错误并向上抛出
- 新增最小测试：
  - exec helper timeout/error
  - issue ref 解析
  - phase section body 渲染
  - wrapper `--help` smoke

验收标准：

- 任一 wrapper 卡住时都能在预期时间内失败退出
- `pace-init.js` 不再把强校验失败静默吞成空字符串
- `multica` 未安装时返回清晰错误
- 仓库已具备可执行的最小测试入口

### Wave B：workflow 合同收敛

优先级：P0

目标：修真正冲突的 workflow/role 合同，不重做现有架构。

范围：

- `tech phase` 路由一致性
- 六角色 handoff 合同
- `tracking-block.template.md` 的显式绑定
- `需求接管经理` 与 `pace:intake` 的边界澄清
- 已有 `2 + N + section` 协议的默认化收口

涉及文件：

- `README.md`
- `README.multica.md`
- `multica-github-issue.md`
- `roles/初始化经理.md`
- `roles/调度经理.md`
- `roles/需求接管经理.md`
- `roles/阶段经理.md`
- `roles/交付经理.md`
- `roles/验收归档经理.md`
- `roles/templates/tracking-block.template.md`

明确动作：

- 明确 `tech phase` 继续走：
  - `status/roadmap -> Owner Skill -> pace:verify -> pace:archive`
- 删除或修正文档里任何会把 `tech phase` 接回 roles 链的说法
- 保持 `PACE-调度经理` 对 `tech` 的行为是：
  - 识别
  - 报告
  - 路由到 `Owner Skill`
  - 不接管 closeout
- 对六个角色统一校准：
  - 核心产物缺失时何时回交 `PACE-初始化经理`
  - 何时 `handoff`
  - 何时 `needs_user_input`
  - 何时 `closed`
- 保留 `需求接管经理` 当前实际职责，不缩成 tracking-only：
  - GitHub issue URL
  - tracking block
  - 归类
  - `No-Goal`
  - 文档 root issue
  - init-params issue
  - 首轮身份披露
- 仅澄清 `需求接管经理 != pace:intake`，不削弱前者的现有责任面
- 把 `tracking-block.template.md` 绑定到明确输出，不再只是“模板存在”
- 把 `phase-<NN> + --section` 写成默认协议，但描述为“收敛现状”，不再表述成“从零建立”
- `README.multica.md` 中的执行器前置阶段保留为正式协议；本波只修漂移，不再把它描述成“无人负责”

验收标准：

- `README`、`README.multica`、六角色文档对 `tech phase` 给出同一条路由
- 所有角色文档对结束态的定义一致
- `需求接管经理` 与 `pace:intake` 的边界清楚，但没有职责空洞
- `tracking-block` 模板有明确落点

### Wave C：低风险 wrapper parity

优先级：P1

目标：补齐不涉及 session/schema 变化的 wrapper 能力。

范围：

- `pace-gh` 长 comment 与 issue 发现能力
- `pace-issue-doc` comments 分页
- 重复 helper 抽共用库
- 只做不会改变 branch/session 不变量的 git wrapper 补强

涉及文件：

- `bin/pace-gh.js`
- `bin/pace-issue-doc.js`
- `bin/pace-git.js`
- `bin/lib/github-cli.js`
- 新增共享库，例如：
  - `bin/lib/issue-ref.js`
  - `bin/lib/session-context.js`

明确动作：

- 抽出重复逻辑：
  - `parseIssueRef`
  - repo/session 一致性检查
  - JSON 命令执行 helper
- `pace-gh.js` 为 `issue-comment` 增加 `--body-file`
- `pace-gh.js` 增加：
  - `issue-list`
  - `issue-search`
- `pace-issue-doc.js` 的 `fetchIssueComments` 改为分页读取
- `pace-git.js` 仅评估并补低风险同步能力：
  - `fetch`
  - 如无 branch/session 语义冲突，再考虑仅针对当前 session branch 的 `pull --ff-only`
- 本波明确不做：
  - `checkout`
  - `switch`
  - `pace-multica` 绑定 session issue id
  - 新的 session/schema 字段

验收标准：

- 长 comment 不再依赖 shell 转义大段正文
- issue 发现能力通过 wrapper 可用
- `pace-issue-doc` 不再只读取单页评论
- 重复 helper 明显减少
- 没有引入新的 session/state 协议字段

### Wave D：状态与归档元数据扩展

优先级：P1/P2

目标：只处理真正需要状态协议支持的部分，为后续 recover 留最小地基。

范围：

- archive index/meta 模板
- 如确有必要，再定义 reopen/resume/stale 相关 schema
- YAML/session/state 解析测试随 schema 变更同步前移

涉及文件：

- `.claude-plugin/skills/archive/SKILL.md`
- `.claude-plugin/skills/roadmap/templates/state.template.md`
- 新增 `archive/templates/*`
- 必要时修改 `README.md`
- `bin/lib/pace-config.js`
- 对应 tests

明确动作：

- 先补 archive 的稳定模板：
  - `archive-index.template.md`
  - `archive-meta.template.md`
- 只有在 archive/state 元数据确认后，才评估是否需要新增：
  - reopen source
  - `resume_role`
  - `codebase_map_status`
- 若本波引入新的 session/state/schema 字段：
  - 对应 parser/test 必须同波次落地
  - 不允许把 schema 风险拖到最后一波
- `status`、`milestone` 的模板化在本波只做“如有必要”的整理，不列为主交付

验收标准：

- archive 产物有稳定模板，不再靠自然语言漂移
- 若新增任何 schema 字段，都已有对应测试
- 若 schema 代价不划算，本波允许明确决定“不做 stale / 不做 resume_role”

### Wave E：最小 recover + 角色超时策略

优先级：P2

目标：在 archive/state 元数据已经稳定后，补最小恢复入口和单独的超时策略。

范围：

- `pace:recover`
- role 层无响应/超时规则

涉及文件：

- 新增 `.claude-plugin/skills/recover/SKILL.md`
- 必要时新增 `recover/templates/*`
- `README.md`
- `README.multica.md`
- `roles/*.md`

明确动作：

- `pace:recover` 第一版只支持：
  - reopen archived phase
  - clear verify result and route back
  - abandon current phase with explicit reason
- 明确声明：
  - 不做源码级自动回滚
  - 不做 `git reset`
  - 不接管业务修复
- 角色层超时/无响应规则单独定义，不与 recover 绑成一个状态机：
  - 何时写 comment
  - 何时转 `blocked`（若 schema 已批准）
  - 如何声明 `resume_role`
- 若 Wave D 最终没有批准相关 schema，本波只写文档层约束，不强推字段落盘

验收标准：

- phase 可以受控重开
- verify 失败后有正式恢复入口
- 角色文档覆盖“用户不回复 / session 超时”这两类情况
- 没有引入源码级回滚能力

### Wave F：完整 CI、安装链 hardening 与延期项复核

优先级：P2/P3

目标：把前几波收口成可发布、可回归、可升级的状态。

范围：

- 完整 CI
- 安装链 hardening
- 延期项复核

涉及文件：

- `package.json`
- `.github/workflows/*`
- `bin/install-codex.sh`
- `README.md`

明确动作：

- 建立完整 CI：
  - wrapper smoke
  - unit tests
  - parser/session tests
  - `--help` contract smoke
- 强化 `install-codex.sh`：
  - 支持显式版本或 tag
  - 安装前备份旧目录
  - 避免 `rsync --delete` 直接清空用户自定义内容
- 复核两个延期项是否真的需要实现：
  - `pace-pr.js`
  - `pace-config` CLI
- 若近期要发版，把安装链 hardening 视为 release gate，不得继续后移

验收标准：

- 关键路径有自动回归保护
- 安装升级不再默认无备份覆盖
- 延期项要么落地，要么在 README 中明确写成未纳入当前版本

## 5. 审查项覆盖矩阵

### Skills 层

| 审查项 | 修订后的处理方式 | 波次 |
| --- | --- | --- |
| 错误恢复/回滚 skill 缺失 | 新增最小 `pace:recover`，只做流程恢复，不做源码回滚 | Wave E |
| `pace:intake` 缺模板 | 重分类为“缺 requirement-summary 同步模板”，不是 intake 整体缺模板 | Wave B 或 F |
| `pace:archive` 缺模板 | 补 archive index/meta 模板 | Wave D |
| `pace:milestone` 缺模板 | 降级为低优先级格式统一项 | Wave D 或 F |
| `pace:status` 缺输出模板 | 降级为低优先级格式统一项 | Wave D 或 F |
| codebase map 自动更新机制缺失 | 仅在 schema 成本可接受时评估 `stale` 机制 | Wave D，可不做 |

### Roles 层

| 审查项 | 修订后的处理方式 | 波次 |
| --- | --- | --- |
| `tech` verify/archive 路径缺失 | 重分类为“tech 合同漂移需校准”，保持它继续在 roles 链外 | Wave B |
| Intake Manager 与 `pace:intake` 命名混淆 | 澄清边界，但保留 `需求接管经理` 现有职责 | Wave B |
| 无超时/无响应处理 | 在 recover 之后单独补 role 策略 | Wave E |
| pre-role 阶段无人负责 | 重分类为“执行器合同与工具能力需对齐”，不是新增角色缺失 | Wave B/C |
| `tracking-block.template.md` 未被引用 | 在 `需求接管经理` 中显式绑定用途 | Wave B |
| `Delivery Manager` 的 discuss/plan 回退终态不清 | 明确回退条件和终态 | Wave B |

### Scripts 层

| 审查项 | 修订后的处理方式 | 波次 |
| --- | --- | --- |
| 所有 `execFileSync` 无超时 | 统一执行封装与超时策略 | Wave A |
| 重复代码多 | 抽共享 helper | Wave C |
| `pace-git.js` 缺 pull/fetch/checkout | `fetch` 可做；`pull --ff-only` 视 branch 语义决定；`checkout/switch` 延后单独评审 | Wave C / 单独评审 |
| `pace-gh.js` 缺 `--body-file` | 增加 `--body-file` | Wave C |
| `pace-multica.js` 无 session 感知 | 不直接实现 session issue 绑定；先暂停，待协议评审 | 暂缓 |
| `pace-multica.js` 无二进制检查 | 在统一执行层补 `ensureBinary()` | Wave A |
| `pace-gh.js` 缺 issue-list/search | 增加发现类命令 | Wave C |
| `pace-issue-doc.js` 无 API 分页 | 改成分页读取 comments | Wave C |
| `pace-init.js` 静默吞错 | 拆成 `probe()` / `mustRun()`，不做一刀切上抛 | Wave A |
| 无 `pace-pr.js` | 延期复核 | Wave F |
| 无 `pace-config` CLI | 延期复核 | Wave F |
| `install-codex.sh` 无版本锁定/备份 | 作为 release gate 收口 | Wave F |

### 架构层

| 审查项 | 修订后的处理方式 | 波次 |
| --- | --- | --- |
| `2+N` 文档模型部分只是愿景 | 重分类为“已部分实现，需要合同默认化收口” | Wave B |
| YAML 解析器过于简单 | 保持 YAML 子集策略；如 schema 变更，同波次补测试 | Wave A / D |
| 无 CI/CD、无测试 | Wave A 先上最小 harness，Wave F 再补完整 CI | Wave A + F |

## 6. 推荐实施顺序

按下面顺序推进，不再沿用旧版大包式波次：

1. `Wave A`：安全基线 + 最小测试
2. `Wave B`：workflow 合同收敛
3. `Wave C`：低风险 wrapper parity
4. `Wave D`：状态与归档元数据扩展
5. `Wave E`：最小 recover + role 超时策略
6. `Wave F`：完整 CI / install hardening / 延期项复核

原因：

- 不先做 `Wave A`，后面每一波都会在无护栏状态下改 wrapper 和 parser。
- 不先做 `Wave B`，就会持续把当前合同和未来实现搅在一起。
- `Wave C` 只做低风险 parity，避免把协议级改动塞进同一波。
- `Wave D` 是 `Wave E` 的前置条件；没有 archive/state 元数据，recover 只能停留在概念层。
- `Wave F` 负责真正的发布和长期维护收口。

## 7. 完成定义

这轮修订版计划完成时，应满足以下条件：

- `tech phase` 继续在 roles 链外闭环，且所有文档说法一致。
- wrapper 已具备统一 timeout/error/binary 边界。
- 仓库从第一波起就有最小回归保护。
- roles 文档不再有漂移或职责空洞。
- 低风险 wrapper 缺口已补齐，协议级改动被单独评审。
- archive/recover 若落地，建立在明确的元数据契约之上。
- 安装链 hardening 和完整 CI 在发布前可作为 gate 使用。

## 8. 本轮明确不做的事

- 不把 `tech phase` 重新并入 requirement roles 链。
- 不在没有协议设计的前提下，直接给 `pace-git` 加 `checkout/switch`。
- 不在没有 schema 设计的前提下，直接给 `pace-multica` 绑定 session issue id。
- 不做源码级自动回滚。
- 不把 `status`、`milestone` 的模板整理误当成当前主断点。
