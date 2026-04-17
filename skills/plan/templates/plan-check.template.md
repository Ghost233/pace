# Plan Check Template

> 用途：为 planner / checker 输出统一审查格式。  
> 目标：明确告诉下一轮是 `pass`、`revise` 还是 `split`。

## 模板

```md
# Plan Check Result

## Phase

- Phase: <phase>
- Title: <phase title>

## Verdict

- pass | revise | split

## Summary

- <一句话说明总体情况>

## Findings

### 1. Goal Alignment
- status: pass | fail
- notes:
  - <goal 是否被 plans 覆盖>

### 2. Requirement Coverage
- status: pass | fail
- notes:
  - <哪些 requirement 漏掉了>

### 3. Context Compliance
- status: pass | fail
- notes:
  - <locked decisions 是否落实>

### 4. Task Completeness
- status: pass | fail
- notes:
  - <哪些 task 太模糊>

### 5. Dependency / Wave Sanity
- status: pass | fail
- notes:
  - <依赖和 wave 是否合理>

### 6. Verification Quality
- status: pass | fail
- notes:
  - <verify 是否可执行>

### 7. Scope / Split Signal
- status: pass | fail
- notes:
  - <是否应该拆 phase>

## Required Revisions

- <必须修改的项>

## Optional Improvements

- <可选优化项>

## Split Recommendation

- none

或

- 建议拆成：
  - `<group A>`：<覆盖范围>

## Ready For

- execute
```
