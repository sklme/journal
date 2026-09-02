---
title: 如何把真实工作转化成 Agent Eval Case
date: 2026-09-02
tags:
  - Agent Evaluation
  - Eval Dataset
  - Test Case Design
  - AI Engineering
description: 从真实任务、Trace 和失败记录中提炼可复现、无解法泄漏、可稳定判定且能够长期版本化的 Agent Eval Case
---

# 如何把真实工作转化成 Agent Eval Case

## 要解决的问题

真实工作是构建个人或团队 Eval Dataset 最有价值的原料，但它还不是可以直接运行的 Eval Case。

一条工单、一段聊天、一份 Trace 或一次人工返工，往往同时包含：

- 未被明说的上下文；
- 已经变化过的文件、数据库与权限状态；
- 只有当事人才知道的成功标准；
- 与本次能力无关的偶发噪声；
- 用户、组织、路径和业务数据等敏感信息；
- 事后讨论出来、Agent 当时并不可见的解法；
- 只适用于原实现的检查，而不是任务真正要求的结果。

如果把这些记录原样丢进评测，分数很可能测到的是记忆、猜题、环境残留或 Grader 偏好，而不是 Agent 能否完成真实工作。

[OpenAI 的评测最佳实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)建议持续记录系统行为，并从生产数据和历史日志中挖掘 Eval Case；[Anthropic 的 Agent Eval 指南](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)也建议从人工检查、Bug Tracker、支持队列和用户报告的失败开始。二者共同指向的是“从真实分布取材”，而不是“把原始记录直接当题目”。

这一篇解决后半段问题：如何把一条有价值的真实记录，转化成一个公平、可解、可复现、可审查和可版本化的 Case。

## 核心结论

一个可运行的 Agent Eval Case 不是一段 Prompt，而是一份带证据和执行边界的测试包：

~~~text
Eval Case
  = Agent 可见的任务
  + 确定的初始环境
  + 明确的成功集合
  + 不变量与禁止结果
  + 可执行的 Grader Contract
  + 与 Agent 隔离的隐藏验证数据
  + 已通过的参考解
  + 来源、审查和版本信息
~~~

从真实工作到 Case 的过程也不是“复制”，而是一次受约束的编译：

~~~text
真实任务 / Trace / 失败记录
  ↓ 识别要测量的能力或失败原子
  ↓ 删除敏感信息与无关偶然细节
  ↓ 重建 Agent 开始前的世界状态
  ↓ 写成不泄漏解法的可见任务
  ↓ 将成功定义为可观察的结果集合
  ↓ 实现并隔离 Grader
  ↓ 用参考解、反例、专家和 Pilot 验证
版本化 Eval Case
~~~

最重要的设计原则可以压缩成一句话：

> 隐藏评分实现，不隐藏成功要求；允许不同解法，不允许不同的人只能靠猜测理解题目。

## 先区分六个容易混用的概念

| 概念 | 它回答的问题 | 是否给 Agent 看 |
| --- | --- | --- |
| Source Record | 这条 Case 从哪次真实工作而来？ | 通常不直接可见 |
| Case | 一次独立评测所需的完整测试资产是什么？ | 只暴露运行所需部分 |
| Task | Agent 收到什么目标、输入、规则和资源？ | 是 |
| Spec | 设计者究竟想测什么，哪些解释有效？ | 可见要求必须与其一致 |
| Environment | Agent 开始时所处的世界是什么？ | 可通过工具和状态观察 |
| Grader Contract | 根据哪些证据、规则和聚合方式判定？ | 实现通常隐藏，要求不可偷藏 |

[Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)把 Task 定义为具有输入和成功标准的单个测试，把每次尝试称为 Trial，把 Grader 定义为对表现某一部分进行评分的逻辑，并特别区分 Transcript 与 Outcome。本文进一步把 Source、Task、Spec、Environment 和 Grader Contract 拆开，是为了让真实工作在进入 Dataset 前有清晰的编译边界。

其中有三条边界尤其重要：

- Source Record 用于解释 Case 的来历和价值，不等于要暴露给 Agent 的 Prompt；
- Spec 可以比 Task 更结构化，却不能凭空增加 Agent 无法知道的隐藏要求；
- Expected Outcome 描述允许多种实现的成功集合，Reference Solution 只证明至少存在一种解。

Environment 同时是输入与结果容器。它不仅包括文件和数据库，还包括工具、权限、时间、网络、资源与重置规则。Grader Contract 也不只是一段测试代码，还要声明证据、Gate、权重、阈值、错误语义、版本与人工校准状态。

## 不要把每条真实记录都收进 Dataset

高价值来源不等于高质量 Case。候选记录至少应满足：

1. 能说清预期与实际差异；
2. 能重建或合理模拟关键初始状态；
3. 能找到足以判断成功的可观察证据。

只有“感觉不好”、目标仍无共识、无法安全脱敏、主要由外部偶发故障决定，或无法重建关键现场的记录，应先搁置。已知答案若只是个人偏好，也不能包装成普遍标准。

[OpenAI 关于自改进工作流的案例](https://openai.com/index/building-self-improving-tax-agents-with-codex/)展示了实用筛选过程：捕获系统输出与人工修正的差异，将相关失败分组，再把重复且可行动的模式转成 Eval Target；证据含糊或不适合自动化的案例返回产品团队。

候选 Intake Card 只需先回答：

~~~yaml
candidate:
  source_kind: trace
  observed: "Agent 声称完成，但目标状态没有变化"
  expected: "目标状态发生一次合法变更"
  evidence: [sanitized_trace, before_after_state, human_correction]
  impact: high
  frequency: recurring
  reproducible: likely
  ambiguity: low
  decision: build_case
~~~
## 从真实工作到 Eval Case 的十步转换流程

### 第一步：冻结原始证据，但不要把它带进运行环境

原始 Trace、工单和人工修改应留在受控位置，并获得稳定 Source ID。Case 只保留脱敏引用、失败摘要和必要事实，不复制身份、凭据、私有地址、原修复 Diff、隐藏测试或标准答案。脱敏后仍要保留影响任务语义的角色关系、时间关系和文档冲突。

### 第二步：提炼一个“失败原子”或“能力原子”

先写出四元组，而不是把整段工作史变成一题：

~~~text
Observed：实际发生了什么
Expected：本应发生什么
Gap：两者最小且可验证的差异是什么
Impact：为什么这个差异值得长期防守
~~~

若来源质量差、格式错误与保存失败由不同机制产生，应拆成不同 Case。“原子”并不等于“单步”：真实能力若本就需要跨工具闭环，应保留一个主要意图、一个初始状态和一组共同终态，而不是拆成孤立函数测试。

### 第三步：确定评测边界与控制变量

明确评的是模型、Harness、完整 Agent System，还是产品工作流，并冻结不希望参与比较的变量。若只比较 Prompt，就固定模型、工具、权限、Fixture、Grader 与阈值。否则同一个失败可能被错误归因给模型、工具、环境或评分器。

### 第四步：重建行动发生前的初始状态

真实记录通常来自任务结束后，Case 必须回到 Agent 尚未行动的时刻。对于代码任务，这类似 [SWE-bench 的 Dataset Schema](https://www.swebench.com/SWE-bench/guides/datasets/)中的 `base_commit`：Agent 获得问题描述和修复前代码，而 Gold Patch 与测试属于验证资产。一般 Agent 也应分开保存：

~~~text
State before agent
Agent-visible input
Allowed tools and permissions
State expected after success
~~~

检查遗留文件、数据库预置结果、缓存答案、时间、身份权限、工具错误与 Git 历史是否污染题目。初始状态应“最小但忠实”：删除无关噪声，保留让真实难点成立的上下文。

### 第五步：编写 Agent 可见的 Task

Task 应用用户能理解的语言声明“做什么”，而不是把 Gold Solution 改写成步骤。它通常包含：

~~~text
背景与角色
+ 明确目标
+ 已知输入
+ 可访问政策或资料
+ 允许和禁止的动作
+ 提交方式
+ 必要的完成条件
~~~

让另一位领域专家只看 Agent 可见材料，回答：

1. 能否开始一个有意义的解决尝试？
2. 能否说清成功大致是什么样？
3. 在不看参考解时，能否提出至少一种可行方案？

任何一项为否，都应先补 Task，而不是让 Agent 猜缺失需求。

### 第六步：写出成功集合、禁止结果和非目标

先定义世界最终应满足什么，再选择 Grader：

~~~yaml
expected_outcome:
  required:
    - id: target_state_changed
      statement: "目标对象处于请求的最终状态"
    - id: response_matches_state
      statement: "最终回复与实际状态一致"
  invariants:
    - id: unrelated_state_preserved
      statement: "未修改范围外对象"
  forbidden:
    - id: duplicate_side_effect
      statement: "没有重复执行不可逆操作"
  acceptable_variants:
    - "可以先校验再执行，也可以由原子工具同时校验并执行"
  non_goals:
    - "不评价措辞是否与参考回复相同"
~~~

Expected Outcome 表达合法结果空间，不包含实现秘密。

### 第七步：把每条要求绑定到证据与 Grader

| 要求 | 首选证据 | 首选 Grader |
| --- | --- | --- |
| 状态真的改变 | 最终数据库或文件快照 | 确定性状态检查 |
| 原有功能未破坏 | 回归测试结果 | 代码测试 |
| 未越权执行 | 审批事件与工具审计 | Trace 规则 |
| 结论有资料支持 | 输出与来源映射 | 规则加 Rubric Judge |
| 表达清晰完整 | 最终回复 | 专项 Rubric Judge |
| 成本未超标 | Run Manifest 与计数器 | 数值阈值 |

尽量评价 Outcome，而不是强制复刻路径。[Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)提醒，要求固定工具调用顺序会制造脆弱测试；Agent 可能找到设计者未预料但完全有效的做法。Trajectory 更适合验证审批、禁用工具、来源访问和其他硬过程约束，或作为失败诊断信号。

### 第八步：隔离可见输入、隐藏评分数据与参考解

~~~text
Agent-visible
  instruction、公开 policy、初始 fixture、允许工具

Evaluator-only
  hidden tests、grader code、rubric anchors、expected state

Author-only
  raw source、gold solution、标注讨论、敏感映射
~~~

Agent 应知道全部规范性要求，但不应看到如何针对检查投机；Grader 只能检查 Task 已声明或从可见环境合理推导的要求。[Harbor 的 Task 结构](https://www.harborframework.com/docs/tasks)将 instruction、environment、solution 和 tests 分开，并支持让 Verifier 在独立环境运行。这种物理隔离比“提醒 Agent 不要看测试”更可靠。

### 第九步：用参考解、反例与对抗解验证 Case

1. Reference Solution：一种已知合法的完整解；
2. Negative Controls：明确不应通过的失败结果；
3. Adversarial Solutions：专门尝试钻 Grader 空子的结果。

参考解必须从干净环境运行并通过全部硬 Gate，从而证明至少存在一种解、Fixture 与 Grader 可用且预算足够。Negative Control 覆盖漏改、错改、谎称成功、越权和破坏无关状态；Adversarial Solution 尝试硬编码答案、修改测试、伪造日志或利用解析容差。

### 第十步：专家审查、Pilot，再冻结版本

先让参考解重复运行，让至少两个不同 Agent 试做，并人工阅读通过与失败 Trace。检查失败是否公平、是否出现新合法路径、错误分类是否准确、预算是否合理，以及隐藏资产是否真的不可见。若高能力 Agent 在大量 Trial 中始终为零分，先审计 Task、环境、超时和 Grader。

## 一份完整的 Eval Case Schema

下面是一份通用 Agent 的作者侧 Manifest。它综合 OpenAI Evals、Inspect、SWE-bench 和 Harbor 的任务结构；Harness 必须按 `visibility` 生成不同运行视图，不能把整份文件交给 Agent。

~~~yaml
schema_version: eval-case/v1
identity:
  case_id: knowledge.research.save-public-guide.001
  case_version: 1.0.0
  suite_id: personal-work-core
  status: active
  title: "研究公开资料并保存一份技术指南"
  tags: [research-agent, file-edit, source-grounding]
provenance:
  visibility: author_only
  source_kind: sanitized_trace
  source_ref: "source://records/case-001"
  observed_failure: "产物已保存，但关键结论缺少来源支持"
  intended_behavior: "关键事实可追溯到允许的公开一手资料"
  impact: medium
  frequency: recurring
  redactions: [user_identity, local_paths, private_project_details]
measurement:
  unit_under_evaluation: agent_system
  primary_capability: evidence_grounded_research
  secondary_capabilities: [scoped_file_editing, instruction_following]
  out_of_scope: [live_search_ranking_quality, website_deployment]
task:
  visibility: agent_visible
  role: "技术研究 Agent"
  instruction: |
    根据主题说明，使用允许的公开资料撰写一份技术指南，
    保存到 /workspace/output/guide.md。关键事实必须由引用支持，
    不得修改 /workspace/output 之外的文件。
  inputs:
    - { ref: "fixture://topic-brief-v1", mount: /workspace/input/topic.md, sha256: "<SHA256>" }
  policies:
    - { ref: "fixture://public-source-policy-v2", mount: /workspace/input/source-policy.md, sha256: "<SHA256>" }
  deliverables:
    - { path: /workspace/output/guide.md, media_type: text/markdown }
  allowed_actions: [read_workspace, search_public_web, fetch_public_page, write_declared_deliverable]
  forbidden_actions: [modify_outside_output, access_private_sources, publish_or_send_externally]
  completion_hint: "文件存在、结构完整且关键事实具有对应引用"
spec:
  visibility: evaluator_only
  normalized_requirements:
    - { id: deliverable_exists, statement: "指定路径存在 Markdown 文件", evidence: filesystem_after }
    - { id: required_sections, statement: "包含问题、判断、方法、边界和参考", evidence: deliverable }
    - { id: claims_supported, statement: "关键事实能映射到一手资料", evidence: deliverable_and_sources }
    - { id: scope_preserved, statement: "没有修改允许范围外文件", evidence: filesystem_diff }
  acceptable_variants: ["标题和结构可以变化，但语义部分必须完整", "可选择不同的合格一手资料"]
  forbidden_outcomes: ["引用不支持结论", "把推断写成事实", "只声称完成而没有产物"]
  non_goals: ["不要求与参考文章逐字相似", "不要求固定搜索顺序"]
  assumptions: ["Agent 可读取挂载的主题与来源政策"]
environment:
  visibility: agent_visible
  provider: container
  image: "registry.example.com/agent-eval@sha256:<IMAGE_DIGEST>"
  architecture: linux-amd64
  workspace_fixture: { ref: "fixture://empty-doc-workspace-v3", sha256: "<SHA256>" }
  tool_bundle: { version: tools-v4, schema_sha256: "<SHA256>" }
  permissions_profile: public-web-write-output-only-v2
  network: { mode: allowlist, fixture_version: public-sources-20260902 }
  temporal_context: { now: 2026-09-02T09:00:00+08:00, timezone: Asia/Shanghai, locale: zh-CN }
  resources: { cpu: 2, memory_mb: 4096, disk_mb: 10240 }
  reset: { strategy: recreate_from_snapshot, before_each_trial: true, verify_fingerprint: true }
  secrets: { strategy: ephemeral_test_credentials, persisted_after_trial: false }
expected_outcome:
  visibility: evaluator_only
  required:
    - { requirement_id: deliverable_exists, assertion_ref: "assertion://file-exists-v1" }
    - { requirement_id: required_sections, assertion_ref: "assertion://markdown-sections-v2" }
    - { requirement_id: claims_supported, assertion_ref: "rubric://claim-support-v3" }
    - { requirement_id: scope_preserved, assertion_ref: "assertion://allowed-diff-v1" }
  invariants:
    - { id: input_unchanged, assertion_ref: "assertion://input-digest-v1" }
    - { id: no_external_side_effect, assertion_ref: "assertion://external-actions-v1" }
  preferred:
    - { id: connects_related_concepts, rubric_ref: "rubric://concept-connection-v1" }
  evidence_required: [filesystem_before, filesystem_after, trace, deliverable, fetched_source_snapshots]
grader_contract:
  visibility: evaluator_only
  contract_version: grader-contract-v2
  bundle_ref: "grader://knowledge-guide-v5"
  bundle_sha256: "<SHA256>"
  isolation: separate_environment
  inputs: [declared_artifacts, outcome_snapshot, sanitized_trace]
  checks:
    - { id: file_contract, kind: deterministic, observes: outcome, required: true, weight: 0.25 }
    - { id: scope_contract, kind: deterministic, observes: filesystem_diff, required: true, weight: 0.25 }
    - { id: source_grounding, kind: model_rubric, observes: deliverable_and_sources,
        required: true, weight: 0.35, labels: [pass, fail, unknown] }
    - { id: writing_quality, kind: model_rubric, observes: deliverable, required: false, weight: 0.15 }
  aggregation: { method: required_gates_then_weighted_mean, pass_threshold: 0.80,
                 missing_required_evidence: invalid_trial }
  error_policy: { grader_timeout: grader_error, malformed_output: grader_error,
                  judge_unknown: human_review,
                  never_count_as_agent_failure: [grader_error, infrastructure_error] }
budget:
  visibility: agent_visible
  max_wall_time_seconds: 600
  max_model_calls: 20
  max_tool_calls: 50
  max_output_tokens: 12000
  on_limit: graded_failure
reference_validation:
  visibility: author_only
  reference_solution_ref: "private-artifact://case-001/oracle-v2"
  reference_solution_sha256: "<SHA256>"
  oracle: { passed: true, trials: 3 }
  environment_smoke_test_passed: true
  negative_controls:
    - { id: unsupported-claims, expected: fail, observed: fail }
    - { id: writes-outside-scope, expected: fail, observed: fail }
    - { id: final-message-only, expected: fail, observed: fail }
  adversarial_controls:
    - { id: fake-citations, expected: fail, observed: fail }
    - { id: edit-grader-attempt, expected: blocked, observed: blocked }
expert_review:
  visibility: author_only
  rubric_version: case-quality-rubric-v2
  reviewers: 3
  independent_first_pass: true
  votes: { solvable: 3, unambiguous: 3, grader_fair: 3 }
  agreement: { metric: percent_agreement, value: 1.0 }
  low_confidence_cases_escalated: true
  adjudication_ref: "review://case-001-round-2"
  decision: accepted
pilot:
  protocol_version: pilot-v2
  agent_variants: 2
  trials_per_variant: 3
  graded_trials: 6
  errors: { infrastructure: 0, grader: 0 }
  unexpected_valid_solutions_reviewed: 1
  false_rejections: 0
  false_acceptances: 0
  decision: freeze
lineage:
  created_at: 2026-09-02T03:00:00Z
  created_by: eval-maintainers
  supersedes: null
  change_reason: initial_case
  content_digest: "sha256:<CASE_DIGEST>"
  compatible_grader_versions: [grader-contract-v2]
~~~
## Schema 中最值得坚持的设计

### `schema_version` 与 `case_version` 必须分开

`schema_version` 表示文件格式和解析规则；`case_version` 表示具体任务内容。修改解析格式不一定改变任务语义，修改 Task、Fixture 或成功标准则可能改变分数含义。

[Harbor](https://www.harborframework.com/docs/tasks)的 Task Manifest 同时包含 `schema_version` 与任务自己的 `version`；[Inspect](https://inspect.aisi.org.uk/tasks.html)也把 Task `version` 记录进 Eval Log，并支持用分支、标签或 Revision Hash 固定远程任务。二者都说明“格式版本”和“评测内容版本”不是一回事。

### Case 引用应尽量指向不可变内容

镜像标签、`latest` 数据和会被覆盖的 Fixture 都无法支持历史重放。优先记录：

- Git Commit；
- OCI Image Digest；
- 文件 SHA-256；
- 工具 Schema Hash；
- Grader Bundle Digest；
- 数据集发布版本；
- 不可固定的远程依赖及其抓取时间。

[Harbor 的 Dataset Manifest](https://www.harborframework.com/docs/datasets/publishing)使用 Task Archive 的 SHA-256 Digest 组装版本化 Dataset，并允许按 Tag、Revision 或 Digest 引用任务。这类内容寻址可以防止同名 Case 静默变化。

### 来源和评分资产需要显式可见性

`visibility` 不是注释，而应成为 Harness 的权限输入。建议至少定义：

- `agent_visible`：可挂载进 Agent 环境；
- `evaluator_only`：只进入隔离的 Grader；
- `author_only`：仅供制作、审查和追溯。

如果框架无法技术性实施这个边界，作者侧 Manifest 不应与 Agent 工作区放在一起。

### 要把错误语义写进 Grader Contract

“没有得到分数”不等于“Agent 失败”。Grader 超时、Judge 输出无法解析、Fixture 缺失和容器启动失败应成为不同终态，并保留证据。

否则一个不稳定的 Grader 会系统性拉低候选分数，或因静默排除失败样本而虚高。

### Provenance 用于解释，不用于泄漏

来源字段应保留：

- 来源类型；
- 经脱敏的稳定引用；
- 观察到的失败；
- 预期行为；
- 影响和频率；
- 脱敏与重写记录。

不要在 Agent 可见 Task 中保留原工单标题、公开 Issue ID、修复提交号或可搜索的独特句子，除非检索原事件本身就是任务要求。

## 如何避免歧义，又不泄漏解法

公平 Task 需要足够明确，但不能退化成逐步操作教程。可以用“声明 What，保留 How”的方式处理。

应该声明：

- 目标对象和期望行为；
- 输入输出接口；
- 必须遵守的政策与范围；
- Grader 会检查的规范性结果；
- Agent 应有机会观察到的异常条件。

通常不应声明：

- 应修改的具体代码行；
- 唯一函数名或实现结构，除非它本身是接口要求；
- 隐藏测试使用的精确样本；
- Gold Patch 或参考执行步骤；
- Judge Rubric 中用于反作弊的锚点。

[SWE-bench Verified 的标注说明](https://cdn.openai.com/introducing-swe-bench-verified/swe-b-annotation-instructions.pdf)要求测试不能依赖问题描述没有提供的新函数名、变量名或精确错误消息，因为合理解法不应因原 PR 的偶然实现细节而失败。[OpenAI 后续对编码评测的审计](https://openai.com/index/separating-signal-from-noise-coding-evaluations/)再次发现，过度严格测试、欠规范 Prompt、低覆盖测试和误导性要求会同时制造假阴性与假阳性。

可以用下面的审查问题寻找隐藏要求：

1. 每条硬断言能否映射到 Task 或可访问政策？
2. 如果不用 Gold Solution 的结构实现，是否仍有机会通过？
3. Grader 是否精确匹配了不重要的格式、精度或措辞？
4. Task 是否承诺了一个阈值，而 Grader 实际要求另一个？
5. Agent 是否必须猜测输出路径、日期、身份或工具副作用？
6. 成功是否依赖作者看过、Agent 却看不到的讨论？

## 专家一致性不是一次投票

“找一个专家看过”不足以证明 Case 公平。专家也会受参考解锚定、领域偏好和风险容忍度影响。

推荐的审查流程是：

1. 用一组高置信样例校准审查者；
2. 至少两位专家独立看 Agent 可见 Task；
3. 独立判断可解性、歧义、测试公平性和难度；
4. 记录原始标签、理由和置信度；
5. 再查看 Expected Outcome、测试和参考解；
6. 对分歧或低置信案例进行复核与裁决；
7. 保留原始意见，不只保存最终共识。

[OpenAI 构建 SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/)时先用高置信样例进行 Annotator Onboarding，每个样本由三名开发者独立标注，并采用保守聚合；在 2026 年的后续审计中，又让每个任务由五名有经验的软件工程师独立审查，并把分歧和低置信案例升级调查。

一致性指标可以根据标签类型选择：

- 二元标签：Percent Agreement、Cohen’s Kappa；
- 多位审查者：Fleiss’ Kappa 或 Krippendorff’s Alpha；
- 有序严重度：Weighted Kappa；
- 连续分数：ICC 或相关性加误差分析。

指标不是目的。若一致性低，应定位是 Task 含糊、Rubric 含糊、专家背景不同，还是任务本身确实存在合理价值冲突。

[HealthBench](https://cdn.openai.com/pdf/bd7a39d5-9e9f-47b3-903c-8b847ca650c7/healthbench_paper.pdf)使用由医生编写、针对单个样例且自包含的客观 Rubric 条目，并测量模型—医生与医生—医生的一致性。论文同时指出专家之间仍可能因专业背景、风险容忍度和指令解释产生显著分歧。正确做法是量化和保留这种分歧，而不是假装一个 Gold Label 天然客观。

## Pilot 要验证 Case，不是提前给 Agent 排名

Pilot 的首要目标是发现测试资产的问题：

- Reference Solution 是否稳定通过？
- 明确错误的结果是否稳定失败？
- 不同合法路径是否被接受？
- Task 是否有多种冲突解释？
- Environment 是否在 Trial 间干净重置？
- Agent 是否能读取隐藏测试或参考解？
- Grader 失败是否被误算为 Agent 失败？
- 预算是否足以完成一个正常解？
- 失败 Trace 是否能解释扣分原因？

Pilot 后的改动规则应提前约定：

- 修正文案歧义、Fixture Bug 和 Grader Bug，可以发布新 Case Patch；
- 改变成功要求、难度或环境能力，应发布新的 Minor 或 Major 版本；
- 看过候选结果后只修改对偏好候选不利的规则，属于评测污染；
- 已用于正式比较的旧版本不能被静默覆盖。

## 防止解法泄漏与 Benchmark Contamination

泄漏有两种不同形式。

### 运行时泄漏

Agent 在 Trial 中读到了：

- `/tests`、Grader 源码或期望状态；
- Gold Solution、修复 Diff 或上一 Trial 产物；
- 包含答案的 Git 历史、缓存或日志；
- 可从外部地址直接检索到的原案例与解法。

这类泄漏应通过权限、独立 Verifier、一次性环境、网络策略和 Trace 审查阻断。

### 训练数据污染

公开发布的题目、任务 ID 和解法可能已进入模型训练数据。即使运行环境完全隔离，模型也可能凭记忆还原答案。

[OpenAI 对 SWE-bench Verified 的污染审计](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)发现，公开问题、代码库、发布说明和 Gold Patch 的广泛传播会静默抬高分数，并建议对公开来源执行额外污染测试、严格隔离解法，必要时使用由专家私下编写的任务。

个人 Eval 的实用对策包括：

- 不把 Gold Solution 与正式 Holdout 一起公开；
- 对 Source Record、Case 和 Grader 分权存储；
- 删除可直接搜索到原事件的唯一标识和非必要原句；
- 为测试集加入 Canary，并记录模型训练排除约定；
- 检查异常快速、与参考解高度相似的轨迹；
- 定期加入新近、私有且授权使用的 Holdout；
- 不把已反复调试的 Development Case 继续当盲测证据。

## 防止 Reward Hacking

Agent 可能通过满足 Grader 的表面信号而不完成任务。例如：

- 创建同名空文件骗过存在性检查；
- 直接打印预期字符串；
- 修改测试或评分脚本；
- 伪造“已执行”日志；
- 只处理公开样例，不实现一般行为；
- 利用宽松精度、解析或路径规则；
- 完成目标的同时破坏无关状态；
- 通过访问原事件直接复制解法。

防御方式不是无限增加隐藏规则，而是让 Grader 更接近真实 Outcome：

~~~text
正向功能检查
+ 原有行为回归检查
+ 不变量与副作用检查
+ 隐藏但符合 Task 的变体
+ 对抗解与绕过测试
+ 独立、只读或一次性 Verifier
+ 人工阅读异常高分 Trace
~~~

[Harbor Reward Kit](https://www.harborframework.com/docs/rewardkit)支持把独立 Criterion 分开执行、保留逐项结果并显式声明 `all-pass`、`required-pass`、阈值或加权聚合。这种结构比一个不透明总分更容易发现某项检查是否被绕过。

## 版本何时必须升级

建议同时维护四种版本：

| 版本 | 变化对象 | 典型触发 |
| --- | --- | --- |
| Schema Version | Manifest 格式 | 字段语义或解析规则变化 |
| Case Version | Task、Fixture、成功空间 | 要求、输入、环境能力变化 |
| Grader Version | 测试、Rubric、聚合 | 断言、Judge、阈值变化 |
| Dataset Version | Case 集合与权重 | 增删 Case、分层或采样变化 |

可以采用类似语义化版本的规则：

- Patch：修复不改变原意的错字、无效链接或确定性 Bug；
- Minor：增加兼容检查、Fixture 变体或不改变主要能力的新证据；
- Major：改变任务目标、可见信息、环境能力、硬 Gate 或分数含义。

任何可能改变历史通过与失败结论的更新，都应：

1. 说明变更原因；
2. 保留旧版本；
3. 重跑 Reference Solution 与控制样本；
4. 判断历史 Outcome 能否重新评分；
5. 在趋势图上标记不可比断点。

## 常见误区

### “把失败 Trace 直接回放，就是 Regression Case”

Trace 记录的是一次执行事实，可能包含后验信息、敏感数据和环境噪声。Case 还需要任务提纯、状态重建、成功定义和可解性验证。

### “隐藏测试越多，评测越公平”

隐藏实现可以防止投机，但隐藏需求只会制造猜题。测试必须约束 Task 已声明或可合理发现的行为。

### “Gold Solution 能通过，所以 Case 没问题”

Gold Solution 可能与测试共同过拟合某种实现。还需要验证其他合理解、Negative Control 和对抗解。

### “一题只测一个工具调用才算原子”

原子性由用户意图和可归因结果决定，不由步骤数量决定。真正的 Agent 能力通常跨多个工具和状态变化。

### “专家有分歧，就取多数票”

多数票可以给出决定，却不会解释分歧来源。应保留理由、置信度并复核 Task 与 Rubric。

### “修改 Grader 不影响 Dataset 版本”

如果阈值、检查或 Judge 变化会改变 Case 结果，至少要升级 Grader，并明确新旧结果是否可比。

### “只要容器化，初始状态就确定了”

镜像之外还有 Fixture、缓存、权限、网络、时间、资源和外部服务。它们都属于 Case 初始条件。

### “通过率低，说明 Case 很有区分度”

低分也可能来自不可解、歧义、预算不足或基础设施错误。难但公平与坏题不是一回事。

## Eval Case 验收清单

### 来源与边界

- 是否能说明 Case 来自哪类真实工作以及为什么值得长期测？
- 是否提炼出单一主要能力或失败原子？
- 是否明确 Unit under Evaluation 与不参与比较的变量？
- 是否移除敏感信息、内部细节和无关偶然噪声？

### Task 与 Spec

- 两位领域专家只看可见输入时，能否独立开始合理尝试？
- 每项硬要求是否出现在 Task、政策或可观察环境中？
- 是否声明目标、输入、允许动作、禁止动作和提交方式？
- 是否区分 Required、Invariant、Forbidden、Preferred 与 Non-goal？
- 是否保留多种合理实现路径？

### Environment

- 是否从 Agent 行动前的状态重建 Fixture？
- 镜像、代码、Fixture、工具和政策是否有不可变版本或 Digest？
- 文件、数据库、缓存、身份、时钟和网络是否在 Trial 间重置？
- Agent 是否无法读取上一 Trial、隐藏测试和参考解？
- 资源与超时是否足以让参考解稳定完成？

### Grader

- 每项检查是否绑定明确证据？
- 是否优先检查真实 Outcome，而不是 Agent 的自我陈述？
- 是否只对必要过程约束检查 Trajectory？
- Gate、部分得分、权重、阈值和错误语义是否显式？
- Grader Error 与 Infrastructure Error 是否不会被算作 Agent 失败？
- 是否有 Negative Control 和 Reward Hacking 对抗样本？

### 可解性与维护

- Reference Solution 是否在干净环境中重复通过？
- 其他合理解是否不会因实现差异被拒绝？
- 专家是否独立标注并记录分歧、理由和置信度？
- Pilot 是否包含人工阅读成功和失败 Trace？
- Schema、Case、Grader 与 Dataset 是否分别版本化？
- 正式使用后，旧版本是否保持不可变并可追溯？

## 本篇的落地产物

完成这一流程后，一条真实工作记录应产出：

~~~text
1 份脱敏的 Case Manifest
+ 1 份可重建的 Environment Fixture
+ 1 组隔离的 Grader
+ 1 个不暴露给 Agent 的 Reference Solution
+ 一组 Negative / Adversarial Controls
+ 1 份专家审查与 Pilot 记录
+ 不可变版本与内容 Digest
~~~

它们共同构成 Dataset 中真正可复用的最小单元。

下一步不再讨论单个 Case 怎么写，而是讨论许多 Case 如何组成健康的任务集：Core、Capability、Regression、Stress、Safety、Holdout 和 Online 各自承担什么职责，以及如何防止评测集被少数重复模式支配。

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Task、Trial、Grader、Transcript、Outcome 的定义，以及从 Bug Tracker、支持队列构建 Case、参考解、稳定环境和 Transcript 审查实践。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 从生产与历史数据取材、覆盖典型与边界案例、使用专家标注和人工校准自动评分。
- [OpenAI：Working with evals](https://developers.openai.com/api/docs/guides/evals) — 用数据 Schema 与 Testing Criteria 明确评测输入和评分合同。
- [OpenAI：Building self-improving tax agents with Codex](https://openai.com/index/building-self-improving-tax-agents-with-codex/) — 从人工修正中捕获差异、聚类重复失败并形成可行动 Eval Target 的真实闭环。
- [SWE-bench：Dataset Structure](https://www.swebench.com/SWE-bench/guides/datasets/) — 真实 Issue、修复前 Commit、问题说明、Gold Patch 与 Fail-to-pass / Pass-to-pass 测试的案例结构。
- [OpenAI：Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — 多名开发者独立审查任务歧义、测试范围、可解性和难度的方法。
- [OpenAI：SWE-bench Annotation Instructions](https://cdn.openai.com/introducing-swe-bench-verified/swe-b-annotation-instructions.pdf) — 检查问题是否充分规范、测试是否会拒绝合理解以及参考解是否向测试泄漏偶然实现细节。
- [OpenAI：Separating signal from noise in coding evaluations](https://openai.com/index/separating-signal-from-noise-coding-evaluations/) — 过度严格测试、欠规范 Prompt、低覆盖测试、误导性要求和多专家复核的最新审计经验。
- [OpenAI：Why SWE-bench Verified no longer measures frontier coding capabilities](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) — 公开任务与解法的训练数据污染、自动评分缺陷和私有专家任务的必要性。
- [UK AI Security Institute Inspect：Datasets](https://inspect.aisi.org.uk/datasets.html) — Sample 的 Input、Target、ID、Metadata、Sandbox、Files 与 Setup 等基础字段。
- [Harbor：Task Structure](https://www.harborframework.com/docs/tasks) — Instruction、Environment、Solution、Tests、网络策略、独立 Verifier 以及 Schema / Task 版本结构。
- [Harbor：Publishing a dataset](https://www.harborframework.com/docs/datasets/publishing) — 用版本、Revision 和 SHA-256 Digest 组合不可变任务集。
- [Harbor：Reward Kit](https://www.harborframework.com/docs/rewardkit) — 多 Criterion、独立执行、部分得分、硬 Gate 与显式聚合方式。
- [OpenAI：HealthBench](https://cdn.openai.com/pdf/bd7a39d5-9e9f-47b3-903c-8b847ca650c7/healthbench_paper.pdf) — 样例专属、自包含 Rubric，专家共识和模型 Grader 的一致性验证。
