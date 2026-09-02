---
title: Agent 评测工程知识体系：从可观测性到质量基础设施
date: 2026-08-31
tags:
  - Agent Evaluation
  - Observability
  - AI Engineering
  - Quality Infrastructure
description: 以定义质量、采集 Trace、构建评测集、受控实验和生产反馈为主线，组织 Agent 评测工程的知识体系与文章路线
---

# Agent 评测工程知识体系：从可观测性到质量基础设施

## 要解决的问题

搭建一个能够调用模型和工具的 Agent 正在变得越来越容易，真正困难的是回答下面这些问题：

- Agent 到底有没有完成任务？
- 修改 Prompt、模型、工具或工作流后，它是真的变好，还是只改变了行为风格？
- 最终结果正确但过程昂贵、危险或不稳定时，应该如何评价？
- 通用 Benchmark 与个人真实工作不一致时，应该相信什么？
- 如何把一次失败变成以后不会再次出现的回归用例？

这些问题不能仅靠检查最终文本，也不能只靠查看 Trace 或累计工具调用次数。完整的 Agent 质量闭环至少包含：

~~~text
定义质量
  ↓
记录行为
  ↓
构建任务与评测器
  ↓
执行受控实验
  ↓
设置发布门槛
  ↓
收集生产失败
  ↓
持续回归与优化
~~~

这套知识体系适合组织为一个渐进式系列，而不是按具体平台或 SDK 分章。工具会持续变化，质量问题、实验契约和数据资产则相对稳定。

## 核心判断

### 没有唯一答案，不等于无法评测

Agent 经常允许多种正确实现和执行路径，但仍然可以验证最终状态、必须满足的约束、禁止动作、质量要求和资源预算：

~~~text
Agent Quality
  = Outcome
  + Constraints
  + Quality
  + Efficiency
  + Reliability
  + Risk
~~~

评测不应要求 Agent 复刻某条参考轨迹，而应判断它是否完成任务、是否违反边界，以及代价是否可以接受。

### Trace、Eval、Experiment 和 Release 是不同层次

| 层次 | 回答的问题 | 典型产物 |
| --- | --- | --- |
| Trace | Agent 做了什么？ | 模型调用、工具调用、状态变化和错误链路 |
| Eval | 它做得好不好？ | Grader 结果、维度分数和失败标签 |
| Experiment | 哪个配置更好？ | 受控对照、统计结果和权衡 |
| Release | 是否值得上线？ | 回归门槛、安全门槛和发布决策 |
| Monitoring | 上线后发生了什么？ | 漂移、异常、人工介入和用户结果 |

只建设 Trace 系统解决的是可观测性问题；只有当任务、评测器和实验协议也存在时，才形成评测工程。

### 长期资产不是某个 Prompt

真正会持续增值的资产是：

~~~text
真实任务分布
+ 可复现环境
+ 高质量 Grader
+ 生产失败样本
+ 历史实验结果
~~~

它们共同回答“这个模型或 Agent 对真实工作究竟有多大价值”，也使新模型、工具集和 Agent 架构能够被快速、可重复地比较。

## 系列结构

建议把主系列组织为六部分、十八篇文章。每一部分都产生一个可以复用的工程产物，使读者不是只理解概念，而是逐步得到一套可运行的 Agent Eval。

| 部分 | 核心问题 | 阶段产物 |
| --- | --- | --- |
| 一、理解评测对象 | 到底在评什么？ | Evaluation Map 与 Eval Contract |
| 二、建立可观测性 | Agent 实际做了什么？ | Trace Schema 与 Run Manifest |
| 三、构建任务集 | 什么任务代表真实工作？ | 版本化 Eval Dataset |
| 四、设计评测器 | 如何判断好坏？ | 组合式 Grader |
| 五、执行实验 | 如何证明改动有效？ | Experiment Report 与 Release Gate |
| 六、生产反馈 | 如何持续变好？ | Trace-to-Regression 闭环 |

## 第一部分：重新理解 Agent 评测

### 1. [为什么搭建 Agent 容易，证明它变好却很难](./why-agent-evaluation-is-hard.md)

从非确定性、多路径、工具反馈、状态修改和长链路错误传播出发，解释 Agent 测试与传统输入—输出测试的差异。

文章应建立第一个核心结论：

> Agent Engineering 的重点正在从如何构建，转向如何测量和改进。

### 2. [我们评测的到底是什么](./agent-evaluation-target-boundaries.md)

明确区分四个层次：

~~~text
Model
  ↓
Prompt / Tool / Workflow / Harness
  ↓
Agent System
  ↓
Product Outcome
~~~

模型能力、Agent 配置和业务价值不能被折叠成同一个分数。一次模型对比实验与一次 Agent 版本回归测试也需要不同的控制变量。

### 3. [没有标准答案，如何定义成功](./agent-evaluation-contract.md)

把模糊的“回答质量不错”转换为 Evaluation Contract：

~~~yaml
task:
  input: ...
  environment: ...

outcome:
  required: []
  preferred: []

constraints:
  forbidden_actions: []

quality:
  rubric: []

budget:
  max_latency_ms: 0
  max_tool_calls: 0
~~~

这一部分最终交付一张 Evaluation Map 和一份可执行的 Eval Contract。

## 第二部分：先看见 Agent 做了什么

### 4. [Trace、Eval、Experiment 与 Monitoring 的边界](./agent-trace-eval-experiment-monitoring-boundaries.md)

用同一次 Agent Run 说明：

- Trace 用于还原事实；
- Eval 用于执行判断；
- Experiment 用于比较变量；
- Monitoring 用于发现生产分布变化。

避免把“记录了工具调用次数”误认为“已经建立评测”。

### 5. [如何设计 Agent Trace Tree](./agent-trace-tree-design.md)

Trace 应覆盖完整执行树，而不仅在工具接口外包一层计数器：

~~~text
Agent Run
├── Model Call
├── Tool Call
├── Model Call
│   ├── Tool Call
│   └── Tool Call
├── Guardrail / Approval
└── Final State
~~~

除延迟、Token 和错误外，还应记录 Agent、Prompt、工具集、权限和 Harness 的版本，以便以后还原实验。

### 6. [如何让 Agent 实验可复现](./reproducible-agent-evaluation-experiments.md)

Agent Eval 是端到端系统实验。运行资源、工具版本、网络、缓存、遗留文件和并发都可能改变结果。

每次 Trial 应从干净环境开始，并使用 Run Manifest 固定：

~~~text
model + prompt + tools + permissions + harness
+ environment snapshot + timeout + resource budget
~~~

这一部分最终交付 Trace Schema、Run Manifest 和环境重置规则。

## 第三部分：构建真正有价值的评测集

### 7. [为什么个人和团队需要自己的 Agent Eval Dataset](./why-build-your-own-agent-eval-dataset.md)

通用 Benchmark 回答的是模型在某个公开任务分布上的能力；个人或团队 Eval 回答的是模型在自身真实工作分布上的价值。

第一版可以从少量真实任务开始，但应明确它只能用于发现明显问题，不能用来证明几个百分点的模型排名差异。

### 8. [如何把真实工作转化成 Agent Eval Case](./turn-real-work-into-agent-eval-cases.md)

每个 Case 至少描述：

~~~yaml
input:
environment:
allowed_actions:
expected_outcomes:
forbidden_actions:
quality_rubric:
budget:
~~~

好的 Case 应让两位领域专家能够独立得出接近的通过或失败结论；如果任务本身含糊，评分只会测量解释差异。

### 9. [一个健康的 Agent 评测集如何分层](./healthy-agent-eval-dataset-layers.md)

推荐长期维护以下集合：

- Core：最常见的真实任务；
- Capability：当前还无法稳定完成的任务；
- Regression：过去已经修复的失败；
- Stress：超长上下文、工具超时和异常返回；
- Safety：高风险操作与权限边界；
- Holdout：平时不用于调试的正式比较集；
- Online：从新生产流量中抽样的未知任务。

开发集与正式评测集应分开，避免 Agent 或开发者持续针对同一组题目调参而产生评测过拟合。

## 第四部分：设计可信的评测器

### 10. 能用代码判断的，就不要交给 LLM

优先使用确定性证据：

- 单元测试与静态分析；
- 数据库和文件状态；
- API Contract 与 Schema；
- 禁止动作和状态不变量；
- 成本、延迟和调用预算。

LLM 不应重新判断一个已经可以由真实环境直接验证的事实。

### 11. LLM-as-Judge 如何避免成为另一种玄学

模型评测器适合判断自然度、覆盖度、解释质量和开放性方案，但必须配套：

- 清晰、带示例的 Rubric；
- Pass/Fail 或盲测 Pairwise；
- 随机化输出顺序；
- 对位置偏差、长度偏差和自偏好的检查；
- 与领域专家标签的周期性校准；
- 对 Judge 分歧的记录和升级流程。

### 12. Trajectory 应该评什么

Trajectory 主要用于发现：

- 禁止工具或高风险动作；
- 无依据的工具参数；
- 循环和无效重试；
- 忽略工具返回结果；
- 错误恢复和终止策略失败。

除非业务流程本身有合规要求，否则不要要求 Agent 严格复制参考调用序列。结果正确且满足边界的创新路径应当被允许。

这一部分最终交付 Deterministic、Rule、Model 和 Human 四类 Grader 的组合策略。

## 第五部分：证明一次修改真的有效

### 13. Agent 是随机的，一次成功说明不了什么

同一个 Case 需要多个 Trial，并根据产品目标选择指标：

- pass@1：第一次执行的成功率；
- pass@k：多次尝试中至少成功一次；
- pass^k：连续多次都成功；
- 置信区间：结果的不确定范围；
- 严重度加权失败：区分轻微瑕疵和不可接受事故。

### 14. 如何公平比较两个 Agent

实验应在同一批任务和相同环境中进行配对比较，并记录实际改变的变量：

~~~text
Model
Prompt
Context Strategy
Tool Set
Workflow
Budget
~~~

能一次只改变一个主要变量时，应避免同时更换模型、Prompt 和工具集后再把提升归因给其中之一。

### 15. 不要把所有维度压成一个总分

建议保留多维 Scorecard：

~~~text
Success
Reliability
Quality
Safety
Cost
Latency
Tool Calls
Human Intervention
~~~

安全、破坏性操作和严重回归应作为硬门槛；其他指标可以通过 Pareto Frontier 或明确的产品权重做取舍。一个高总分不应掩盖低概率但不可接受的事故。

这一部分最终交付 Experiment Report、统计报告和 Release Gate。

## 第六部分：从个人评测走向质量基础设施

### 16. 如何把生产失败转化成 Regression Case

建立可持续反馈闭环：

~~~text
Production Trace
  ↓
Failure Detection
  ↓
Human Triage
  ↓
Reproduction
  ↓
Dataset
  ↓
Regression
~~~

失败不能只被加入题库，还需要记录根因、影响范围、严重级别和能够防止再次发生的 Grader。

### 17. 安全、隐私和数据治理

Trace 可能包含用户内容、代码、工具参数、文件和外部系统返回值。默认全量记录输入输出会把可观测性变成新的数据风险。

应从一开始设计：

- 字段级脱敏和内容采集开关；
- 元数据与原始内容的分级保留；
- 访问权限、审计和保留期限；
- 高风险操作的审批和可恢复性；
- Telemetry Schema 的版本固定与迁移策略。

### 18. 什么时候才值得建设 Agent Eval 平台

第一阶段不需要自建大型平台。简单的 Dataset、脚本、结构化 Trace 和实验结果已经能够形成有效反馈。

只有当现有工具无法表达真实任务环境、Grader、回归门槛或根因诊断流程时，才逐步形成：

~~~text
Agent Registry
Capability Registry
Dataset Registry
Trace System
Evaluation Engine
Experiment Manager
Regression Gate
Production Feedback
Model / Tool Selector
~~~

真正可能形成壁垒的不是新的 Trace UI，而是任务环境、评测器、失败数据、根因诊断和发布策略。

## 场景案例扩展

主系列建立统一方法后，可以继续增加场景文章：

1. **Coding Agent**：用测试、Git Diff、仓库状态和回归风险评测。
2. **Research Agent**：评测事实正确性、来源权威性、覆盖度和引用支撑。
3. **Browser Agent**：验证后端状态，而不是相信成功页面或最终回答。
4. **客服 Agent**：结合解决率、升级率、合规性和用户体验。
5. **Multi-Agent**：判断额外角色是否带来超过成本和延迟的净收益。
6. **Capability Router**：根据历史 Eval 为不同任务选择模型和工具组合。

这些文章应复用同一套 Evaluation Contract，但为不同环境设计不同 Outcome Grader。

## 每篇文章的统一写作结构

为了避免系列退化为概念汇编，每篇文章都应包含：

1. 一个真实而通用的失败场景；
2. 本文要解决的问题及不解决的问题；
3. 核心概念、边界和决策原则；
4. 最小数据结构、伪代码或配置；
5. 一个从输入到评分的完整示例；
6. 常见错误及其后果；
7. 可直接执行的检查清单；
8. 本章产生的工程产物。

整个系列完成后，读者应当拥有类似下面的资产：

~~~text
agent-eval/
├── contracts/
│   └── eval-contract.yaml
├── schemas/
│   ├── trace-schema.json
│   └── run-manifest.json
├── datasets/
├── evaluators/
├── experiments/
├── failure-taxonomy.yaml
└── release-gates.yaml
~~~

## 推荐发布顺序

不必一次写完十八篇。第一阶段可以先发布六篇，形成独立的入门闭环：

1. 为什么 Agent 评测困难；
2. 评测对象与四层边界；
3. Evaluation Contract；
4. Trace、Eval 与 Experiment 的区别；
5. Trace Tree 设计；
6. 可复现 Eval Harness。

第二阶段再集中写 Dataset、Grader 和统计实验；第三阶段扩展到生产反馈和质量平台。这样每一阶段都有完整结论，也可以根据真实读者问题调整后续重点。

## 适用边界与常见错误

### 适用边界

这套结构面向会调用工具、修改环境或经历多轮决策的 Agent。对于简单分类、抽取或单轮问答，传统 Dataset 与输出 Grader 往往已经足够，不需要完整的 Agent Trace 和环境 Harness。

### 常见错误

- 先选择平台，再倒推要评什么；
- 把工具调用次数当作质量指标；
- 用参考轨迹限制所有正确解法；
- 只跑一次便宣布新版本提升；
- 把所有指标加权成一个总分；
- 用同一批题目持续调试并正式排名；
- 记录完整敏感内容，却没有数据治理；
- 建设平台早于积累真实任务和失败样本。

## 公开参考

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Anthropic：Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise)
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices)
- [OpenAI：Evaluate agent workflows](https://developers.openai.com/api/docs/guides/agent-evals)
- [OpenAI Agents SDK：Tracing](https://openai.github.io/openai-agents-python/tracing/)
- [OpenTelemetry：Generative AI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
