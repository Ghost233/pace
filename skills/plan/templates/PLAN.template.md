# PLAN Template

> 用途：为 `.plan.md` 提供统一结构。  
> 目标：让 executor 直接执行，不需要再反向猜测需求。

## 模板

```md
# Plan <phase>-<plan_id>: <title>

## Objective

<这一份 plan 单独交付什么，以及为什么单独拆出来。>

## Scope Boundaries

### In
- <必须做的内容>

### Out
- <明确不做的内容>

## Requirements Covered

- REQ-...

## Inputs

### Workflow Inputs
- `.pace/project.md`
- `.pace/requirements.md`
- `.pace/roadmap.md`
- `.pace/state.md`
- `.pace/phases/<phase>/context.md`

### Code / Docs To Read First
- `path/to/source/file`
- `path/to/reference/doc.md`

## Depends On

- none

## Wave

- 1

## Files

### Create
- `path/to/new-file.ts`

### Modify
- `path/to/existing-file.ts`

### Verify Against
- `path/to/reference-file.ts`

## Tasks

### Task 1: <task name>

#### Files
- `path/to/file-a`

#### Action
- <写清楚目标状态>

#### Verify
- `pnpm test --filter <target>`

#### Done
- <完成后必须为真的结果>

## Must-Haves

### Truths
- <用户或系统可观察到的结果>

### Artifacts
- `path/to/file-a` 必须存在且有真实实现

### Key Links
- `<artifact A>` 必须调用/连接 `<artifact B>`

## Verification

### Automated
- `pnpm test --filter <target>`

### Manual
- <仅当自动化不足时才写>

## Risks / Notes

- <执行风险>
```
