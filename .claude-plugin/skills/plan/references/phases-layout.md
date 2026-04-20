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
- `context.md` 和 `verification.md` 是当前工作区中的 phase 级副本
- `multica + github` 下，跨轮次真相源仍是 GitHub 主 issue comment、主 issue 的受控索引 comment、文档 root issue、初始化参数子 issue与文档 issue body；本地 `.pace/phases/<phase>/` 只是恢复后的缓存
