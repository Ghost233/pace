# 流程经理统一结论模板

```md
## [PACE] 流程结论 - <继续推进 | 等待用户 | 已关闭>

- 角色：PACE-流程经理
- 执行分支：<branch | 无>
- 当前子阶段：<route | prepare | issue_intake | phase_manage | delivery | closeout>
- 下一子阶段：<route | prepare | issue_intake | phase_manage | delivery | closeout | 无>
- 下一 Skill：<pace:workflow | pace:bootstrap | pace:map-codebase | pace:intake | pace:discuss | pace:plan | pace:roadmap | pace:execute | pace:verify | pace:archive | pace:recover | 无>
- continue_workflow：<true | false>
- needs_user_input：<true | false>
- closed：<false | archived | verified-pass | abandoned>
- blocking_code：<none | missing_input | external_dependency | state_conflict | plan_drift | missing_local_state>
- reason：<一句话结论>
- evidence：
  - <当前轮用于判断阶段和结论的关键证据；没有则写 无>
- updated_artifacts：
  - <本轮更新的本地产物；没有则写 无>
- stop_rule_hit：
  - <none | repeat_stage_without_new_artifacts | truth_source_unchanged | external_dependency | needs_user_input>
```
