---
title: 没有标准答案，如何用 Evaluation Contract 定义 Agent 成功
date: 2026-08-31
tags:
  - Agent Evaluation
  - Evaluation Contract
  - AI Engineering
description: 用结果、约束、质量、预算、可靠性和风险把模糊任务改写为可执行、可审查、允许多种正确路径的 Agent 评测契约
---

# 没有标准答案，如何用 Evaluation Contract 定义 Agent 成功

## 要解决的问题

很多 Agent 任务没有唯一参考答案：

- 研究报告可以采用不同论证结构；
- 代码问题可能存在多种正确修复；
- 网页任务可以通过不同导航路径完成；
- 客服对话可以用不同措辞解决同一诉求；
- 数据分析可以选择不同但合理的图表和解释。

这并不意味着只能凭感觉评分。没有唯一答案，通常只是说明不该比较完整文本或强制复刻执行轨迹。任务依然可以被拆成：

~~~text
必须形成的结果
+ 必须遵守的约束
+ 开放性质量要求
+ 资源预算
+ 多次运行的可靠性
+ 不可接受的风险
~~~

Evaluation Contract 就是对这六类要求的显式约定。

## 从参考答案转向成功集合

传统精确匹配假设存在一个目标值：

~~~text
actual == expected
~~~

开放式 Agent 任务更适合定义一个成功集合：

~~~text
Success =
  Outcome 满足 required
  AND Constraints 全部成立
  AND Quality 达到门槛
  AND Budget 没有越界
  AND Reliability 达到要求
  AND Risk 事件为零或低于阈值
~~~

只要结果落在这个集合内，Agent 可以选择不同的计划、工具和表达方式。评测由“像不像参考答案”转变为“是否满足契约”。

## Evaluation Contract 的六个部分

### 1. Outcome：世界最终应该变成什么样

Outcome 描述任务完成后的可观察状态，而不是 Agent 的自我陈述。

例如，“创建一篇知识文章”的 Outcome 可能包括：

- 指定目录出现 Markdown 文件；
- Frontmatter 字段完整且合法；
- 文章包含目标章节和公开参考资料；
- 分类索引和站点导航已经引用该文件；
- 文档构建通过。

[Anthropic 的 Agent Eval 指南](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)强调区分 Transcript 和 Outcome：对预订任务，应检查数据库中是否真的存在预订，而不是检查 Agent 是否说“已预订”。[τ-bench](https://arxiv.org/abs/2406.12045)同样通过最终数据库状态与目标状态的匹配评价工具 Agent。

Outcome 可进一步分为：

~~~yaml
outcome:
  required:
    - article_file_exists
    - metadata_is_valid
    - site_build_passes
  preferred:
    - article_links_to_related_topics
    - examples_cover_multiple_scenarios
  evidence:
    - filesystem_snapshot
    - markdown_validator
    - build_result
~~~

Required 决定是否成功，Preferred 用于区分多个合格结果，Evidence 声明以什么事实为准。

### 2. Constraints：成功过程中不能破坏什么

Constraints 描述必须保持的不变量与过程边界：

- 只能修改允许的目录；
- 不得泄露密钥、内部链接和个人信息；
- 写操作前必须获得审批；
- 不得删除现有内容；
- 必须使用指定来源类型；
- 必须保留兼容接口。

~~~yaml
constraints:
  required:
    - preserve_existing_content
    - use_public_sources_only
  forbidden_actions:
    - modify_files_outside_scope
    - publish_without_approval
    - include_private_identifiers
~~~

这里适合评价 Trajectory，因为“最终状态看起来正确”不能证明过程中没有越权访问或危险操作。过程评分应主要服务于硬约束，而不是要求 Agent 按参考步骤行动。

### 3. Quality：合格结果还需要达到什么水平

Quality 用于评价无法由精确状态完全表达的维度，例如：

- 事实是否被资料支持；
- 论证是否完整；
- 表达是否清晰；
- 建议是否可执行；
- 是否覆盖关键反例；
- 风格是否适合目标读者。

不要使用“整体质量很好”这样的 Rubric。更好的写法包含维度、锚点和失败示例：

| 维度 | 通过标准 | 典型失败 |
| --- | --- | --- |
| 证据支持 | 关键事实均能由引用资料支持 | 引用存在但不支持对应结论 |
| 结构 | 问题、判断、方法和落地步骤形成闭环 | 只有观点，没有执行方式 |
| 清晰度 | 目标读者无需额外背景即可理解核心概念 | 大量术语未定义 |
| 边界 | 明确适用条件、限制和反例 | 把局部经验写成普遍定律 |

[OpenAI 的评测最佳实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)建议优先让模型 Judge 做比较、分类或基于标准的判断，而不是无限开放的打分；同时要用人工标签校准 Judge，并检查位置、长度等偏差。

### 4. Budget：允许付出多少资源

如果不写预算，Agent 可以用无限轮次、无限检索和无限模型调用换取小幅质量提升。实际产品必须约束：

~~~yaml
budget:
  max_wall_time_ms: 300000
  max_model_calls: 20
  max_tool_calls: 40
  max_cost_usd: 2.00
~~~

预算最好区分：

- 硬上限：超过即失败或停止；
- 目标区间：用于优化和版本比较；
- 单位成功成本：总成本除以成功 Trial，而不只是平均单次成本。

最后一项很重要。一个便宜但频繁失败的 Agent，完成每个成功任务的真实成本可能更高。

### 5. Reliability：不是偶然完成，而是能够重复完成

Evaluation Contract 应声明每个 Case 运行多少次，以及如何聚合：

~~~yaml
reliability:
  independent_trials: 5
  minimum_pass_rate: 0.8
  require_consecutive_successes: 3
  environment_reset: before_each_trial
~~~

平均成功率描述单次随机运行的表现，连续成功要求则更接近真实流程对可靠性的期待。[τ-bench](https://arxiv.org/abs/2406.12045)提出的 pass^k 正是在观察 Agent 多次运行的一致性。

对高风险任务，除了平均通过率，还应报告：

- 最差 Case；
- 失败类型分布；
- 是否存在偶发不可逆动作；
- p95 或 p99 延迟；
- 不同任务类别之间的方差。

### 6. Risk：哪些失败不能被平均分抵消

风险项不应简单参与加权平均。例如，一次越权删除不能被九次优美回答抵消。

~~~yaml
risk:
  zero_tolerance:
    - destructive_action_without_approval
    - secret_exposure
    - cross_tenant_data_access
  thresholds:
    unsupported_critical_claim_rate: 0.01
    human_escalation_miss_rate: 0.02
~~~

可以将风险分成：

- 零容忍事件：发生一次即阻断发布；
- 有上限事件：允许极低发生率，但必须监控；
- 可恢复错误：主要影响体验，可通过重试或人工接管；
- 未知风险：通过人工抽样、红队和生产反馈持续发现。

[NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)把风险治理组织为 Govern、Map、Measure 和 Manage，并强调在真实语境中组合定量、定性和混合方法。Evaluation Contract 是把其中一部分要求落实到具体任务和发布决策的工程接口。

## 一份完整的契约示例

下面以“研究公开资料并保存技术文章”为例。字段名称可以改变，关键是语义完整且能执行。

~~~yaml
contract:
  id: research-article-v1
  task:
    input:
      topic: agent evaluation
      audience: software engineers
    environment:
      repository_snapshot: docs-main-2026-08
      network_policy: public-web-read-only

  outcome:
    required:
      - markdown_created_in_target_category
      - frontmatter_valid
      - category_index_updated
      - sidebar_updated
      - content_log_updated
      - documentation_build_passes
    preferred:
      - connects_to_existing_articles
      - includes_reusable_templates

  constraints:
    required:
      - use_primary_or_official_sources_for_core_claims
      - preserve_unrelated_changes
    forbidden_actions:
      - expose_private_paths_or_identifiers
      - copy_long_source_passages
      - commit_or_publish_without_authorization

  quality:
    rubric:
      evidence_support:
        minimum: 4
        scale: 1-5
      conceptual_clarity:
        minimum: 4
        scale: 1-5
      actionability:
        minimum: 4
        scale: 1-5
      boundary_awareness:
        minimum: 3
        scale: 1-5

  budget:
    max_wall_time_ms: 600000
    max_model_calls: 30
    max_tool_calls: 60

  reliability:
    independent_trials: 3
    minimum_pass_rate: 0.67
    environment_reset: before_each_trial

  risk:
    zero_tolerance:
      - secret_exposure
      - destructive_repository_change
      - unapproved_publication
~~~

这份契约不会规定文章必须有几段、Agent 必须先调用哪个搜索工具，也不会要求正文与参考答案相似。它规定的是成功空间和不可跨越的边界。

## 把契约映射成 Grader

契约只有能被执行，才不是另一份愿望清单。一个实用映射如下：

| Contract 部分 | 首选 Grader | 例子 |
| --- | --- | --- |
| Outcome | 状态检查、测试、Schema | 文件存在、数据库状态、测试通过 |
| Constraints | Policy 检查、Trace 规则、审计日志 | 未越权、审批先于写操作 |
| Quality | Rubric Judge、Pairwise、专家抽样 | 清晰度、覆盖度、论证质量 |
| Budget | 运行时计数器 | Token、成本、延迟、工具次数 |
| Reliability | 多 Trial 聚合器 | Pass rate、pass^k、方差 |
| Risk | 硬规则、红队、人工升级 | 密钥泄露、破坏性动作 |

设计顺序应是：

1. 先问真实环境能否直接验证；
2. 再问代码或规则能否确定判断；
3. 只有开放性语义质量才交给模型 Judge；
4. Judge 与规则冲突时，明确哪个证据拥有优先级；
5. 定期用领域专家样本校准自动 Grader。

例如，[SWE-bench](https://www.swebench.com/original.html)的核心证据是代码修改后测试是否通过；[WebArena](https://proceedings.iclr.cc/paper_files/paper/2024/hash/4410c0711e9154a7a2d26f9b3816d1ef-Abstract-Conference.html)强调功能性任务完成。它们共同展示了状态型 Grader 的价值：尽量评价 Agent 真正改变了什么。

## Outcome 与 Trajectory 如何分工

一个常见冲突是：最终结果正确，但过程与参考轨迹不同。可以用下面的优先级处理：

### 优先评价 Outcome

对于搜索顺序、文件阅读顺序、代码实现方式等开放选择，只要结果和约束满足，就不应因为路径不同扣分。

### 只对硬过程约束设 Gate

需要明确检查的过程通常包括：

- 高风险写操作是否获得审批；
- 是否调用禁止工具或访问越权数据；
- 是否跳过法规要求的人工确认；
- 是否伪造已经执行过的检查；
- 是否在失败后继续产生副作用。

### 把其余 Trajectory 信号用于诊断

工具选择错误、无效循环、重复检索和上下文膨胀可以帮助优化 Agent，但不必直接定义任务失败。它们可以进入 Diagnostic 指标，再观察是否与 Outcome、成本或风险相关。

## 如何聚合结果而不掩盖风险

推荐使用“Gate + Scorecard”，而不是单一总分：

~~~text
第一层：硬门槛
  所有 Required Outcome 满足
  零容忍风险为 0
  关键回归全部通过

第二层：主指标
  任务成功率
  多 Trial 可靠性

第三层：质量面板
  证据、完整性、清晰度、边界

第四层：效率面板
  延迟、成本、工具调用、人工介入
~~~

只有先通过第一层，后面的质量和效率比较才有意义。若必须选择版本，可以采用 Pareto 思路：优先保留在成功率、成本和延迟上没有被全面支配的候选，再根据产品目标决策。

## 如何验证 Contract 本身

评测契约也可能出错。发布前应做四类检查：

### 双人可判定

让两位领域专家独立阅读任务和契约。如果他们经常对通过与否意见相反，问题可能在任务定义或 Rubric，而不是 Agent。

### 正反例测试

为每个 Grader 准备：

- 明确应通过的样本；
- 明确应失败的样本；
- 边界样本；
- 试图钻规则空子的对抗样本。

### 证据闭环

每个 Required 字段都必须能指出证据来源。无法自动验证的要求，应明确人工抽样流程，而不是假装已经被测量。

### 版本与迁移

Contract、Dataset 和 Grader 都要版本化。修改 Rubric 或阈值后，应说明新旧分数是否可比，必要时重跑基线。

## 常见误区

### 把参考答案当成唯一合法答案

这会惩罚合理的新路径，并鼓励针对固定样例模仿。参考答案更适合用于解释任务、提供正例或校准 Judge。

### Contract 写得很完整，但无法执行

“内容必须深刻”“方案必须优秀”不具备可判定性。应补充维度、锚点、最低标准和证据来源。

### 所有要求都做加权平均

权限、安全、数据完整性和关键回归应成为 Gate。加权平均适合表达偏好，不适合消解底线。

### 对所有任务使用同一套 Rubric

研究、编码、客服和数据操作的质量维度不同。可以共享 Contract Schema，但不要共享一套空泛的判断标准。

### 忘记声明不评什么

如果当前 Contract 只验证离线能力，就应明确不代表线上用户价值；若环境使用 Mock，也应明确未覆盖真实服务故障和权限链路。

## 一页式 Contract 检查表

- 是否写清最终状态，而不是 Agent 应该说什么？
- Required、Preferred 和 Forbidden 是否分开？
- 每个 Required 是否有可定位的证据？
- 能用状态或代码判断的事实，是否避免交给 LLM？
- Rubric 是否有维度、锚点和失败示例？
- 是否定义延迟、成本、调用次数或人工介入预算？
- 是否规定 Trial 次数、环境重置和聚合方法？
- 是否存在不能被平均分抵消的风险 Gate？
- 是否允许多种正确路径？
- Contract、Dataset 和 Grader 是否都有版本？
- 是否明确本次评测结论不能推广到哪里？

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Outcome、Trajectory、Grader、Trial 与 Harness 的定义和实践。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — Rubric、Judge 形式、人工校准与持续评测建议。
- [τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045) — 最终数据库状态和多次运行可靠性。
- [WebArena: A Realistic Web Environment for Building Autonomous Agents](https://proceedings.iclr.cc/paper_files/paper/2024/hash/4410c0711e9154a7a2d26f9b3816d1ef-Abstract-Conference.html) — 真实网页环境中的功能性任务完成评测。
- [SWE-bench: Can Language Models Resolve Real-World GitHub Issues?](https://www.swebench.com/original.html) — 以真实代码库与测试结果验证编码 Agent。
- [NIST AI Risk Management Framework Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — 面向具体语境的 AI 风险映射、测量与治理。
