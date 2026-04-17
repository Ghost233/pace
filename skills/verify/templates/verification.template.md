# Verification Template

> 用途：为 `verification.md` 提供统一结构。  
> 目标：明确 phase 级验证结论、证据、缺口和下一步路由。

## 模板

```md
# Verification <phase>: <title>

## Verdict

- pass | partial | fail

## Goal Check

- Goal: <来自 roadmap 的 phase goal>
- Result: <是否达成，以及为什么>

## Requirements Coverage

- REQ-01 - pass | fail | unclear

## Context Compliance

- D-01 - pass | fail | unclear

## Evidence

### Plans
- `.pace/phases/<phase>/plans/<file>.plan.md`

### Runs
- `.pace/phases/<phase>/runs/<file>.run.md`

### Checks
- `pnpm test --filter <target>` - pass

## Gaps

- <未达成项>

## Recommended Next Step

- archive
```
