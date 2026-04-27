# `.pace/phases/<phase>/` 最小目录约定

```text
.pace/
  phases/
    <phase>/
      context.md
      discussion-log.md
      coverage.md
      plans/
        01-<slug>.plan.md
      runs/
        01-<slug>.run.md
      execution-log.md
      verification.md
```

规则：

- `plans/` 只放 `.plan.md`
- `runs/` 只放 `.run.md`
- 一个 plan 对应一个主 run 文件
- `coverage.md` 记录当前 phase 的交付物覆盖与 plan 绑定
- `execution-log.md` 记录当前 phase 的执行状态与重试历史
- `context.md` 和 `verification.md` 是当前工作区中的 phase 级真相源
