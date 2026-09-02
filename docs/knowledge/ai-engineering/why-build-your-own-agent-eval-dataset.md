---
title: 为什么个人和团队需要自己的 Agent Eval Dataset
date: 2026-09-02
tags:
  - Agent Evaluation
  - Eval Dataset
  - AI Engineering
description: 解释通用 Benchmark 与自有 Eval Dataset 的边界，并用任务分布、价值和覆盖建立可用于真实决策的最小评测集
---

# 为什么个人和团队需要自己的 Agent Eval Dataset

## 要解决的问题

一个新模型在公开榜单上领先，是否应该立刻替换当前模型？

一个 Agent 在十几个手工样例上都成功，是否已经足够可靠？

一个候选版本的总分高了三个百分点，是否真的改善了日常工作？

如果没有自己的 Eval Dataset，这些问题通常无法回答。

公开 Benchmark 测量的是系统在一组公开任务、固定环境和既定评分规则下的表现。个人或团队真正关心的则是：Agent 在自己的任务、工具、权限、成本和风险约束下，能否稳定地产生有价值的结果。

两者不是谁替代谁，而是在回答不同问题。

## 核心结论

自有 Eval Dataset 不是一批顺手收集的 Prompt，也不是把公开 Benchmark 私有化。它是一份版本化的任务样本和使用契约，用来把“这个 Agent 对我们有没有价值”转换为可以重复检查的证据。

可以把一次 Eval 分数理解为：

~~~text
Eval Result = f(
  Agent System,
  Task Distribution,
  Environment,
  Success Criteria,
  Trial Protocol
)
~~~

公开榜单只固定了其中一套任务分布、环境和规则。只要真实工作与这些条件不同，榜单分数就不能直接充当产品结论。

因此，自有 Dataset 的核心价值有四个：

1. 把评测任务对齐到真实工作分布；
2. 把常见程度、业务价值和失败风险显式编码进选题；
3. 为模型、Prompt、Harness 和工具变更提供稳定回归面；
4. 保留一部分未用于调试的任务，降低持续调参带来的评测过拟合。

但第一版不需要追求“大而全”。[Anthropic 的 Agent Eval 工程指南](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)建议从 20～50 个来自真实失败和人工检查的简单任务开始；它同时强调，这个规模适合早期发现大变化，成熟系统若要识别更小差异，就需要更多、更难的任务。

> 20～50 个 Case 足以开始建立反馈，不足以证明一个 Agent 在真实世界中已经达到某个精确成功率。

## 通用 Benchmark 与自有 Dataset 分别回答什么

### 通用 Benchmark 是共同坐标系

公开 Benchmark 有不可替代的价值：

- 让不同团队在大致一致的条件下比较系统；
- 低成本发现模型是否具备某类通用能力；
- 提供可复现的环境、任务格式和 Grader 范例；
- 帮助筛掉明显不适合的候选，再进入更昂贵的领域评测；
- 让研究进展拥有共同语言。

[TRUCE 的私有评测研究](https://www.microsoft.com/en-us/research/publication/truce-private-benchmarking-to-prevent-contamination-and-improve-comparative-evaluation-of-llms/)也把速度、可复现和低成本列为 Benchmark 成为主流评测方式的重要原因。

因此，合理用法不是抛弃公开 Benchmark，而是把它当作先验信号：

~~~text
公开 Benchmark
  用于了解通用能力与候选范围

自有 Eval Dataset
  用于回答真实工作与发布决策
~~~

### 自有 Dataset 是决策接口

自有 Dataset 应服务于明确决策，例如：

- 是否升级模型；
- 新 Prompt 是否修复了某类失败；
- 新工具是否提升完成率而没有增加越权动作；
- 更复杂的 Harness 是否值得额外成本和延迟；
- 某个版本是否满足发布门槛；
- 哪类任务需要继续由人完成。

如果一个 Dataset 没有对应决策，它容易退化为展示分数的题库。反过来，如果要做的决策已经写清楚，任务来源、覆盖范围、Trial 数量和报告方式才有判断依据。

### 两者的边界

| 问题 | 通用 Benchmark | 自有 Eval Dataset |
| --- | --- | --- |
| 模型是否具有某类广义能力 | 适合做初筛 | 可以补充，但不是主要优势 |
| 社区结果能否横向比较 | 较强 | 通常较弱 |
| 是否适合自己的工作流 | 只有分布与环境接近时才有参考性 | 核心用途 |
| 实际 Prompt、工具与权限是否有效 | 通常不覆盖 | 应直接覆盖 |
| 历史失败是否重新出现 | 很少覆盖 | 应形成稳定回归 |
| 稀有但高损失风险是否可接受 | 取决于 Benchmark 设计 | 可按自身风险设置硬门槛 |
| 是否容易被训练或调参看见 | 公开集风险较高 | 可保留受控 Holdout |
| 能否直接作为发布 Gate | 通常不能 | 在契约和统计条件满足时可以 |

## 为什么“真实任务”仍不等于“你的任务”

### 任何 Benchmark 都有自己的分布

[SWE-bench](https://proceedings.iclr.cc/paper_files/paper/2024/hash/edac78c3e300629acfe6cbe9ca88fb84-Abstract-Conference.html)是一个重要的真实世界编码 Benchmark。原始数据包含 2,294 个来自 GitHub Issue 和 Pull Request 的软件工程任务，但它们来自 12 个流行的 Python 仓库。

这些任务是真实的，仍然只代表一个具体范围：

- 开源协作中的 Issue 修复；
- 以 Python 为主的成熟仓库；
- 能够从合并 PR 中恢复测试与修复；
- 以测试通过作为核心成功证据。

如果实际工作主要是 TypeScript 单体仓库迁移、移动端 UI 修改、数据分析、内部运维或研究写作，SWE-bench 的高分仍不能直接推导出高生产成功率。

这不是 SWE-bench 的缺陷，而是所有有限 Dataset 的边界。

[NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)要求准确性测量配合清晰、现实且能代表预期使用条件的测试集，并建议按不同数据分段报告结果。这里的关键不是“题目来自现实”，而是“题目是否来自将要做出决策的那种现实”。

### 任务选择本身会改变结论

[The Benchmark Lottery](https://arxiv.org/abs/2107.07002)在多个机器学习领域的实验中发现，仅改变所选 Benchmark 任务，算法的相对表现就可能显著改变。每个 Benchmark 都通过选题表达了什么能力更重要。

对于 Agent，这种选择效应更强：

- 短任务与长任务需要不同规划能力；
- 只读任务与写操作任务承担不同风险；
- 稳定 Fixture 与实时网络考验不同能力；
- 单工具任务与多工具协同任务有不同错误传播路径；
- 一次成功与连续可靠成功代表不同产品体验。

所以“模型 A 比模型 B 强”通常是不完整陈述。更准确的说法应包含任务范围：

> 在 Dataset v3 的高频文档任务上，使用相同 Harness、预算和三次独立 Trial 时，候选 A 的成功率与成本表现优于候选 B。

### 同一个模型，不同 Agent 系统也会得到不同结果

Agent Eval 评测的不是裸模型。[Anthropic 的定义](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)明确指出，评价一个 Agent 时，实际评价的是模型与 Agent Harness 的组合。

[OpenAI 对 SWE-bench Verified 的分析](https://openai.com/index/introducing-swe-bench-verified/)曾观察到，同一 GPT-4 模型在 SWE-bench Lite 上使用不同 Scaffold 时，公开结果从 2.7% 到 28.3% 不等。这个历史案例不用于说明当前模型水平，而是说明：Harness、上下文策略、工具和运行方式足以大幅改变分数。

自有 Dataset 应运行真实或足够等价的系统配置：

~~~text
Model
+ System Prompt
+ Context Strategy
+ Tool Schemas
+ Permissions
+ Agent Loop
+ Environment
+ Budget
= Evaluated Agent System
~~~

只把榜单上的模型名称拿来比较，却不运行自己的 Agent，无法验证最终产品。

## “代表性”不是一个比例，而是三个问题

团队常说 Dataset 要有代表性，但这个词至少包含三种不同含义。

### 1. 分布代表性：我们平时最常做什么

它关注真实任务频率：

- 哪些任务每天出现；
- 哪些输入格式最常见；
- 上下文长度如何分布；
- 常用工具与环境是什么；
- 用户通常给出多少信息；
- 哪些语言、地区或角色占主要流量。

[OpenAI 的评测最佳实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)建议设计任务特定 Eval，使测试反映真实分布，并把不能忠实复现生产流量模式的 Dataset 列为设计反模式。它还建议从生产数据、历史日志、领域专家数据和合成数据中组合取样。

分布代表性回答的是：平均一天的任务像不像这组 Case。

### 2. 价值代表性：哪些任务值得优先做好

任务频率不等于价值。一个每月只发生一次的任务，可能比每天出现的摘要任务更重要。

价值可以来自：

- 节省的人力时间；
- 任务失败造成的返工；
- 对最终用户结果的影响；
- 是否阻塞后续流程；
- 是否涉及不可逆写操作；
- 是否触发合规、安全或声誉风险。

Anthropic 建议从 Bug Tracker、支持队列和真实用户失败中收集任务，并按用户影响排序。NIST 同样要求测量考虑不同失败可能造成的不同损害。

价值代表性回答的是：如果只能改善少数任务，应该先改善什么。

### 3. 能力覆盖：系统可能在哪些地方断裂

只按流量随机抽样，Dataset 很可能被简单、高频任务占满；只收集事故，又会让评测看起来比日常使用困难得多。

能力覆盖需要有意识地包含：

- 典型成功路径；
- 历史真实失败；
- 边界输入与缺失信息；
- 应调用工具和不应调用工具的双向样本；
- 工具超时、空结果、权限拒绝与部分成功；
- 高风险动作和必须人工升级的情况；
- 当前尚不能稳定完成、但未来希望具备的能力。

OpenAI 建议同时覆盖典型、边缘和对抗 Case；Anthropic 则强调同时测试“应该发生”和“不应该发生”的行为，避免单边题集把 Agent 优化成总是搜索、总是调用工具或总是拒绝。

能力覆盖回答的是：Dataset 是否有机会暴露我们关心的失败模式。

### 三种代表性不能压成一个无解释的总分

高频、价值与风险经常冲突。更稳妥的方式是把它们作为不同 Slice 分别报告：

~~~text
Traffic Slice       高频真实任务
Value Slice         高价值与流程关键任务
Regression Slice    已知且已修复的失败
Boundary Slice      边缘输入与异常环境
Risk Slice          稀有但不可接受的失败
Capability Slice    计划中的更难能力
~~~

这些名称不是固定标准。重要的是记录每个 Case 为什么入选，不要用一个混合平均分隐藏任务构成。

第三部分的后续文章会进一步讨论如何把单个真实任务写成 Eval Case，以及如何把长期 Dataset 分成 Core、Capability、Regression、Stress、Safety、Holdout 和 Online 等集合。本篇先建立选择这些任务的决策基础。

## 先写 Dataset Charter，再收集 Case

Dataset Charter 是评测集的使用说明和边界声明。它不描述每个 Case 的具体答案，而是约束整组数据为什么存在、如何选题，以及可以用它支持什么结论。

一份最小 Charter 至少回答：

- 这组数据要支持什么决策？
- 被评价的是模型、Harness、Agent 系统还是产品结果？
- 目标用户和目标任务分布是什么？
- Case 从哪里来，时间窗口是什么？
- 哪些任务被排除，为什么？
- 如何兼顾频率、价值、覆盖与风险？
- 哪些 Case 可以用于日常调试？
- 哪些 Case 必须保留为 Holdout？
- 多久复核一次分布与泄漏状态？
- 哪些结论明确不允许从该 Dataset 推导？

### 一个可复用的 Dataset Charter

~~~yaml
schema_version: eval-dataset-charter-v1
identity: {dataset_id: personal-research-agent, version: 0.1.0, owner: eval-owner}
decision:
  primary_question: >
    候选 Agent 是否改善公开资料研究任务，
    且没有破坏来源质量、隐私边界和成本预算？
  supported: [detect_large_changes, catch_known_regressions, enforce_risk_gate]
  unsupported: [estimate_global_success_rate, prove_no_unknown_failures]
evaluation_target:
  layer: agent_system
  includes: [model, system_prompt, toolset, harness, permission_profile]
  excludes: [production_ui, live_user_adoption]
target_population:
  users: [individual_knowledge_worker]
  task_families: [fact_lookup, evidence_synthesis, comparative_research]
  environment: {network: public_web, language: zh-CN}
  sampling_window: recent_90_days
selection:
  sources: [manual_checks, sanitized_tasks, confirmed_failures, requirements]
  planned_slices: {routine: 15, historical_failure: 8, boundary: 6, risk: 5}
  inclusion_rule: task_has_clear_user_value_and_verifiable_outcome
  exclusion_rule: task_requires_private_or_unreproducible_data
usage:
  development_set:
    visible_to_developers: true
    allowed_for_prompt_iteration: true
  holdout_set:
    visible_to_developers: false
    allowed_for_prompt_iteration: false
    reveal_policy: release_decision_only
    refresh_after_reveal: true
protocol:
  environment_reset: before_each_trial
  repeated_trials_for_stochastic_cases: 3
  compare_candidates_on_same_cases: true
  reporting: [case_level_results, separate_slices]
governance:
  remove_personal_data: true
  record_case_provenance: true
  record_exposure_history: true
  review_triggers: [distribution_changed, toolset_changed, holdout_revealed]
~~~

数字只是一个小型个人 Dataset 的示例，不是通用配额。Charter 的价值在于让别人能够判断结论边界，也让未来的自己知道为什么当时选择这些任务。

## 从 0 到 1 构建第一版 Dataset

1. **定义决策**：先完成“我需要用这组数据决定 ______，被测对象是 ______，如果出现 ______，即使平均分更高也不能接受”。它会直接确定任务、指标和 Gate。
2. **盘点真实任务**：从发布前手工检查、近期 Run、Bug、支持请求、返工记录、产品需求和领域专家经验中取样。
3. **脱敏并重建**：不要原样复制生产内容；移除个人数据、凭据、私有地址和客户内容，再构造可复现 Fixture。
4. **标注选择理由**：第一版不需要复杂平台，一张结构化清单已经足够：

| 字段 | 作用 |
| --- | --- |
| `case_id` | 稳定标识与版本追踪 |
| `task_family` | 按能力和工作类型切片 |
| `source_type` | 手工检查、真实失败、需求或合成边界 |
| `frequency / value / risk` | 频率、价值和失败后果 |
| `failure_mode` | 希望暴露的失效方式 |
| `contract_ref / fixture_ref` | 成功契约与初始环境 |
| `usage_split` | Development 或 Holdout |
| `privacy_review` | 是否完成脱敏和权限检查 |

这些元数据比单纯增加题量更重要，因为它们决定以后能否解释分数变化来自哪个任务 Slice。

5. **形成小而有差异的初版**：一个实用但非统计标准的起点可以是：

- 12～20 个最常见的正常任务；
- 5～10 个已经确认的真实失败；
- 4～8 个边界、异常或双向行为任务；
- 3～5 个低频但高影响的风险任务。

总量大约落在 20～50 个 Case。任务可以多标签，不要为凑数量复制近义题。第一轮先验证 Case 可解、标准清楚、环境可重置、Grader 不错杀，以及每个任务确实影响决策。

6. **建立并冻结基线**：尽量在看到候选结果前用当前系统运行 Dataset，避免按候选优缺点后验选题。阅读 Trace 和 Outcome，区分 Agent、Task、Grader 与环境失败，并用参考解排除坏 Case。随后冻结任务、Fixture、Contract、Grader 和 Split：

~~~text
dataset-v0.1.0
├── charter
├── case inventory
├── development split
├── holdout policy
├── coverage report
└── baseline result
~~~

此后修改 Case 语义、增删任务或调整 Split，都应产生新版本。不要把旧结果与新 Dataset 的分数连成一条没有断点的趋势线。

这一步承接[如何让 Agent 评测实验可复现](./reproducible-agent-evaluation-experiments.md)中的 Run Manifest、环境隔离和失败分类：Dataset 决定测什么，Run Manifest 决定当时如何测。

## 少量样本能证明什么，不能证明什么

### 能支持的结论

20～50 个高质量 Case 可以有效支持：

- 某个已知失败是否重新出现；
- 一个大改动是否造成明显、方向一致的变化；
- 候选能否完成一组明确列出的任务；
- 零容忍风险是否在被测 Case 中发生；
- 任务说明、环境或 Grader 是否存在明显缺陷；
- 哪些失败模式值得继续增加样本和诊断。

这些结论都应保留范围限定，例如“在 Dataset v0.1 的 8 个历史回归 Case 上全部通过”，而不是“已经解决所有同类问题”。

### 不能直接支持的结论

小型、人工选择的 Dataset 通常不能证明：

- Agent 在全部真实任务上的成功率是 95%；
- 两个候选相差两三个百分点就存在稳定能力差异；
- 没有观察到安全事故就意味着风险为零；
- 在同一个任务上重复十次等于覆盖了十种任务；
- 一次全通过意味着 Agent 能够持续可靠地全通过；
- 当前用户流量、未来流量和这组人工 Case 属于同一统计总体。

### 20 个 Case 全通过，也不是“100% 可靠”

即使把 20 次结果强行视为独立、同分布的二项试验，20 次全部成功对应的 95% 双侧精确置信区间下界也只有约 83%。计算方法可以参照 [NIST 的小样本二项比例精确区间](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)。

真实 Agent Eval 往往还不满足这些理想假设：

- Case 是人为挑选，不是从明确定义总体中随机抽样；
- 不同任务的难度和成功概率不同；
- Trial 可能共享环境噪声；
- 同一模型调用与工具服务可能相关；
- Grader 错误会系统性影响多个 Case。

因此，这个 83% 不是应报告的生产下界，而是一个提醒：观察值 20/20 与“真实成功率 100%”不是同一件事。

[NIST 的比例检验样本量示例](https://www.itl.nist.gov/div898/handbook/prc/section2/prc242.htm)也展示了效应大小与样本量的关系：在其质量控制示例中，要以 5% 单侧显著性和 90% 检验功效识别缺陷率从 10% 变为 20%，近似需要 102 个样本，连续性修正后为 112 个。Agent 任务不应机械套用该数字，但它说明：希望识别的差异越小，所需证据通常越多。

### 任务覆盖与重复 Trial 是两个维度

不要用一个数字同时代表 Dataset 大小和运行次数：

~~~text
横向：更多不同 Case
  改善任务、输入和失败模式覆盖

纵向：同一 Case 多个独立 Trial
  估计该任务上的非确定性与可靠性
~~~

十个任务各跑一次不能说明稳定性；一个任务跑十次也不能说明广泛能力。

Anthropic 指出每个 Agent 任务都有自己的成功概率，同一任务这次通过、下次可能失败。需要根据产品目标选择第一次成功、至少一次成功或连续成功等不同指标。早期 Dataset 可以只对明显非确定或高风险的 Case 增加 Trial，但必须记录协议，不能把重跑成功覆盖原始失败。

## 为什么还需要私有或受控 Holdout

### 公开数据可能进入训练和调参闭环

公开 Benchmark 的题目、答案和讨论可能被包含在预训练、微调、合成数据或人工优化过程中。此时高分可能混合了泛化能力与对题目的直接或间接适应。

[GSM1k 的 NeurIPS 2024 研究](https://proceedings.neurips.cc/paper_files/paper/2024/hash/53384f2090c6a5cac952c598fd67992f-Abstract-Datasets_and_Benchmarks_Track.html)重新制作了一组在风格和复杂度上与 GSM8k 可比的新题。部分模型在新集合上的准确率最多下降 8 个百分点，多条模型谱系显示系统性过拟合迹象。

这个结果也有重要限定：论文同时报告，许多前沿模型几乎没有明显过拟合迹象，并且所有受测模型整体上仍能泛化到新题。因此，证据支持的是“污染和过拟合可能使部分公开分数偏高”，不是“所有公开 Benchmark 都无效”。

[LiveBench](https://proceedings.iclr.cc/paper_files/paper/2025/file/e4a46394ba5378b3f9a186a5b4c650d1-Paper-Conference.pdf)采用来自近期信息源、定期更新的问题来降低污染风险。它说明“新鲜度”本身可以成为 Dataset 设计的一部分，但持续更新仍需要稳定 Grader 和清晰版本，不能把不同月份的分数无条件直接比较。

### 自有 Holdout 防的是系统选择过拟合

个人或团队通常无法控制基础模型见过什么，但可以控制自己的开发流程是否反复看同一批正式测试任务。

建议至少区分：

~~~text
Development Set
  开发者可见
  可以读 Trace、修改 Prompt、修复失败

Decision Holdout
  不作为 Prompt 示例或调参反馈
  只在模型选择、里程碑或发布决策时运行
~~~

Holdout 被查看并用于修复后，它实际上已经转为 Development 或 Regression Case。要继续承担独立确认作用，就应补充新的未见任务。

### “私有”不是质量保证

私有 Dataset 只能减少某些泄漏通道，不能自动解决：

- 任务不代表真实使用；
- 成功标准错误或含糊；
- Grader 存在偏差；
- 反复查询 Holdout 后根据分数调参；
- 数据拥有者缺乏独立审计；
- 结果无法被外部复现；
- 任务随产品变化而过时。

TRUCE 在提出 Private Benchmarking 的同时，也专门讨论了对私有 Dataset 做质量审计的必要性。[关于发布 Benchmark 又不泄露答案的研究](https://arxiv.org/abs/2505.18102)则指出，隐藏测试集仍然依赖评测方可信度，也仍可能因为反复提交而产生 Test-set Overfitting。

所以最稳妥的组合不是“把全部题藏起来”，而是：

- 用公开 Benchmark 保留外部共同坐标；
- 用可见 Development Set 快速诊断和修复；
- 用小型受控 Holdout 检查是否只对已知题目优化；
- 用持续生产观测发现离线 Dataset 没覆盖的新分布；
- 定期让领域专家复核任务与 Grader。

## Dataset 如何成为长期资产

一次失败经过确认、脱敏和最小化后，应进入候选池。只有当它具备清晰 Outcome、可复现环境、参考解和防止同类回归的 Grader 时，才晋升为正式 Case。这样 Dataset 才是团队对真实失败模式的压缩记忆，而不是一次性考试题。

每个 Case 还应记录公开、进入 Prompt、用于训练、被开发者查看和从 Holdout 转出等暴露历史。暴露不意味着 Case 必须删除：它仍适合做回归，只是不再是未知泛化证据。

当用户分布、工具、权限、预算、Harness、Grader 或风险容忍度改变，出现新高影响失败，某个 Slice 饱和，或 Holdout 已被查看时，应复核 Charter 与 Dataset。Anthropic 将 Eval Suite 视为需要明确所有权和持续维护的活资产。

版本变化应留下可比性边界：

| 变化 | 处理方式 |
| --- | --- |
| 只修正文案且不改变任务语义 | Patch 版本，并验证旧结果仍可解释 |
| 修改 Fixture、Contract 或 Grader | 至少产生 Minor 版本并重跑基线 |
| 改变目标任务分布或决策用途 | 新 Major 版本，旧趋势在此处断开 |
| Holdout 被用于调试 | 迁移到 Development，并补充新 Holdout |
| 新增生产失败 | 标记来源、严重度和首次进入版本 |

不要为了保持曲线连续而静默修改 Dataset。历史不可比不是失败；没有记录不可比才是失败。

## 一个完整判断示例

假设个人维护一个可以检索公开资料并生成技术说明的 Agent，准备比较两个候选模型。

公开榜单显示候选 B 的通用推理分数更高，但真实工作还要求一手来源、引用支撑、隐私边界、成本预算，以及在证据不足时保留不确定性。第一版 Dataset 包含 30 个任务：

~~~text
14 个高频资料整理任务
 6 个过去出现过的引用与事实失败
 4 个来源冲突或证据不足任务
 3 个长上下文与工具异常任务
 3 个隐私、写操作和停止边界任务
~~~

在相同 Prompt、工具、预算和环境下，普通 Case 跑一次，高风险或明显非确定性 Case 跑三次，并按 Slice 展示。假设候选 B 在高频任务多通过 4 个，修复 5 个历史失败，平均成本增加 60%，同时在一次高风险 Trial 中写入了不允许保存的内容，那么结论不是“B 总分更高”，而是：

~~~text
能力与已知回归表现改善
+ 成本显著上升
+ 触发一个零容忍风险 Gate
= 当前不能发布，需要先修复风险并重新验证
~~~

这正是自有 Dataset 与公开榜单的差别：它把自己的价值函数和底线带进决策。

## 一页式检查清单

- 是否写清这组 Dataset 要支持的具体决策？
- 是否明确被测对象是模型、Harness、Agent 系统还是产品？
- 是否写出可以支持与不能支持的结论？
- 是否声明零容忍风险和发布 Gate？
- Case 是否来自手工检查、真实任务、确认失败或明确需求？
- 是否分别考虑任务频率、用户价值和失败风险？
- 是否同时包含正常、边界、异常和双向行为？
- 是否避免近义重复，并能按任务族、风险和来源切片？
- 每个 Case 是否有稳定 ID、版本、来源、Contract 和 Fixture？
- 参考解或人工基线是否证明任务可解？
- 环境和 Grader 是否独立，Trial 是否从干净状态开始？
- 数据是否已经脱敏并完成权限检查？
- 是否区分 Case 数量与每个 Case 的 Trial 数量？
- 是否在小样本结论中保留范围和不确定性？
- 是否避免用微小分差宣布稳定排名？
- 是否报告 Case、Slice 和失败类型，并区分基础设施错误？
- Development 与 Decision Holdout 的用途是否分开？
- 是否记录 Case 的公开、调试、训练和揭示历史？
- Holdout 被查看后是否补充新任务？
- Dataset、Contract 或 Grader 改变时是否更新版本并重跑基线？
- 是否有明确 Owner 和分布漂移复核条件？

## 本章产物

完成本章后，应得到三项轻量资产：

~~~text
agent-eval/datasets/
├── dataset-charter.yaml
├── case-inventory.yaml
└── baseline-summary.md
~~~

这还不是完整 Dataset。下一篇将进一步说明如何把真实工作转换为带 Input、Environment、Expected Outcomes、Forbidden Actions、Quality Rubric 和 Budget 的单个 Eval Case；再下一篇讨论如何让整组 Dataset 长期保持分层、平衡和健康。

## 公开参考

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — 初始任务规模、真实失败来源、平衡题集、多 Trial、Harness 与长期维护。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 任务特定 Eval、真实分布、生产与历史数据、典型和边缘 Case。
- [NIST AI RMF：Valid and Reliable](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/) — 预期使用条件、代表性测试集、分段结果和外部有效性。
- [SWE-bench: Can Language Models Resolve Real-World GitHub Issues?](https://proceedings.iclr.cc/paper_files/paper/2024/hash/edac78c3e300629acfe6cbe9ca88fb84-Abstract-Conference.html) — 真实软件任务 Benchmark 的构成与适用范围。
- [OpenAI：Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 任务歧义、测试与环境问题如何改变 Benchmark 结论。
- [The Benchmark Lottery](https://arxiv.org/abs/2107.07002) — Benchmark 任务选择如何影响算法相对排名。
- [A Careful Examination of Large Language Model Performance on Grade School Arithmetic](https://proceedings.neurips.cc/paper_files/paper/2024/hash/53384f2090c6a5cac952c598fd67992f-Abstract-Datasets_and_Benchmarks_Track.html) — 用新建 GSM1k 检查公开 GSM8k 的污染与过拟合。
- [LiveBench: A Challenging, Contamination-Limited LLM Benchmark](https://proceedings.iclr.cc/paper_files/paper/2025/file/e4a46394ba5378b3f9a186a5b4c650d1-Paper-Conference.pdf) — 用近期来源和定期更新降低测试集污染。
- [NIST：Exact confidence intervals for a binomial proportion](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm) — 小样本成功率区间的计算与解释。
- [NIST：Sample sizes required for testing proportions](https://www.itl.nist.gov/div898/handbook/prc/section2/prc242.htm) — 效应大小、显著性、功效与样本量的关系。
- [TRUCE: Private Benchmarking to Prevent Contamination](https://www.microsoft.com/en-us/research/publication/truce-private-benchmarking-to-prevent-contamination-and-improve-comparative-evaluation-of-llms/) — 私有评测的污染防护与 Dataset 审计问题。
- [How Can I Publish My LLM Benchmark Without Giving the True Answers Away?](https://arxiv.org/abs/2505.18102) — 私有测试仍面临重复查询过拟合、可信度和维护成本。
