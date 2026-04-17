# Coverage Tracker Template

> 用途：为 `coverage.md` 提供统一结构。
> 目标：贯穿 discuss → plan → execute → verify 的交付物追踪，防止功能点遗漏。

## 模板

```md
# Phase <phase>: <title> Coverage Tracker

| ID | Description | Status | Plan | Run |
|----|-------------|--------|------|-----|
| D-01 | <交付物描述> | pending | - | - |

## Notes

- <补充说明>
```

## 字段说明

- **ID**：稳定编号，discuss 阶段生成，全局唯一
- **Description**：交付物的一句话描述
- **Status**：`pending` → `planned` → `done` | `missed`
- **Plan**：负责实现的 plan 文件名（plan 阶段填充）
- **Run**：对应的 run 文件名（execute 阶段填充）

## 生命周期

1. **discuss**：创建文件，从 Locked Decisions 中提取交付物，Status = `pending`
2. **plan**：为每个交付物分配 plan，填充 Plan 列，Status = `planned`
3. **execute**：每个 plan 完成后更新 Run 列和 Status = `done`
4. **verify**：检查是否所有行 Status = `done`，有 `missed` 或 `pending` 则 verdict = `fail`
