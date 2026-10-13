---
title: Agent 是随机的：一次成功说明不了什么
date: 2026-10-13
tags:
  - Agent Evaluation
  - Reliability
  - Statistics
  - Experiment Design
description: 用重复 Trial、pass@k、pass^k、置信区间和完整运行对账，把一次偶然结果变成可解释的 Agent 可靠性证据
---

# Agent 是随机的：一次成功说明不了什么

## 要解决的问题

同一个 Agent、同一个任务、同一份代码，重新运行一次也可能得到不同结果：

- 第一次找到正确工具，第二次选错入口；
- 第一次在预算内完成，第二次陷入无效重试；
- 第一次给出有依据的结论，第二次遗漏关键证据；
- 第一次环境正常，第二次因为基础设施故障没有产生有效结果。

因此，“这个 Case 跑通了”只是一个观测，不等于“这个 Agent 能稳定完成这个 Case”。反过来，一次失败也未必足以证明修改造成了回归。

真正需要回答的是：

1. 我们重复的是同一个统计对象吗？
2. 一次运行中的随机性来自哪里？
3. 产品需要的是一次命中，还是每次都可靠？
4. 区间表达的是同一批 Case 的重放不确定性，还是对未来任务总体的推广不确定性？
5. 无效运行、严重事故和提前停止如何进入报告？

这篇文章把这些问题固化为一份 **Repeated Trial Protocol**。

## 先统一 Task、Case、Trial 与 Run

### Case 是稳定的评测题目

一个 Case 至少包含：

- 可见输入和初始环境；
- Evaluation Contract；
- 隐藏评分证据；
- Fixture 与环境版本；
- 风险等级和所属 Segment。

Case 不等于某次执行结果。同一个 Case 可以被不同 Agent、不同版本和不同随机条件反复执行。

### Trial 是一次独立尝试

Trial 是本文的最小结果单位：从声明的初始状态开始，Agent 在给定预算内执行一次，最后产生一个 Outcome、Trace 和终态。

内部模型调用、工具重试或子 Agent 调用仍属于同一个 Trial，除非产品明确把它们定义为用户可见的独立尝试。

建议统一使用以下终态：

~~~yaml
trial_status: PASS | PARTIAL | FAIL | GRADER_ERROR | INFRA_ERROR | UNSCORABLE | CANCELLED
failure_mode: unsupported_claim
status_reason: required outcome lacked trusted evidence
~~~

- `PASS / PARTIAL / FAIL` 是已经被有效判定的 Agent Outcome；
- Agent 自身崩溃、耗尽任务预算或超过 Agent Deadline，通常属于 `FAIL`；
- `GRADER_ERROR` 是 Grader 自身实现或执行异常；
- `INFRA_ERROR` 是 Harness、Fixture 或运行平台没有兑现协议；
- `UNSCORABLE` 表示 Case 或冻结证据无法被可靠评分；
- `CANCELLED` 表示外部调度取消。

后四类不能静默删除，也不能伪装成 Agent 失败。它们不进入能力指标分母，但必须进入 Trial Accounting 和 Coverage Gate。

### Run 必须带限定词

“Run”常被混用为：

- 一次 Trial；
- 一批 Trial 的 Evaluation Run；
- 一次 Baseline 与 Candidate 的 Experiment Run。

Schema 和报告中应优先写明确对象，例如 `trial_id`、`evaluation_run_id` 和 `experiment_id`。

## 重复 Trial 前先冻结协议

如果每次失败后都临时增加预算、换工具或补提示，得到的不是同一 Agent 的重复 Trial，而是一组不断变化的干预。

一份可复现协议至少应冻结：

~~~yaml
protocol_id: repeated-trial-v1

case_set:
  dataset_version: regression-suite-v7
  case_ids_digest: sha256:<CASE_SET_DIGEST>

agent:
  model: <MODEL_ID>
  prompt_digest: sha256:<PROMPT_DIGEST>
  tool_bundle_digest: sha256:<TOOL_DIGEST>

trial:
  planned_trials_per_case: 5
  agent_deadline_seconds: 180
  grader_deadline_seconds: 30
  token_budget: 32000
  environment_reset: before_each_trial
  cache_policy: cold
  seed_policy: independent_prespecified

outcome_mapping:
  PASS: 1
  PARTIAL: 0
  FAIL: 0
  excluded_from_capability_denominator:
    - GRADER_ERROR
    - INFRA_ERROR
    - UNSCORABLE
    - CANCELLED

stopping:
  fixed_sample: true
  safety_stop_on_critical_incident: true
~~~

还要区分三类 Deadline：

| Deadline | 责任边界 | 超时后的状态 |
| --- | --- | --- |
| Agent Deadline | 被测系统必须在产品预算内完成 | `FAIL` + `agent_deadline_exceeded` |
| Harness Deadline | 平台必须提供可用运行条件 | `INFRA_ERROR` |
| Grader Deadline | 冻结证据必须被正确评分 | `GRADER_ERROR` |

“超时”本身不是状态分类，责任边界才是。

## pass@1：一次随机尝试的成功概率

`pass@1` 应解释为：在协议声明的等价条件下，从该 Case 的 Trial 分布中随机执行一次，成功的概率是多少。

它不一定是日志中时间顺序上的“第一次”。如果首次尝试具有产品含义，例如用户没有自动重试机会，应另报 `first_attempt_success`，不要把两个概念混在一起。

对 Case `i`，运行 `n_i` 次有效 Trial，其中 `c_i` 次 `PASS`：

~~~text
p_hat_i = c_i / n_i

suite_macro_pass@1
  = mean_over_cases(p_hat_i)
~~~

先在 Case 内计算，再对 Case 求 Macro 平均，可以避免 Trial 较多的 Case 获得更大权重。若产品需要不同 Case 权重，权重必须在看结果前冻结。

## pass@k：多次机会中至少成功一次

`pass@k` 适合“允许独立尝试多次，只要一次成功就有价值”的产品：

- 并行生成多个候选，再由验证器选择；
- 低成本搜索允许多次采样；
- 用户明确拥有多个彼此独立的尝试机会。

若同一 Case 的单次成功概率为 `p_i`，并且 `k` 次 Trial 独立同分布：

~~~text
pass@k_i = 1 - (1 - p_i)^k
~~~

当已经观察 `n_i` 次 Trial、其中 `c_i` 次成功时，常用有限样本估计是：

~~~text
estimated pass@k_i
  = 1 - C(n_i - c_i, k) / C(n_i, k)
~~~

当 `n_i - c_i < k` 时，组合项为 0，估计值为 1。这个估计要求 `n_i >= k`。

## pass^k：同一语义请求的 k 次都成功

`pass^k` 回答相反的问题：如果用户期望每次运行都可靠，同一个 Case 的 `k` 个预声明 Trial 是否全部成功？

在同一 Case 内 Trial 独立同分布时：

~~~text
pass^k_i = p_i^k
~~~

从 `n_i` 个观测中估计联合成功概率，可以使用：

~~~text
estimated pass^k_i
  = C(c_i, k) / C(n_i, k)
~~~

`pass@k` 随 `k` 增大而上升，`pass^k` 通常随 `k` 增大而下降。例如 `p=0.75`：

~~~text
pass@3 = 1 - 0.25^3 = 0.984375
pass^3 = 0.75^3     = 0.421875
~~~

一个 Agent 可以“给三次机会几乎总能命中”，同时“连续重放三次全部正确的概率不足一半”。这不是矛盾，而是两个不同的产品契约。

### 可交换性不等于独立同分布

如果 Trial 共享缓存、记忆、限流、人工反馈或前一次结果，它们可能相关。即使结果顺序可交换，也不能自动把联合概率写成 `p_i^k`。

自适应重试应作为完整策略评测：

~~~text
用户请求
  ↓
首次尝试
  ↓ 失败后按策略修复
重试
  ↓
最终产品 Outcome
~~~

此时整个策略是一个 Trial，而不是把内部步骤伪装成独立样本。

## 不要用平均成功率直接推导 Suite 的 pass@k

假设两个 Case 的单次成功率分别是 0.9 和 0.1，Macro `pass@1` 是 0.5。

直接代入平均值会得到：

~~~text
1 - (1 - 0.5)^2 = 0.75
~~~

但正确的 Case Macro 是：

~~~text
[1 - (1 - 0.9)^2 + 1 - (1 - 0.1)^2] / 2
= (0.99 + 0.19) / 2
= 0.59
~~~

非线性指标必须先在 Case 内计算，再按声明权重聚合。

## 置信区间必须匹配推断目标

### 固定回归 Suite

如果结论只针对一份固定 Case 清单，Case 身份不是随机样本。问题是：未来按同一协议重新执行这些 Case，结果会怎样变化？

主不确定性应表达 Case 内 Trial 随机性，例如：

- 在每个固定 Case 内重采样 Trial；
- 重新计算 Case 指标；
- 保持全部固定 Case，再聚合 Suite 指标；
- 或使用带 Case 层级的模型。

不能一边声明“只针对固定清单”，一边把 Case 有放回抽样后把区间解释为同一清单的重放不确定性。

### 目标任务总体

如果 Case 是从目标任务总体抽出的样本，结论想推广到未来任务，则应重采样完整 Case Cluster，并保留 Case 内全部相关 Trial。

若设计本来就是多阶段抽样，可以使用与设计一致的 Hierarchical Bootstrap：先抽 Case，再在被抽中的 Case 内抽 Trial；分层与权重也必须保留。

### 二项区间不是万能答案

Wilson 区间适合独立二项观测所在的层级。把同一 Case 的多次 Trial 当成相互独立的大样本，会产生 Pseudoreplication，使区间虚假变窄。

报告必须写清：

~~~yaml
estimand: fixed_suite_macro_pass_at_1
independent_unit: case_id
within_case_trials: 5
uncertainty:
  method: fixed_suite_within_case_trial_bootstrap
  confidence_level: 0.95
  resamples: 10000
~~~

## 样本量要同时考虑 Case 数和 Trial 数

增加 Trial 与增加 Case 解决不同问题：

| 增加什么 | 主要改善 | 不能替代 |
| --- | --- | --- |
| 每 Case Trial 数 | Case 内随机性、pass@k、pass^k | 任务多样性 |
| Case 数 | 目标任务覆盖与总体推广 | 单个 Case 的可靠性估计 |

建议先声明最小可接受效应、目标区间宽度、关键 Segment 和预计无效率，再通过模拟规划：

1. 为 Case 生成异质成功概率；
2. 按计划 Trial 数采样；
3. 注入无效运行和相关性；
4. 执行与正式报告完全相同的聚合与区间算法；
5. 统计覆盖率、区间宽度和决策错误率；
6. 为无效 Trial 预留容量，但禁止看到结果后无限扩样。

## 提前停止会改变证据含义

出现严重安全事故时应立即停跑，但这不等于可以继续使用固定样本区间作确认性结论。

~~~yaml
stopping_event:
  reason: critical_safety_incident
  planned_trials: 1000
  completed_trials: 163
  confirmatory_status: INCOMPLETE
  descriptive_results_only: true
~~~

如果需要在任意时间查看并可能停止，应预先采用序贯设计、Alpha Spending 或 Confidence Sequence。不能一边反复偷看，一边保留固定样本 p 值的原始解释。

## 严重事故不能被平均分抵消

可以为普通失败建立诊断严重度：

| 等级 | 示例 | 聚合方式 |
| --- | --- | --- |
| S1 | 表达瑕疵 | 质量分布 |
| S2 | 可恢复任务失败 | 失败率、恢复率 |
| S3 | 明显能力回归 | 独立 Segment 与回归预算 |
| S4 | 越权、不可逆副作用或严重隐私事故 | 独立 Hard Gate |

S4 不应先乘权重再混入平均损失。应单独报告机会数、事件数、单侧风险上界和阻断结果。

若 `n` 个近似独立机会中观察到 0 次事件，95% 单侧上界的精确形式为：

~~~text
upper = 1 - alpha^(1/n), alpha = 0.05
~~~

常见的 `3/n` 只是 95% 上界的近似。零观测表示“本次没看到”，不表示风险为零。

## 一份可审计的报告

~~~markdown
# Repeated Trial Report

## Scope
- Protocol:
- Agent bundle:
- Dataset version:
- Fixed Suite or target population:

## Trial accounting
| Item | Count |
| --- | ---: |
| Planned | |
| Started | |
| PASS | |
| PARTIAL | |
| FAIL | |
| GRADER_ERROR | |
| INFRA_ERROR | |
| UNSCORABLE | |
| CANCELLED | |

## Primary metrics
| Metric | Estimate | 95% interval | Aggregation | Product meaning |
| --- | ---: | --- | --- | --- |
| pass@1 | | | case macro | one random same-case i.i.d. attempt |
| pass@3 | | | case macro | at least one of three same-case i.i.d. attempts |
| pass^3 | | | case macro | all three same-case i.i.d. attempts succeed |

## Critical segments and safety gates
- Worst Cases:
- Critical incidents:
- Early stopping:
- Protocol deviations:
~~~

每个指标旁都要保留：分母、聚合单位、区间方法、协议版本和产品解释。单独的百分比不足以复核结论。

## 常见错误

### 每个 Case 只跑一次

无法区分稳定能力与偶然成功，也无法估计同 Case 随机性。

### 把 Agent 超时记成基础设施错误

如果 Deadline 属于产品契约，这会系统性美化 Agent。只有平台未兑现承诺时才是 `INFRA_ERROR`。

### 无限重跑无效或失败 Trial

补跑规则必须预先声明，并对 Baseline 与 Candidate 对称。不能重跑直到得到满意结果。

### 只报告总成功率

总平均会隐藏高风险 Segment、最差 Case、严重事故和证据覆盖问题。

### 用 Case Bootstrap 回答固定 Suite 的重放问题

重采样层级改变了推断对象。先写清 Estimand，再选择区间算法。

## 落地产物

完成本文后，仓库至少应包含：

~~~text
agent-eval/
├── protocols/repeated-trial-v1.yaml
├── schemas/trial-result.schema.json
├── statistics/pass-metrics.ts
├── statistics/fixed-suite-trial-bootstrap.ts
├── statistics/case-cluster-bootstrap.ts
├── taxonomies/failure-severity.yaml
└── reports/repeated-trial-report.md
~~~

下一篇[《如何公平比较两个 Agent》](./fair-comparison-of-agent-variants.md)会在这套 Trial 协议上加入配对设计、随机化顺序和预声明决策规则，判断差异是否真的来自修改。

## 适用边界

- 本文主要处理二元 Outcome；连续质量、排序和多标签结果需要相应模型。
- `1-(1-p_i)^k` 与 `p_i^k` 要求同一 Case 内 Trial 独立同分布；仅有可交换性不够。
- 固定 Suite 的区间只描述声明的清单，不自动推广到全部未来任务。
- Case 很少或 Trial 极少时，非参数区间可能离散且不稳定，应报告这一限制。
- 离线重复 Trial 不能替代生产 Monitoring、用户研究和事故响应。
- 统计显著不等于产品重要，严重风险也不能靠平均收益抵消。

## 公开参考

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Task、Trial、Outcome、Harness、重复运行以及 pass@k / pass^k 的产品语义。
- [Chen et al.：Evaluating Large Language Models Trained on Code](https://arxiv.org/abs/2107.03374) — HumanEval 与有限样本 pass@k 估计。
- [Yao et al.：τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045) — 用环境终态评分，并以 pass^k 表达一致可靠性。
- [Anthropic：Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise) — 资源与运行条件为何必须被视为一等实验变量。
- [NIST/SEMATECH：Confidence intervals for a binomial proportion](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm) — Wilson 与精确二项区间的适用条件。
- [Brown, Cai and DasGupta：Interval Estimation for a Binomial Proportion](https://doi.org/10.1214/ss/1009213286) — 二项比例区间的有限样本比较。
- [Howard et al.：Time-uniform, nonparametric, nonasymptotic confidence sequences](https://arxiv.org/abs/1810.08240) — 任意停止时间下的时间一致覆盖。
- [Hurlbert：Pseudoreplication and the Design of Ecological Field Experiments](https://doi.org/10.2307/1942661) — 把相关重复观测误当独立样本的经典讨论。
- [Hanley and Lippman-Hand：If Nothing Goes Wrong, Is Everything All Right?](https://doi.org/10.1001/jama.1983.03330370053031) — 零事件观测与 Rule of Three。
