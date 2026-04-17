# Run Template

> 用途：为 `.run.md` 提供统一结构。  
> 目标：记录 plan 的实际执行结果、检查记录和偏差，不承载正式验收结论。

## 模板

```md
# Run <phase>-<plan_id>: <title>

## Source Plan

- `.pace/phases/<phase>/plans/<file>.plan.md`

## Objective

<对应 plan 的 objective>

## Status

- pass | partial | fail

## Files Changed

- `path/to/file-a`

## Work Completed

- <完成的工作>

## Checks Run

- `pnpm test --filter <target>` - pass

## Deviations

- <相对原 plan 的偏差>

## Issues / Follow-ups

- <遗留问题>

## Result Summary

- <一句话总结>
```
