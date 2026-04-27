# Context Template

> 用途：为 `context.md` 提供统一结构。  
> 目标：把 discuss 阶段形成的边界、决策和参考输入整理成当前工作区里的下游工作副本。

## 模板

```md
# Phase <phase>: <title> Context

## Goal

<这一 phase 完成后，用户或系统应该能做到什么。>

## Phase Boundary

### In Scope
- <当前 phase 必须覆盖的内容>

### Out of Scope
- <当前 phase 明确不做的内容>

## Locked Decisions

### D-01
- Decision: <锁定决策 1>
- Scope: <这个决策约束哪些交付物或边界>
- Rejected Options:
  - <被否决方案> - <原因>
- Rationale: <为什么选这个>

### D-02
- Decision: <锁定决策 2>
- Scope: <这个决策约束哪些交付物或边界>
- Rejected Options:
  - <被否决方案> - <原因>
- Rationale: <为什么选这个>

## Allowed Discretion

- <允许 planner / executor 自行决定的局部问题>

## Existing Code Insights

### Reusable Assets
- `path/to/file` - <可复用点>

### Established Patterns
- <已有模式>

### Integration Points
- `path/to/file` - <新能力要接到哪里>

## Edge Cases / Failure Modes

- <边界情况>
- <失败情况>

## Rejected Alternatives

- <被否决方案> - <原因>

## Deferred Ideas

- <未来 phase 处理的想法>

## References

- `path/to/doc.md` - <为什么必须读>
- `path/to/source.ts` - <为什么必须读>
```
