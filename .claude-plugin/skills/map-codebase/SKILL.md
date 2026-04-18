---
name: pace:map-codebase
description: 用聚焦式映射分析现有代码库，将轻量代码地图写入 `.pace/codebase/`，供 discuss、plan 和 execute skills 复用。当仓库已有代码、用户希望获得轻量结构地图（而非完整 GSD 代码库分析）时触发。首次执行生成完整地图，后续执行只更新变更部分。
---

# PACE Map Codebase

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`；如果不存在，再回退读取 `.pace-config.yaml` 兼容旧工作区。如果两个文件都不存在，提示用户先运行 `pace-init local`、`pace-init multica` 或 `pace:config` 初始化配置；本次执行仅使用以下固定默认值继续：`tracker.type=local`、`agents.max_concurrent=1`、`agents.model_profile=balanced`、`agents.model_overrides={}`。如果配置文件存在，提取 `tracker`、`agents.max_concurrent`、`agents.model_profile`、`agents.model_overrides` 并应用于后续流程。`agents.max_concurrent` 直接控制子代理并行数上限。

## 默认约定

- 输出写入 `.pace/codebase/`
- 默认只做 `tech + arch`
- `quality + concerns` 只在用户明确要求，或默认输出不足时才启用
- 每个 pass 使用独立子代理并行执行，保持主代理上下文干净

## 必需产物

默认必须创建：

- `.pace/codebase/stack.md`
- `.pace/codebase/architecture.md`

仅当用户明确要求，或默认输出不足以回答测试策略、集成边界、代码规范风险中的任一问题时，才额外创建：

- `.pace/codebase/integrations.md`
- `.pace/codebase/conventions.md`
- `.pace/codebase/testing.md`
- `.pace/codebase/concerns.md`

## 映射模式

### 默认模式

执行两个 pass：

- `tech`：语言、运行时、包管理器、框架、外部系统
- `arch`：目录结构、入口、分层、主要数据流

### 扩展模式

执行四个 pass：

- `tech`
- `arch`
- `quality`
- `concerns`

## 处理流程

### 首次执行（`.pace/codebase/` 不存在）

1. 用文件系统工具探索仓库结构
2. 为每个 pass 启动独立子代理并行执行：
   - 每个子代理负责一个 pass 的探索和文档生成
   - 子代理直接写对应的 `.pace/codebase/` 文件
   - 主代理不拼接子代理输出，只等待完成
3. 完成后由主代理做一次交叉检查：文件路径是否一致、关键信息是否遗漏

### 更新执行（`.pace/codebase/` 已存在）

1. 读取已有代码地图文件，建立当前快照
2. 检测仓库变更：
   - 新增或删除的关键目录和文件
   - 依赖变更（package.json、Cargo.toml 等）
   - 配置变更
3. 为检测到变更的领域启动子代理并行更新：
   - 只重新映射有变更的 pass，未变更的跳过
   - 子代理基于已有文件做增量更新，不是全量重写
   - 在更新文件头部标注更新日期
4. 完成后由主代理确认更新一致性

### 判断规则

- `.pace/codebase/` 不存在 → 首次执行
- `.pace/codebase/` 存在且用户没有明确要求全量重建 → 更新执行
- 用户明确要求"重建"或"刷新" → 首次执行流程

## 子代理并行规则

- 每个 pass 一个子代理，同时启动
- 子代理 prompt 必须包含：pass 名称、关注点、输出文件路径、文档标准
- 子代理直接写文件，不返回文档正文给主代理
- 主代理只负责调度和最终一致性检查

## 文档标准

每个输出文件都应：

- 包含带反引号的真实文件路径
- 只描述当前状态，不写历史叙事
- 对 planner 或 executor 真正有用
- 必须写可执行模式，不写泛泛描述

`stack.md` 应回答：

- 这个仓库基于什么运行
- 哪些框架和库真正关键
- 配置文件放在哪里
- 接了哪些外部系统

`architecture.md` 应回答：

- 新代码应放在哪里
- 顶层边界怎么划分
- 数据如何进入并流过系统

## 边界

- 除非用户要求，不要自动提交
- 不要为了模仿 GSD 而机械地产出七个文件
- 不要把 browser/web 子代理当成代码探索器
- 不要读取 `.env` 的秘密内容，只记录它们是否存在
- 更新时不要删除已有文件中仍然准确的内容

## 后续路由

下游 skill 应这样消费代码地图：

- `pace:discuss`：在提产品问题前先复用现有模式
- `pace:plan`：让计划基于真实结构和集成点
- `pace:execute`：让文件放置和测试风格保持一致
