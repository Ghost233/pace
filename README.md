# PACE - Plan, Act, Check, Evolve

轻量级项目管理 Skills，用 phase 式工作流从需求到交付。

同时支持 **Claude Code** 和 **Codex CLI**。

## 安装

### Claude Code

```bash
# 添加 marketplace
/plugin marketplace add <your-username>/pace

# 安装插件
/plugin install pace@pace
```

或手动安装：

```bash
git clone https://github.com/<your-username>/pace.git
./install.sh --local    # 项目级
./install.sh --global   # 全局
```

### Codex CLI

```bash
git clone https://github.com/<your-username>/pace.git
# 将 skills/ 目录复制到项目的 .agents/skills/ 下
cp -r pace/skills/ your-project/.agents/skills/
```

## 快速开始

```
/pace:config    → 初始化配置（追踪方式、子代理并发、模型档位）
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

运行 `/pace:config` 后生成 `.pace-config.yaml`：

```yaml
tracker:
  type: local              # local | github
  github:
    repo: ""               # owner/repo
    username: ""
    verified: false

agents:
  max_concurrent: 3        # 1-5
  model_profile: balanced  # quality | balanced | budget | adaptive
```

- **local** — 工作日志保存在 `.pace/`
- **github** — 同步到 GitHub Issues（需要 gh CLI）

## 卸载

### Claude Code

```bash
./install.sh --uninstall
# 或
/plugin uninstall pace@pace
```

### Codex CLI

```bash
rm -rf .agents/skills/
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
└── install.sh
```

## 名称含义

PACE = **P**lan, **A**ct, **C**heck, **E**volve

对应核心循环：规划 → 执行 → 验证 → 归档迭代
