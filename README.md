# PACE - Plan, Act, Check, Evolve

轻量级项目管理 Skills，用 phase 式工作流从需求到交付。

同时支持 **Claude Code** 和 **Codex CLI**。

## 安装

### Claude Code

```bash
/plugin marketplace add Ghost233/pace
/plugin install pace@pace
```

### Codex CLI

```bash
/plugin marketplace add Ghost233/pace
/plugin install pace@pace
```

## 快速开始

```bash
# 1. 合并配置（根据执行环境选择）
node bin/pace-merge.js local     # 本地 Claude Code
node bin/pace-merge.js multica   # multica 编排

# 2. 开始使用
/pace:bootstrap → 创建新项目的 .pace/ 工作区
/pace:status    → 查看当前进度和下一步建议
```

## 工作流

```
bootstrap → map-codebase → intake → discuss → plan → execute → verify → archive
                                                    ↑              │
                                                    └──────────────┘
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

## 配置

配置文件位于 `.pace/` 目录下，支持分层合并：

```
.pace/
├── config.yaml           # 基础配置（所有环境共享）
├── config.local.yaml     # 本地 Claude Code 覆盖
└── config.multica.yaml   # multica 编排覆盖
```

合并命令：

```bash
node bin/pace-merge.js local     # → .pace-config.yaml
node bin/pace-merge.js multica   # → .pace-config.yaml
```

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

# 子代理设置
agents:
  max_concurrent: 3      # 最大并行数 (1-5)
  model_profile: balanced # quality | balanced | budget | adaptive
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
│   └── marketplace.json
├── .agents/plugins/          # Codex CLI 插件配置
│   ├── plugin.json
│   └── marketplace.json
├── .pace/                    # 配置文件（提交到 git）
│   ├── config.yaml
│   ├── config.local.yaml
│   └── config.multica.yaml
├── bin/
│   └── pace-merge.js         # 配置合并脚本
├── skills/                   # 共享 skills（双平台通用）
│   ├── archive/
│   ├── bootstrap/
│   ├── config/
│   ├── discuss/
│   ├── execute/
│   ├── intake/
│   ├── map-codebase/
│   ├── milestone/
│   ├── plan/
│   ├── roadmap/
│   ├── status/
│   └── verify/
├── README.md
└── package.json
```

## 名称含义

PACE = **P**lan, **A**ct, **C**heck, **E**volve

对应核心循环：规划 → 执行 → 验证 → 归档迭代
