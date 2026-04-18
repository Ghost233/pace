# PACE for Multica

这个文档只回答一件事：

如何把 PACE 作为一套“角色 + skills”的流程系统，运行在 multica 上，并从创建 issue 一直推进到归档。

如果你要看项目本身的通用介绍、安装和基础配置，请先看 [README.md](README.md)。

## 适用场景

适用于以下形态：

- 仓库里已经接入了 PACE
- 你准备用 multica 来承载外部流程编排
- `skills` 负责执行动作
- `roles` 负责阶段管理、handoff 和 GitHub 同步

## 核心原则

1. 必须先读取 `tracker.type`，再判断当前工作的真相源。
2. 当 `tracker.type = github` 时，GitHub issue 的追踪块与阶段 comment 是跨轮次唯一真相源；`.pace/` 只是当前工作区的本地产物，不保证下轮还在。
3. Multica issue 是流程入口和协作面。
4. GitHub issue 是外部追踪时间线。
5. 角色负责决定“下一步做什么”，skill 负责把这一步做完。

## 前置准备

### 1. 合并 multica 配置

在项目仓库根目录执行：

```bash
node bin/pace-merge.js multica
```

这会生成 `.pace-config.yaml`，让当前仓库按 multica 模式运行。

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

roles:
  enabled: true
```

## 角色设计

在 multica 中，推荐创建 4 个固定角色 agent：

1. `PACE-需求接管经理`
2. `PACE-阶段经理`
3. `PACE-交付经理`
4. `PACE-验收归档经理`

对应的角色定义：

- [`roles/需求接管经理.md`](roles/需求接管经理.md)
- [`roles/阶段经理.md`](roles/阶段经理.md)
- [`roles/交付经理.md`](roles/交付经理.md)
- [`roles/验收归档经理.md`](roles/验收归档经理.md)

推荐约定：

- 一个角色 agent 覆盖一个稳定阶段
- 不要把每个 skill 都单独做成一个 multica agent
- 角色 agent 只负责流程推进，不替代 `.pace/` 产物
- 每个角色在本轮开始时都必须先运行 `node bin/pace-merge.js multica`，先锁定 `multica` 工作模式，再读取 `.pace-config.yaml` 中的 `tracker` 配置

## 标准流程

### 阶段 1：在 Multica 创建新 Issue

你先在 Multica 创建 issue。

这个 issue 可以来自：

- 新需求
- 现有功能扩展
- 缺陷修复
- 某个 phase 的阻塞升级

创建完成后，第一位接手者必须是：

`PACE-需求接管经理`

### 阶段 2：PACE-需求接管经理

这个角色负责第一次接管 issue。

它必须完成：

1. 检查当前 issue 是否已有 GitHub issue URL。
2. 如果 `tracker.type = github` 且没有 URL，则创建 GitHub issue。
3. 把 GitHub issue URL 回填到当前 multica issue 的元数据或描述中。
4. 建立追踪块，至少包含：
   `GitHub Issue / Current Stage / Current Role / Last Synced At`
5. 写第一条 `intake` comment 到 GitHub issue。
6. 判断这个 issue 是：
   - 新 requirement
   - 已有 phase 变更
   - bug
   - blocker
7. 给出 handoff。

如果 GitHub issue URL 缺失且还没补齐，流程不能继续往下走。

完成后，正常移交给：

`PACE-阶段经理`

### 阶段 3：PACE-阶段经理

这个角色负责：

```text
pace:intake -> pace:discuss -> pace:plan
```

执行顺序建议固定为：

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

这一阶段如果还有关键歧义，不要硬推到执行阶段。

只有当 plan 已经 ready for execute 时，才移交给：

`PACE-交付经理`

### 阶段 4：PACE-交付经理

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
   - 关键波次完成
   - 出现 blocker 或需要回退
   - execute 完成

comment 重点写：

- 完成了什么
- 当前卡点是什么
- 下一步去哪里

如果执行中发现 scope 变了，应该退回：

`PACE-阶段经理`

如果只是执行失败但范围没变，则继续留在本角色内处理。

执行完成后，移交给：

`PACE-验收归档经理`

### 阶段 5：PACE-验收归档经理

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

如果验证失败：

- scope 不变 -> 退回 `PACE-交付经理`
- plan 本身失真 -> 退回 `PACE-阶段经理`

## 标准流转图

```text
Multica 新建 issue
  -> PACE-需求接管经理
  -> PACE-阶段经理
  -> PACE-交付经理
  -> PACE-验收归档经理
  -> archived
```

## 常见回退路径

- 缺 GitHub issue URL：停在 `PACE-需求接管经理`
- 范围不清或需求变化：`PACE-交付经理 -> PACE-阶段经理`
- 验收失败但 scope 不变：`PACE-验收归档经理 -> PACE-交付经理`
- 验收失败且 plan 失真：`PACE-验收归档经理 -> PACE-阶段经理`

## GitHub 同步要求

建议把下面这些 comment 当作硬要求：

1. `intake`
2. `discuss`
3. `plan`
4. `execute`
5. `verify`
6. `archive`

统一模板可以用：

- [`roles/templates/github-issue-comment.template.md`](roles/templates/github-issue-comment.template.md)
- [`roles/templates/tracking-block.template.md`](roles/templates/tracking-block.template.md)

## 一条完整示例

```text
1. 你在 Multica 创建 issue: "支持批量导出订单 CSV"
2. 分配给 PACE-需求接管经理
3. 它发现没有 GitHub issue URL，于是创建 GitHub issue 并回填链接
4. 它写 intake comment，然后 handoff 给 PACE-阶段经理
5. PACE-阶段经理 依次跑 pace:intake / pace:discuss / pace:plan
6. plan ready 后，handoff 给 PACE-交付经理
7. PACE-交付经理 跑 pace:execute，并持续写执行进展 comment
8. 执行完成后，handoff 给 PACE-验收归档经理
9. PACE-验收归档经理 跑 pace:verify / pace:archive
10. GitHub issue 留下最终验收与归档 comment，流程结束
```

## 日常使用建议

1. 人只负责创建 issue、补充业务目标、查看进度时间线。
2. 第一位角色永远是 `PACE-需求接管经理`。
3. 不要跳过 GitHub issue URL 和阶段 comment。
4. 不要靠 comment 反推内部状态，内部状态以 `.pace/` 为准。
5. 卡住时优先看 `pace:status` 和当前角色是否应该 handoff，而不是直接改角色职责。
