# `.pace/phases/<phase>/` 最小目录约定

```text
.pace/
  phases/
    <phase>/
      context.md
      discussion-log.md
      plans/
        01-<slug>.plan.md
      runs/
        01-<slug>.run.md
      verification.md
```

规则：

- `plans/` 只放 `.plan.md`
- `runs/` 只放 `.run.md`
- 一个 plan 对应一个主 run 文件
- `context.md` 和 `verification.md` 是 phase 级真相源
