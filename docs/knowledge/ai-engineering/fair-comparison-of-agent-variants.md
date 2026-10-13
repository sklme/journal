---
title: 如何公平比较两个 Agent
date: 2026-10-13
tags:
  - Agent Evaluation
  - A/B Testing
  - Experiment Design
  - Statistics
description: 用配对 Case、受控变量、随机化执行和预声明分析，判断两个 Agent 的差异是否来自修改本身
---

# 如何公平比较两个 Agent

## 要解决的问题

团队经常在一次修改后得到这样的结果：

~~~text
Baseline：72% 成功率
Candidate：79% 成功率
~~~

这 7 个百分点可能来自真正的能力提升，也可能来自：

- Candidate 恰好拿到了更容易的 Case；
- 两边的模型、Prompt、工具、预算和环境同时变化；
- Candidate 多跑了几次，只保留最好结果；
- 执行顺序让后一方复用了缓存或避开了资源拥塞；
- Grader 知道版本身份或总把 Candidate 放在 Pairwise Judge 的第二个位置；
- 无效运行在两边被不同方式排除；
- 只挑对 Candidate 有利的 Segment 汇报。

统计检验不能补救一个不公平的实验。比较的起点是一份 **Comparison Contract**：在看到结果前冻结比较对象、变化变量、配对单位、执行顺序、无效运行、分析方法与决策阈值。

本文承接[重复 Trial 协议](./agent-evaluation-with-repeated-trials.md)，重点回答：两个版本之间的差异是否可归因、可复算，并且足以改变发布决定？

## 先定义比较想推广到哪里

“B 比 A 好”不是完整命题。至少要声明一种 Scope：

| Scope | Estimand | 结论边界 |
| --- | --- | --- |
| 固定回归 Suite | 指定 Case 清单上的平均配对差值 | 只对这批 Case 有效 |
| 目标任务总体 | 从任务总体抽样后的期望差值 | 依赖抽样框、分层和权重 |
| 线上目标人群 | 真实流量上的产品效应 | 需要线上随机化和 Guardrail |

固定 Safety Suite 常是一份风险清单，不是随机样本。一次 Critical Failure 就可能阻断发布，不能用总体平均把它稀释。

示例 Contract：

~~~yaml
comparison_id: agent-search-policy-v3

scope:
  type: fixed_release_regression_set
  dataset_version: research-core-v5
  cases: 120
  case_weighting: equal

estimand:
  primary: >-
    majority_pass_3_case_rate(candidate)
    - majority_pass_3_case_rate(baseline)
  unit: percentage_point

decision:
  practical_improvement_pp: 3
  primary_ci_lower_pp_must_exceed: 0
  critical_safety_failures_candidate: 0
  cost_relative_increase_upper_95_ci_maximum: 0.20
~~~

阈值是结构示例，不是通用推荐值。真实数值应来自用户价值、迁移成本和风险容忍度。

## 变化变量必须被枚举

一次实验可能改变：

~~~text
Model
Prompt
Context Strategy
Tool Set
Workflow
Budget
Retrieval Index
Guardrail
Agent Harness
~~~

若同时更换模型、Prompt、工具和预算，实验可以回答“整个 Bundle 是否更好”，却不能把提升归因给其中一个组件。

Manifest 应同时记录共享变量和变化变量：

~~~yaml
variants:
  baseline:
    bundle_digest: sha256:<BASELINE_DIGEST>
  candidate:
    bundle_digest: sha256:<CANDIDATE_DIGEST>

declared_changes:
  - context_selection_policy

controlled_variables:
  dataset_version: research-core-v5
  model_id: <MODEL_ID>
  prompt_digest: sha256:<PROMPT_DIGEST>
  tool_bundle_digest: sha256:<TOOL_DIGEST>
  token_budget: 32000
  wall_clock_budget_seconds: 180
  grader_bundle_digest: sha256:<GRADER_DIGEST>
~~~

做不到一次只改一个变量时，应把 Candidate 视为新的系统 Bundle，并把消融实验作为后续诊断，而不是强行讲单因素因果故事。

## 为什么要使用配对设计

Agent Case 的难度差异通常远大于版本之间的微小改进。让 A 和 B 在同一批 Case 上运行，可以用每个 Case 自己作为控制：

~~~text
Case 001: A → outcome_A_001, B → outcome_B_001
Case 002: A → outcome_A_002, B → outcome_B_002
...
~~~

对每个 Case 先计算：

~~~text
delta_i = metric_B_i - metric_A_i
~~~

再聚合 `delta_i`，通常比把 A、B 当成两个独立样本更有统计效率，也能直接检查哪些 Case 从 Pass 变 Fail。

### Execution Pair 不等于 Analysis Unit

假设 120 个 Case，每个版本每个 Case 运行 3 个 Trial：

~~~text
Execution Pair
  = case_id × trial_index × scenario_id 的 A/B 对照执行

数量 = 120 × 3 = 360

Analysis Unit
  = 聚合三个 Trial 后的 Case

数量 = 120
~~~

Execution Pair 用于调度、环境匹配和追溯；Analysis Unit 决定样本量、标准误和主要检验。不能把 360 个相关 Trial Pair 声称为 360 个独立 Case。

## 执行顺序也要随机化

如果永远先跑 A 再跑 B，B 可能受益或受损于：

- 热缓存与预热连接；
- 数据更新和时间漂移；
- 资源拥塞；
- 限流和配额消耗；
- 前一 Trial 遗留的状态。

可以在每个 Case × Trial Block 内随机选择 `AB` 或 `BA`：

~~~yaml
execution:
  pair_key: [case_id, trial_index, scenario_id]
  order_randomization:
    choices: [AB, BA]
    seed: 65537
  environment_reset: before_each_trial
  isolate_pair_resources: true
~~~

顺序 Seed 用于复现调度，不等于给两个不同模型传同一个生成 Seed。

## Common Random Numbers 只固定有共同语义的随机性

配对实验可以给两边提供相同的外生场景，例如：

- 同一用户模拟脚本；
- 同一网络故障时间表；
- 同一搜索结果快照；
- 同一 Fixture 变体；
- 同一工具返回噪声。

这类 Common Random Numbers 能减少环境差异。但如果不同模型对 `seed` 的定义、采样器或版本不同，“相同模型 Seed”未必产生可比较随机性，不能把它当作公平性的充分条件。

## 多 Trial 如何变成 Case Outcome

示例使用 `majority_pass_3`：三个预声明 Trial 中至少两个 `PASS`。

~~~yaml
case_outcome:
  name: majority_pass_3
  definition: at_least_two_of_three_prespecified_trials_are_PASS
  binary_mapping:
    PASS: 1
    PARTIAL: 0
    FAIL: 0
~~~

它只是一个协议级事件，不证明某个 Case 的潜在单次成功概率 `p >= 2/3`。三个观测不足以支持这样的参数分类。

还可以根据产品语义选择：

- Case 内平均成功率；
- `pass@k`；
- `pass^k`；
- 最坏 Trial；
- 成本、延迟或质量的 Case 内聚合。

规则必须在看结果前冻结。

## 无效运行必须对两边对称

建议分开记录：

~~~yaml
agent_outcomes: [PASS, PARTIAL, FAIL]
non_task_status:
  - GRADER_ERROR
  - INFRA_ERROR
  - UNSCORABLE
  - CANCELLED
~~~

典型边界：

| 事件 | 状态 | 是否代表 Variant 失败 |
| --- | --- | --- |
| Agent 自身崩溃或超出任务预算 | `FAIL` | 是 |
| Harness 未提供声明资源 | `INFRA_ERROR` | 否 |
| Grader 解析器 Bug | `GRADER_ERROR` | 否 |
| 可信采集器丢失必要证据 | `UNSCORABLE` 或 `INFRA_ERROR` | 否，需 Reason Code |
| Agent 没生成要求的文件 | `FAIL` | 是 |
| 外部调度取消 | `CANCELLED` | 否 |

补跑应以完整 Execution Pair 为单位，使用同一规则处理 A/B，并限制最大次数。只补跑 Candidate 的失败会破坏配对与公平性。

## 二元结果：先看不一致 Pair

对 Case 级 Pass/Fail，可构造：

| | B Pass | B Fail |
| --- | ---: | ---: |
| A Pass | both_pass | a_only |
| A Fail | b_only | both_fail |

改进信息主要来自 `b_only` 与 `a_only`：

~~~text
absolute_delta
  = (b_only - a_only) / total_pairs
~~~

[McNemar 检验](https://doi.org/10.1007/BF02295996)关注不一致 Pair 的方向是否对称。当不一致 Pair 很少时，应预先声明使用 Exact McNemar，而不是大样本近似。

但 McNemar：

- 不给出产品效应是否足够大的答案；
- 不处理成本、延迟等连续指标；
- 不替代效应区间；
- 不检查 Safety Hard Gate。

在本文模板中，它只作为方向性辅助，发布决策使用效应区间、成本上界和独立安全门槛。

## 配对 Bootstrap 的层级必须匹配 Estimand

### 固定 Suite：Case 固定，只重采样 Case 内 Trial

若主 Estimand 是固定 120 个回归 Case 在未来按同一协议重放时的差值，Case 身份不参与抽样：

~~~text
每次 Bootstrap：
  对每个固定 Case：
    共同重采样该 Case 的 A/B Trial Pair
    重新计算 A、B 的 Case Outcome
    保存 Case Delta
  对全部固定 Case 的 Delta 求平均
~~~

最小 TypeScript 骨架：

~~~ts
type TrialPair = { passedA: boolean; passedB: boolean }
type FixedCase = { caseId: string; pairs: TrialPair[] }

function majority(values: boolean[]): number {
  return values.filter(Boolean).length >= Math.floor(values.length / 2) + 1 ? 1 : 0
}

function fixedSuiteDelta(cases: FixedCase[], random: () => number): number {
  const deltas = cases.map((item) => {
    const sampled = Array.from(
      { length: item.pairs.length },
      () => item.pairs[Math.floor(random() * item.pairs.length)]
    )
    return majority(sampled.map((pair) => pair.passedB))
      - majority(sampled.map((pair) => pair.passedA))
  })
  return deltas.reduce((sum, value) => sum + value, 0) / deltas.length
}
~~~

Trial 很少时区间会离散；应增加预声明 Trial 数或使用经过诊断的配对分层模型，不能偷偷把 Case 当成新抽样单位。

### 任务总体：共同重采样完整 Case

如果 Case 是从未来目标任务总体抽出的样本，才应共同重采样完整 Case Cluster。若还要表达新任务和新 Trial 两层随机性，可使用两阶段 Hierarchical Bootstrap。

因此报告要明确：

~~~yaml
primary_interval:
  estimand: fixed_release_suite_delta
  method: fixed_suite_paired_trial_bootstrap
  fixed_unit: case_id
  resample_unit: execution_pair_within_case

sensitivity_interval:
  estimand: target_task_population_delta
  method: paired_case_cluster_bootstrap
~~~

两种区间回答不同问题，不能选择更好看的一个作为结论。

## 成本、延迟与质量需要自己的效应量

| 指标 | 推荐主要效应 | 补充报告 |
| --- | --- | --- |
| 成功 | 绝对百分点差 | 相对风险、不一致 Pair |
| 成本 | Portfolio 每成功成本的配对相对变化 | 每次尝试成本、成功 Trial 分布 |
| 延迟 | 端到端分位数差或相对变化 | 超时率、右删失说明 |
| 有序质量 | 达标率差、win/tie/loss | 完整类别分布 |
| 工具调用 | Portfolio 每成功调用数 | 重复、失败、高风险调用 |

失败可能提前结束，因此 Candidate 更差却看起来更便宜、更快。效率指标必须与成功、质量和安全共同解释。

## Judge 必须盲化并随机位置

如果 LLM Judge 知道 Variant 名称、模型供应商或“新版本”身份，评判会受到先验影响。Pairwise Judge 还可能有位置偏差。

~~~yaml
judge:
  variant_identity: hidden
  provider_model_prompt_identity: hidden
  pairwise_position_randomization:
    orders: [AB, BA]
    seed: 65539
  aggregation_policy: dual_order_consistency
  abstention_allowed: true
~~~

Judge 校准集、版本、Prompt 和推理参数也是实验 Manifest 的一部分。

## 样本量应在实验前规划

配对二元检验的功效主要取决于不一致 Pair，而不是两个边际成功率。建议用全链路模拟：

1. 声明预期的 `a_only`、`b_only`；
2. 模拟每个 Case 的多 Trial Outcome；
3. 注入预计无效 Pair；
4. 执行正式的 Case 聚合、区间和 Gate；
5. 统计在目标效应下作出正确决策的比例；
6. 选择 Case 数并预留无效率；
7. 禁止看到结果后为追求显著而扩样。

多个确认性指标还需要预声明 Hypothesis Family 和多重比较策略。探索性切片必须标为探索结果，不能在结果出来后升级成原计划门槛。

## 一份完整的 Comparison Manifest

~~~yaml
experiment:
  id: context-policy-v3-vs-v2
  hypothesis: candidate improves majority_pass_3 on the fixed release suite

scope:
  type: fixed_release_regression_set
  dataset_version: research-core-v5
  cases: 120
  trials_per_case: 3

execution:
  execution_pair_key: [case_id, trial_index, scenario_id]
  order_randomization: [AB, BA]
  environment_reset: before_each_trial
  cache_policy: cold

evaluation:
  contract_version: eval-contract-v4
  case_outcome: majority_pass_3
  grader_bundle_digest: sha256:<GRADER_DIGEST>
  judge_blinded: true

analysis:
  planned_execution_pairs: 360
  planned_analysis_units: 120
  primary_interval:
    method: fixed_suite_paired_trial_bootstrap
    resample_variants_together: true
    resamples: 10000
  binary_auxiliary_test: exact_mcnemar
  target_population_sensitivity: paired_case_cluster_bootstrap

guardrails:
  critical_safety_failures:
    candidate_maximum: 0
  p95_cost_per_case_relative_change:
    upper_one_sided_95_ci_maximum: 0.20

invalid_runs:
  rerun_entire_execution_pair: true
  maximum_reruns: 1
  reason_code_required: true

stopping:
  early_stopping: none
  protocol_change_requires_new_experiment: true
~~~

## 决策不应只看 p 值

一个可执行的结果可分为：

~~~text
RELEASE
  主效应达到实用阈值
  AND 区间排除无改善
  AND 所有 Hard Gate 通过
  AND Guardrail 未超预算

HOLD
  证据不足或软 Guardrail 失败

REJECT
  Critical Gate 失败或确认性能力门槛失败
~~~

报告示例：

> Candidate 在固定回归集上的三次多数通过率比 Baseline 高 6 个百分点，固定 Case、Case 内共同重采样 Trial Pair 得到的 95% 区间为 +1 到 +11 个百分点。辅助 Exact McNemar 显示迁移方向不对称。但成本相对变化的单侧 95% 上界为 +24%，超过预声明的 +20% Guardrail，因此本次决定为 HOLD。

这句话同时交代 Scope、效应、区间、辅助检验、失败门槛和决定，比“B 显著优于 A”更可复核。

## 常见错误

### 两边使用不同 Case

难度差异会与版本效应混杂，失去配对优势。

### 永远先跑 Baseline

时间、缓存和资源效应会与 Variant 身份绑定。

### 把 360 个 Trial Pair 当成 360 个独立 Case

这会产生 Pseudoreplication，使标准误过小。

### 只保留每个版本的最好 Trial

这改变了被测产品策略。除非产品真的会运行多次并选择最佳结果，否则不能这样比较。

### 用普通 McNemar 检验非劣界或成本

零差异检验不能自动回答 `-2pp` 非劣命题，也不能处理 p95 成本。每个 Gate 都要有匹配的估计量和区间。

### 用 `p > 0.05` 宣称不退化

“没有检出差异”不是“已经证明非劣”。非劣需要预声明 Margin 和方向正确的区间或检验。

## 落地产物

~~~text
agent-eval/
├── experiments/comparison-contract.yaml
├── experiments/run-plan.json
├── statistics/fixed-suite-paired-trial-bootstrap.ts
├── statistics/paired-case-cluster-bootstrap.ts
├── statistics/power-simulation.ts
├── policies/invalid-execution-pair.yaml
└── reports/variant-comparison.md
~~~

下一篇[《不要把所有维度压成一个总分》](./multi-dimensional-agent-scorecards-and-release-gates.md)会把比较结果转换为多维 Scorecard、Release Gate 和分阶段发布策略。

## 适用边界

- 固定 Suite 的结论不自动推广到未来任务总体。
- 配对设计要求两边面对等价初始条件；有状态产品需要把完整策略定义成 Trial。
- Common Random Numbers 只适用于两边具有相同语义的外生随机变量。
- 极少 Case、极少不一致 Pair 或重尾指标需要专门方法和敏感性分析。
- 线上 A/B Test 还要处理用户随机化、干扰、长期效应和真实业务 Guardrail。
- 统计显著不代表值得发布，产品阈值也不能从观测结果倒推。

## 公开参考

- [McNemar：Note on the Sampling Error of the Difference Between Correlated Proportions or Percentages](https://doi.org/10.1007/BF02295996) — 成对二元比例比较的原始论文。
- [Efron：Bootstrap Methods—Another Look at the Jackknife](https://doi.org/10.1214/aos/1176344552) — Bootstrap 重采样方法的基础论文。
- [Koehn：Statistical Significance Tests for Machine Translation Evaluation](https://aclanthology.org/W04-3250/) — 同一测试集上比较系统的 Paired Bootstrap 示例。
- [Holm：A Simple Sequentially Rejective Multiple Test Procedure](https://doi.org/10.2307/4615733) — 控制 Family-Wise Error 的逐步方法。
- [Nosek et al.：The Preregistration Revolution](https://doi.org/10.1073/pnas.1708274114) — 预注册、确认性分析与探索性分析的边界。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 评测设计、人工标签校准和 Pairwise 比较偏差。
- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Agent Eval 的 Trial、Grader、Harness、重复运行与长期维护实践。
