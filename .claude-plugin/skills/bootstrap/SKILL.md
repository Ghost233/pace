---
name: pace:bootstrap
description: 初始化本地 PACE 工作区的最小真相源，识别 greenfield 或 brownfield，并创建 `.pace/project.md`、`.pace/requirements.md`、`.pace/roadmap.md`、`.pace/state.md`。当用户想在当前仓库启动一套新的本地 workflow，或本地 `.pace/` 缓存缺失需要恢复时触发。
---

# PACE Bootstrap

## 配置读取

执行任何操作前，先读取 `.pace/session.yaml`。

如果不存在，不要再回退读取 `.pace-config.yaml`，也不要用隐式默认值继续。应停止并要求先运行：

- `node "$HOME/.codex/skills/pace/bin/pace-init.js" local`

## 当前定义

当前仓库的 bootstrap 只定义本地模式：

- 所有工作流产物写入 `.pace/`
- 不依赖 GitHub issue / root issue / init-params issue
- 不回交任何外部角色

## 必需产物

- `.pace/project.md`
- `.pace/requirements.md`
- `.pace/roadmap.md`
- `.pace/state.md`

若是 brownfield 且缺少代码地图，再追加：

- `.pace/codebase/`

## 最小流程

1. 判断当前仓库是 greenfield 还是 brownfield
2. 若是 brownfield 且无代码地图：
   - 将 `Recommended Next Skill` 写为 `pace:map-codebase`
3. 获取项目简述
4. 写 `project.md`
5. 写 `requirements.md`
6. 写最小 `roadmap seed`
7. 写 `state.md`

## 后续路由

- brownfield 且缺代码地图：`pace:map-codebase`
- 首个 phase 为 `tech`：路由到该 phase 的 `Owner Skill`
- 首个 `requirement` phase：默认路由 `pace:discuss`

## 边界

- 不要创建 GitHub issue
- 不要写 GitHub comment
- 不要假装存在外部文档链
- 不要做完整 roadmap 优化
