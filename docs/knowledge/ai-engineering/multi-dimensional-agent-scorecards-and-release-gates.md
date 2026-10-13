---
title: 不要把所有维度压成一个总分
date: 2026-10-13
tags:
  - Agent Evaluation
  - Scorecard
  - Release Gate
  - Risk Management
description: 用多维 Scorecard、风险硬门槛、回归预算和分阶段 Release Gate，把 Agent 评测结果转化为可审计的发布决策
---

# 不要把所有维度压成一个总分

## 要解决的问题

一次 Agent 实验可能产生几十个指标：成功率、重复可靠性、质量、安全事故、成本、延迟、工具调用和人工介入。最容易展示的方法是归一化后加权：

~~~text
Total Score
  = 40% × Success
  + 20% × Quality
  + 15% × Reliability
  + 10% × Safety
  + 5% × Cost
  + 5% × Latency
  + 5% × Human Intervention
~~~

这个总分适合粗略排序，却可能做出错误的发布决定。

假设 Candidate 成功率提高 4 个百分点、成本下降 20%，但在 600 次 Trial 中出现一次未经授权的高风险写操作。线性加权很容易让前两项收益抵消事故，Candidate 仍然拿到高分。

真正的问题是：

> 这类事故是否允许被任何数量的低风险收益补偿？现有证据是否足以承担上线后的残余风险？

发布决策应分成两类：

- **约束问题**：什么情况绝不能上线？
- **优化问题**：在所有合格方案中，哪个更符合产品目标？

本文承接[重复 Trial](./agent-evaluation-with-repeated-trials.md)和[公平比较两个 Agent](./fair-comparison-of-agent-variants.md)，把实验结果转换成可审计的 Scorecard 与 Release Gate。

## 核心原则

1. **先判断证据是否有效，再判断性能是否达标。**
2. **先执行不可补偿的硬门槛，再比较可权衡目标。**
3. **保留单位、分母、分群和不确定性。**
4. **发布规则必须在看到结果前声明。**
5. **离线通过只允许进入下一阶段，不等于永久安全。**

可以把判断写成：

~~~text
Candidate is eligible only if

  evidence_is_sufficient
  AND all_hard_gates_pass
  AND regression_budgets_are_not_exhausted
  AND residual_risk_is_accepted
  AND monitoring_and_rollback_are_ready

Soft objectives rank only eligible candidates.
~~~

## 为什么单一总分会误导

### 不同维度没有天然兑换率

~~~text
一次严重越权
  ≈ 多少毫秒延迟？
  ≈ 多少美分成本？
  ≈ 多少普通 Case 的成功？
~~~

如果团队无法给出有意义、稳定且可审计的兑换关系，就不应把它们直接放入线性总分。

通常不可补偿的约束包括：

- 未授权或不可逆副作用；
- 隐私、合规与权限边界；
- 高风险任务的最低能力；
- 评测证据完整性；
- 已知 Critical Regression 不得重现；
- 缺少监控、Kill Switch 或回滚能力。

### 平均值隐藏分布形状

总体成功率可能掩盖高风险 Segment 的明显退化；平均延迟可能掩盖超时和 p99；平均成本可能被少量超高成本 Trial 主导；安全分数可能隐藏唯一一次 Critical Incident。

因此要同时报告：

- Overall 与预声明 Segment；
- p50、p95、p99 和超时率；
- 事件类型、严重度和机会分母；
- 证据 Coverage；
- 置信区间或单侧上界。

### 权重变化会让排名翻转

归一化范围、历史极值或主观权重一变，总分排序也可能改变。总分隐藏了价值判断，却给人一种“客观数学结果”的错觉。

## Metric Contract：每个数字先有语义

一项可用于 Gate 的指标至少要声明：

| 字段 | 问题 | 示例 |
| --- | --- | --- |
| `id` | 稳定身份是什么？ | `task_success_case_macro` |
| `population` | 对哪些 Case / Trial？ | 共同完整的配对 Case |
| `numerator` | 分子是什么？ | `PASS` Trial |
| `denominator` | 分母是什么？ | 有 Task Outcome 的 Trial |
| `aggregation` | 如何聚合？ | Case-macro |
| `direction` | 越高越好还是越低越好？ | higher is better |
| `cluster_unit` | 哪些观测相关？ | `case_id` |
| `missing_policy` | 缺失如何处理？ | 保留在 Coverage 分母 |
| `uncertainty` | 区间如何计算？ | paired case cluster bootstrap |
| `owner` | 谁解释和维护？ | Evaluation Owner |
| `version` | 定义何时变化？ | `metric.task-success/v4` |

改变分母、聚合、Segment 权重或缺失策略，指标语义就变了，应升级版本而不是继续画在同一条历史曲线上。

## 状态需要三条正交轴

Task Outcome、非任务状态和单项 Metric 的证据状态不能塞进一个枚举：

~~~yaml
trial_result:
  task_outcome: PASS | PARTIAL | FAIL | null
  non_task_status: GRADER_ERROR | INFRA_ERROR | UNSCORABLE | CANCELLED | null

metric_result:
  evidence: SCORABLE | UNSCORABLE | NOT_APPLICABLE
~~~

规则是：

- Task Outcome 与非任务状态互斥；
- Agent 自身超时、崩溃或预算耗尽，如果属于被测系统责任，应是 `FAIL`；
- `NOT_APPLICABLE` 只表示某个 Metric 没有评价机会，不改变 Trial Outcome；
- 同一 Trial 可在 Safety 上 `SCORABLE`、在 Handoff 上 `NOT_APPLICABLE`、在开放质量上 `UNSCORABLE`。

由此可以分别计算：

~~~text
execution_coverage
  = attempted_trials / eligible_trial_slots

task_outcome_coverage
  = trials_with_task_outcome / attempted_trials

metric_evidence_coverage(m)
  = SCORABLE(m) / [SCORABLE(m) + UNSCORABLE(m)]

proven_success_yield
  = PASS_trials / eligible_trial_slots
~~~

`NOT_APPLICABLE` 不进入该 Metric 的 Coverage 分母，因为本来就没有评价机会；但 Trial 仍进入其他适用指标。

## 八个核心维度

### Success：任务有没有完成

建议同时报告：

- `PASS / PARTIAL / FAIL`；
- Case-macro 成功率；
- Overall 与关键 Segment；
- Candidate 相对 Baseline 的配对差值；
- Task Outcome Coverage。

不要把 Quality、Cost 或 Latency 混入 Success，否则“成功”的含义会随权重变化。

### Reliability：能否持续成功

可靠性可包括：

- 同一 Case 的预声明 Trial 全部成功比例；
- Case 内结果方差；
- 超时、循环和非确定失败率；
- 不同时间窗口与环境副本的一致性；
- 最差 Case 与最差 Segment。

允许自动重试的离线工作与一次性、不可逆操作需要不同可靠性指标。

### Quality：成功以后做得多好

开放产物适合拆成原子 Rubric，例如正确性、覆盖度、清晰度、证据质量和可维护性。

若等级是：

~~~text
UNACCEPTABLE < ADEQUATE < STRONG < EXCELLENT
~~~

相邻等级未必等距，不应编码成 1–4 后报告“平均质量 3.2”。更合适的是：

- 完整类别分布；
- `at_least_ADEQUATE_rate`；
- 配对 Case 的 `win / tie / loss`；
- Judge `UNSCORABLE` 与人审校准结果；
- 所有 Task Outcome 与仅 `PASS` Trial 的两套分布，检查幸存者偏差。

### Safety：有没有越过不能越过的边界

Safety 不应只有一个 0–100 分：

~~~text
Safety
├── critical incident count
├── high-severity incident rate
├── unauthorized action by type
├── guardrail catch rate
├── false block rate
├── safe failure rate
├── recovery success rate
└── residual risk and uncertainty
~~~

每项要有机会分母。零观测要报告单侧上界，不能写成“风险为零”。

### Cost：完成真实工作花多少资源

至少拆开：

~~~text
portfolio_cost_per_success
  = sum(cost of all attempted Trials) / count(PASS)

successful_trial_cost_distribution
  = p50 / p95 / maximum among PASS Trials
~~~

前者是 Ratio of Sums，保留失败和重试成本；后者描述成功路径有多贵。不能把每个 Case 的比率取平均，也不能只看成功 Trial 后声称整体变便宜。

### Latency：用户真正等待多久

区分端到端时间、首个有用动作、模型时间、工具时间、审批等待与恢复时间。

不能删除超时 Trial 后报告 p95。若超过 5% 的 Trial 在超时阈值被右删失，把阈值当完成时间得到的经验 p95 只是实际 p95 的下界，应明确标为 `latency_p95_lower_bound`，或采用处理删失的方法。

### Tool Calls：调用是否有效

同时看：

- 每次尝试调用数；
- Portfolio 每成功调用数；
- 成功 Trial 的 p50/p95；
- 重复、空操作和失败调用；
- 高风险调用；
- 无证据调用与不必要重试。

工具调用更少只有在 Success、Safety 和 Quality 不退化时才是改善。

### Human Intervention：人类参与是保护还是负担

人工介入不是天然越少越好，应拆成：

- `required_handoff_recall`；
- `unnecessary_handoff_rate`；
- `human_override_rate`；
- `time_to_safe_handoff`；
- Agent 能力不足导致的接管；
- 规范要求的审批。

## Gate 先检查证据，再检查性能

建议至少有四种结果：

| 结果 | 含义 | 下一步 |
| --- | --- | --- |
| `release` | 所有必需证据和门槛通过 | 进入下一阶段 |
| `block` | 明确违反硬门槛 | 修复并重评 |
| `review` | 落入预声明灰区 | 风险负责人复核 |
| `insufficient_evidence` | 样本、Coverage 或精度不足 | 补充证据 |

Evidence Gate 示例：

~~~yaml
evidence_gate:
  minimum_execution_coverage_lcb: 0.99
  minimum_task_outcome_coverage_lcb: 0.96
  minimum_metric_evidence_coverage_lcb: 0.95
  minimum_paired_cases: 180
  maximum_primary_delta_ci_width_pp: 6
  on_precision_fail: insufficient_evidence
~~~

点估计达标但区间过宽时，结果应是 `insufficient_evidence`，不是 `release`。

## 越低越好的指标要使用 UCB

对成功率等越高越好的指标，可以检查 Candidate 的绝对 LCB 和配对差值 LCB。对成本、延迟等越低越好的指标，应检查 Candidate 的绝对 UCB 和方向正确的差值界限：

~~~yaml
efficiency_budget:
  portfolio_cost_per_success:
    candidate_ucb_95_maximum: 0.40
    maximum_relative_regression: 0.15
  latency_p95_ms:
    candidate_ucb_95_maximum: 20000
    maximum_relative_regression: 0.10
~~~

只比较点估计会在不确定性很大时误放行。

## Hard Gate 与 Regression Budget

### Hard Gate

适合不可补偿风险：

~~~yaml
critical_safety_gate:
  confirmed_critical_incident_count_maximum: 0
  forbidden_action_count_maximum: 0

high_risk_capability_gate:
  candidate_success_lcb_95_minimum: 0.82
  paired_delta_noninferiority_margin: -0.02
~~~

### Regression Budget

适合可以有限取舍的退化：

~~~yaml
regression_budget:
  overall_success_pp: -1
  quality_at_least_adequate_pp: -2
  portfolio_cost_relative: 0.15
  latency_p95_relative: 0.10
~~~

Budget 必须说明：

- 相对哪个 Baseline；
- Overall 与关键 Segment 是否分别检查；
- 点估计还是置信界；
- 何时重置；
- 临时例外的 Owner、理由与到期日。

## Pareto Frontier 先于主观加权

所有 Hard Gate 通过后，可以把指标方向统一为“越大越好”。若方案 A 在每个目标上都不差于 B，并至少一个目标更好，则 A 支配 B。

Pareto Frontier 能先删除全面更差的方案，让真正的权衡显现。但它不能替代安全门槛，也不能忽略不确定性。

统计化的 Dominance 至少要求：

1. 在同一配对 Case 总体上计算各维度差值；
2. 统一方向；
3. 对同时判断的维度使用 Simultaneous Confidence Intervals 或预声明多重校正；
4. 所有维度的差值下界不低于各自非劣界；
5. 至少一个维度的下界超过实质改善阈值。

否则应标记 `dominance_uncertain`。

## Release Gate 是分阶段控制链

### 阶段 0：政策与可回滚性

- Evaluation Contract 与 Metric Contract 已冻结；
- 风险等级和禁止行为已定义；
- Baseline/Candidate Manifest 完整；
- Gate、缺失策略和 Segment 已预注册；
- Feature Flag、Kill Switch、回滚路径可用；
- Decision Owner、Risk Owner、On-call 已指定。

### 阶段 1：Preflight

- Schema 和配置有效；
- 工具、权限与 Manifest 一致；
- 禁止能力未被启用；
- Grader 校准、Fixture 和环境自检通过。

### 阶段 2：Offline Holdout

- Evidence Gate；
- Critical Safety Gate；
- 最低能力和关键 Segment 非劣；
- 质量门槛；
- 成本、延迟和人工介入 Budget。

### 阶段 3：Shadow

Shadow 不执行真实外部副作用，但需要最小证据：

~~~yaml
shadow:
  minimum_duration_hours: 48
  maximum_duration_hours: 168
  minimum_evaluable_cases: 1000
  minimum_high_risk_opportunities: 100
  on_max_duration_without_minimum_evidence: insufficient_evidence
~~~

### 阶段 4：Canary 与渐进放量

~~~yaml
canary:
  traffic_percent: 1
  minimum_duration_hours: 24
  maximum_duration_hours: 72
  minimum_evaluable_cases: 500
  minimum_high_risk_opportunities: 50

progressive_rollout:
  traffic_steps_percent: [5, 20, 50, 100]
  minimum_observation_hours_per_step: 24
  minimum_evaluable_cases_per_step: 1000
  on_evidence_shortfall: insufficient_evidence
~~~

最大时长只是防止阶段无限悬挂，不是“时间到了自动通过”。

## Rollback 条件必须机器可执行

~~~yaml
rollback:
  trigger_any:
    - confirmed_critical_incident_count > 0
    - forbidden_action_count > 0
    - high_risk_success_delta_pp < -2
    - required_handoff_recall < 0.99
    - online_error_budget_remaining <= 0
  actions:
    - disable_candidate_feature_flag
    - route_new_tasks_to_baseline
    - cancel_uncommitted_high_risk_actions
    - preserve_trace_and_audit_evidence
    - verify_baseline_health
  maximum_time_to_containment_minutes: 10
~~~

Rollback 演练本身也是发布前 Gate。如果无法证明切换确实生效，纸面 Runbook 不够。

## 一个完整但紧凑的 Scorecard

~~~yaml
scorecard:
  comparison_population: common_paired_cases
  cluster_unit: case_id
  multiplicity: holm_for_confirmatory_gates

  evidence:
    task_outcome_coverage:
      candidate_lcb_95: 0.973
      minimum: 0.96
    paired_cases:
      count: 190
      minimum: 180

  success:
    overall_case_macro:
      baseline: 0.842
      candidate: 0.864
      candidate_lcb_95: 0.843
      paired_delta_ci_95: [0.001, 0.043]
    high_risk:
      baseline: 0.900
      candidate: 0.850
      candidate_lcb_95: 0.800
      paired_delta_ci_95: [-0.090, -0.010]

  safety:
    critical_incidents:
      baseline: 0
      candidate: 1
      tolerance: 0

  quality:
    at_least_adequate:
      baseline: 0.92
      candidate: 0.94
      candidate_lcb_95: 0.90
    paired_win_tie_loss: [52, 118, 20]

  efficiency:
    portfolio_cost_per_success:
      baseline: 0.31
      candidate: 0.24
      candidate_ucb_95: 0.27
    latency_p95_ms:
      baseline: 14200
      candidate: 15700
      candidate_ucb_95: 16800

decision:
  result: block
  reasons:
    - one_confirmed_critical_incident
    - high_risk_absolute_lcb_below_minimum
    - high_risk_noninferiority_failed
~~~

这个结构刻意没有 `total_score`。Candidate 在 Overall、Quality 和成本上更好，仍因 Critical Incident 与高风险能力回归被阻断。

## 常见错误

### 把缺失证据当 PASS 或 FAIL

这会混淆能力与测量系统可靠性。先用 Coverage Gate，再看性能。

### 只给 Overall

总体改善可能同时伴随高风险 Segment 退化。

### 把有序 Rubric 当等距分数

未经校准的等级平均值没有稳定产品含义。

### 对低值更好的指标只看点估计

应使用 UCB 或方向统一后的置信界。

### Shadow 跑够七天就自动放行

如果没有足够可评 Case 和高风险机会，结果是 `insufficient_evidence`。

### 用 Pareto Frontier 绕过安全门槛

数学上的非支配方案仍可能包含不可接受事故。Hard Gate 必须先执行。

## 落地产物

~~~text
agent-eval/
├── metrics/metric-contracts.yaml
├── scorecards/release-scorecard.yaml
├── policies/regression-budget.yaml
├── policies/release-gates.yaml
├── policies/rollback.yaml
├── reports/release-decision.md
└── dashboards/production-guardrails.json
~~~

下一部分进入生产反馈闭环：先讨论[如何把一次真实失败还原、脱敏并转化为 Regression Case](./production-failure-to-regression-case.md)。

## 适用边界

- Gate 阈值是产品与治理决策，不由统计方法自动生成。
- 罕见严重风险可能需要远大于普通 Eval 的证据规模。
- 离线 Dataset 不覆盖未知任务、对抗行为和持续分布漂移。
- 高后果用途即使离线通过，也可能不适合完全自动化。
- 多重校正方法、区间和抽样单位必须与真实实验设计一致。
- 本文提供工程框架，不替代适用法规、审计或领域专家判断。

## 公开参考

- [NIST：Artificial Intelligence Risk Management Framework 1.0](https://doi.org/10.6028/NIST.AI.100-1) — 风险测量、不确定性、风险容忍度与全生命周期治理。
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — 生产监控、用户反馈、事故响应、恢复与变更管理。
- [Mitchell et al.：Model Cards for Model Reporting](https://doi.org/10.1145/3287560.3287596) — 报告用途、性能切片、限制和评测背景。
- [Hanley and Lippman-Hand：If Nothing Goes Wrong, Is Everything All Right?](https://doi.org/10.1001/jama.1983.03330370053031) — 零事件样本的风险上界。
- [Deb et al.：A Fast and Elitist Multiobjective Genetic Algorithm: NSGA-II](https://doi.org/10.1109/4235.996017) — 非支配排序和多目标优化。
- [Google SRE：Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) — 以可测目标连接用户期望与工程决策。
- [Google SRE Workbook：Example Error Budget Policy](https://sre.google/workbook/error-budget-policy/) — 用预算把可靠性与发布节奏连接起来。
- [Google SRE Workbook：Canarying Releases](https://sre.google/workbook/canarying-releases/) — Canary 的分阶段证据与自动回滚思想。
- [Google SRE：Release Engineering](https://sre.google/sre-book/release-engineering/) — 一致、可审计和可回滚的发布流程。
