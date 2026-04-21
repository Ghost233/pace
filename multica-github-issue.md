# multica + GitHub issue 文档链计划

这份文档描述的是 `multica + github` 下的**目标协议**。目标是：

- 降低 GitHub issue 数量
- 保留可恢复、可重跑、可 handoff 的文档链
- 不依赖 GitHub 原生 `sub-issue / parent-issue`

当前建议采用 **`2 + N` 模型**。

## 结论

不要再拆成：

- 一棵 `doc-issue`
- 一棵 `code-issue`

也不要继续走：

- tracking 摘要一个 issue
- context 一个 issue
- plan 一个 issue
- execution 一个 issue
- verification 一个 issue

这两种方案都会把 issue 数量推高，而且恢复链会越来越复杂。

推荐收敛成：

1. 一个业务主 issue
2. 一个文档 root issue
3. 一个初始化参数文档 issue
4. 每个 phase 一个文档 issue

也就是 `2 + N`：

- `主 issue`
- `root issue`
- `init-params issue`
- `phase-01 / phase-02 / phase-03 ...`

## 推荐拓扑

### 1. 主 issue

例如：

- `#72 创作者中心草稿编辑页面发送按钮消失了`

职责：

- 业务入口
- 角色阶段 comment
- handoff / closeout comment
- 受控索引 comment

不负责：

- 长正文持久化
- 初始化参数正文
- phase 级完整正文

### 2. 文档 root issue

例如：

- `issue-72-doc`

职责：

- 维护文档索引
- 维护 latest 节点
- 维护滚动链
- 记录初始化参数文档 issue
- 记录 phase 文档 issue
- 保存结构化 JSON 索引

不负责：

- 保存各 phase 的完整正文

### 3. 初始化参数文档 issue

例如：

- `issue-72-init-params`

职责：

- 保存可直接恢复 `pace-init.js` 的参数
- 作为后续角色重入时的初始化参数来源

至少应包含：

- `executor`
- `tracker.type`
- `tracker.github.repo`
- `tracker.github.username`
- `git.branch`
- `git.base_branch`
- `git.name`
- `git.email`
- `issue.url`
- `issue.title`
- `issue.type`
- `current_role`

### 4. phase 文档 issue

例如：

- `issue-72-phase-01`
- `issue-72-phase-02`
- `issue-72-phase-03`

每个 phase issue 保存该 phase 的最新版正文。  
不再为 phase 内每份正文单独建 issue。

## 为什么选 2 + N

### 比“一文一 issue”更省

如果继续每篇文档单独一个 issue：

- tracking 摘要一个 issue
- context 一个 issue
- plan 一个 issue
- execution 一个 issue
- verification 一个 issue
- archive 状态一个 issue

一个普通 bug 很快就会长出 6 到 10 个文档 issue。

而 `2 + N` 下，一个普通 requirement/big fix 通常只需要：

- 主 issue
- root issue
- init-params issue
- 当前 phase issue

总量会明显下降。

### 比“单 root 大正文”更稳

如果把所有东西都塞回 root issue 或单个大文档 issue，又会出现：

- 初始化参数和正文混写
- 单个 body 膨胀过快
- `resolve-init` 很难只读取初始化参数
- 某个 phase 过长时没法独立滚动

所以最稳的是：

- `init-params` 继续单独一篇
- 其余正文按 phase 合并

## 正式协议

跨轮次真相源固定为：

1. 主 issue 的受控索引 comment
2. 文档 root issue 的索引正文与 JSON
3. 初始化参数文档 issue
4. 各 phase 文档 issue 的 body / 审计 comment

这些节点**只通过链接索引关联**，不依赖 GitHub 原生 `sub-issue / parent-issue` 功能。

如果索引层冲突，优先级固定为：

1. 文档 root issue 的 JSON 索引
2. 初始化参数文档 issue / phase 文档 issue 正文
3. 主 issue 的受控索引 comment

补充规则：

- 主 issue 的受控索引 comment 是首选入口，但不是唯一入口
- 如果它缺失、损坏或漂移，允许从文档 root issue 的 JSON 索引反查恢复
- 自动修复时，应以文档 root issue 的 JSON 为准，重新回填主 issue 的受控索引 comment

## phase issue 的正文结构

每个 phase issue 建议固定 section：

- `tracking summary`
- `requirement summary`
- `context`
- `discussion log`
- `plan`
- `execution`
- `verification`
- `archive status`

也就是说：

- phase 内的多份正文不再拆成多个 issue
- 而是合并成一个 issue 中的多个 section

## 命名建议

推荐：

- 主 issue：GitHub 正常业务标题
- 文档 root issue：`issue-<N>-doc`
- 初始化参数 issue：`issue-<N>-init-params`
- phase issue：`issue-<N>-phase-<NN>`

例如：

- `issue-72-doc`
- `issue-72-init-params`
- `issue-72-phase-01`
- `issue-72-phase-02`

## 文档滚动

默认情况下：

- 一个主 issue 只有一个 root issue
- 一个 phase 只有一个 phase issue

只有当单个 phase issue 正文过长时，才滚动到下一篇：

- `issue-72-phase-02`
- `issue-72-phase-02-2`

滚动后要求：

- root issue 更新滚动链
- 主 issue 的受控索引 comment 更新 latest 节点
- 新 issue 继续承接同一 phase

## 标准生命周期

### 阶段 0：multica 前置

进入任何 role 前，先：

1. 读取 multica issue
2. 读取 multica comments
3. `multica repo checkout <repo-url>`
4. 进入 checkout 后的仓库根目录

### 阶段 1：首次初始化

首次接管主 issue 时：

1. 用当前显式已知参数运行 `pace-init.js`
2. 若缺参，由 `pace-init.js` 一次性列出完整缺失参数
3. `pace-init.js` 成功后，执行 `ensure-root`

此时必须创建或复用：

- 文档 root issue
- 初始化参数文档 issue
- 主 issue 的受控索引 comment

如果主 issue 的受控索引 comment 不存在，但 root issue 的 JSON 完整：

- 允许先从 root issue 恢复
- 再自动补回主 issue 的受控索引 comment

### 阶段 2：角色推进

后续角色进入时：

1. `resolve-init --issue <main-issue>`
2. 执行恢复出来的 `pace-init.js multica ...`
3. 确认 branch 正确
4. 进入角色正文

角色正文产出的稳定正文，不再默认分散到多篇文档 issue，  
而是优先更新当前 phase 对应的 phase issue。

### 阶段 3：交接与重跑

每轮结束时：

- GitHub 主 issue 要有阶段结论 comment
- 当前 phase issue body 要是最新版
- root issue 要更新索引
- 主 issue 的受控索引 comment 要回填
- multica 侧要通过 `pace-multica.js handoff` 落成真实 reassignment

## 每种节点写什么

### 主 issue comment

写：

- `tracking-init`
- handoff / closeout
- 阶段结论
- 受控索引入口

不写：

- 长正文全文

### 文档 root issue

写：

- 初始化参数 issue 链接
- phase issue 列表
- latest 节点
- 滚动链
- JSON 索引

### 初始化参数 issue

写：

- `pace-init.js` 的恢复参数

### phase issue

写：

- 该 phase 的最新版正文
- 多个 section 的聚合内容

### 审计 comment

写：

- 修订号
- 变更摘要
- 来源角色

## 与脚本的关系

### `ensure-root`

应负责：

- 创建或复用 root issue
- 创建或更新 init-params issue
- 回填主 issue 的受控索引 comment

### `resolve-init`

应负责：

1. 先读主 issue 的受控索引 comment
2. 若 comment 缺失或损坏，则改读 root issue JSON
3. 定位初始化参数文档 issue
4. 恢复出可再次执行的 `pace-init.js multica ...`
5. 必要时自动补回主 issue 的受控索引 comment

### `upsert-doc`

当前已支持：

- 更新当前 phase issue 的某个 section
- 再统一回填 root issue 与主 issue 索引

推荐调用方式：

```bash
node "$HOME/.codex/skills/pace/bin/pace-issue-doc.js" upsert-doc \
  --issue 72 \
  --doc-key phase-01 \
  --title "issue-72-phase-01" \
  --section plan \
  --body-file /tmp/plan.md
```

## 幂等要求

重跑时应保证：

- root issue 可复用
- init-params issue 可更新
- phase issue 可更新
- 索引缺失时可补回

也就是说：

- 不应越跑越分叉
- 不应越跑 issue 越多

## 一句话版本

最终收敛成一句话就是：

**只保留一棵文档树：主 issue -> 文档 root issue -> 初始化参数 issue -> phase issue。**

不要再平行拆：

- `doc-issue`
- `code-issue`

也不要继续：

- 每篇正文一个 issue

## 当前状态说明

这份文档现在描述的是**建议收敛方向**，不是“脚本已经 100% 实现完成”的现状。

当前脚本已经和这版方向兼容的部分：

- 单 root issue
- 单 init-params issue
- 链接索引恢复
- 主 issue comment 丢失时允许从 root issue JSON 自修复（协议已定）
- `upsert-doc --section` 可更新 phase issue 的 section

当前脚本后续还需要跟进的部分：

- 为 phase issue 定义固定 section schema
- 让 roles / skills 默认改走 `phase-<NN> + --section`
