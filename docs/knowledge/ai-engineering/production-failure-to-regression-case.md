---
title: 如何把生产失败转化成 Regression Case
date: 2026-10-13
tags:
  - Agent Evaluation
  - Regression Testing
  - Incident Response
  - Dataset
description: 从生产证据、人工归因、稳定复现到脱敏 Case Family，建立能够长期阻止 Agent 失败复发的闭环
---

# 如何把生产失败转化成 Regression Case

## 要解决的问题

线上出现一次 Agent 失败后，团队常见的处理是：

1. 找到一段对话或 Trace；
2. 修改 Prompt 或工具逻辑；
3. 手工确认这条样本跑通；
4. 把原始输入复制到“回归题库”；
5. 继续发布。

这条路径看似闭环，实际上留下了很多缺口：

- 原始 Trace 含用户数据、凭证、文件和内部地址，不能直接进入长期 Dataset；
- 失败可能来自基础设施、Grader 或任务定义，而不是 Agent；
- 修改后的环境已经变化，Case 无法重放；
- Case 只记住一条字符串，没有记住因果特征；
- 修复可能只针对原句，稍微改写就再次失败；
- 新 Case 没有可靠 Grader，只能继续人工看；
- Case 永久堆积，却没有 Owner、版本和退休规则。

真正需要的是一条受治理的晋升链：

~~~text
Production Signal
  ↓
Evidence Preservation
  ↓
Human Triage
  ↓
Controlled Reproduction
  ↓
Minimization + Sanitization
  ↓
Evaluation Contract + Grader
  ↓
Fail-before / Pass-after Validation
  ↓
Regression Case Family
  ↓
Release Gate + Production Monitoring
~~~

Regression Case 不是事故截图，而是一份可复现、可评分、可公开审查内部结构且能长期防止复发的测试资产。

## 先区分 Signal、Incident 与 Case

### Production Signal

Signal 是“可能有问题”的线索，例如：

- 用户点踩或投诉；
- 任务被人工接管；
- Guardrail 拦截；
- 工具调用异常；
- 业务终态与 Agent 声明不一致；
- 成本、延迟或循环次数异常；
- 在线 Judge 或规则检测到风险；
- 关键指标出现漂移。

Signal 不是事实结论。点踩可能来自产品预期差异，Guardrail 也可能误报。

### Incident

Incident 是经过初步验证、对用户或系统造成实际或潜在影响的事件。它需要记录影响、时间线、缓解措施、贡献因素和后续行动。

一场 Incident 可以产生多个 Regression Case；多个 Incident 也可能归属于同一个 Failure Family。

### Regression Case

Regression Case 是从事件中提炼出的稳定评测对象，包含：

- 最小但真实的任务语义；
- 可重建初始环境；
- Evaluation Contract；
- 隐藏评分证据；
- 至少一个可信 Grader；
- 失败血缘与适用边界；
- Case 版本、Owner 和生命周期。

三者不要混在一张表里。Signal 用于发现，Incident 用于响应和学习，Case 用于持续验证。

## 第一步：定义哪些生产事件必须进入 Triage

不是每条低质量反馈都值得立即制作 Case，但触发规则应在事故前声明。

### 必须进入的事件

- 未授权或不可逆外部操作；
- 隐私、凭证、权限或合规边界事故；
- 数据损坏或错误状态写入；
- 已知 Critical Regression 复发；
- 用户可见的错误结论导致实质影响；
- 监控没有及时发现、只能由用户报告的问题；
- 需要回滚、Kill Switch 或人工紧急接管的问题。

### 按风险和频率抽样的事件

- 普通任务失败；
- 质量下降或解释不清；
- 过度调用工具；
- 轻微延迟和成本异常；
- 非关键 Handoff 误差。

### Triage 队列字段

~~~yaml
signal:
  id: sig-2026-00127
  detected_by: user_feedback | monitor | guardrail | human_review
  observed_at: <TIMESTAMP>
  affected_product_surface: assistant_workflow
  preliminary_severity: high
  evidence_ref: evidence://restricted/sig-2026-00127
  containment_status: contained
  privacy_review_required: true
  triage_owner: evaluation-oncall
~~~

`evidence_ref` 指向受限证据库，而不是把原始内容复制到工单和 Dataset。

## 第二步：先保全证据，再开始修改

修复会改变系统状态。若不先冻结证据，团队很容易只能依靠记忆复盘。

最低证据集合包括：

- Agent、模型、Prompt、工具和权限版本；
- Evaluation/Production Contract 版本；
- Trace 事件及可靠时间戳；
- 初始状态与最终可信状态；
- 工具请求、响应摘要和错误分类；
- 预算、Deadline、重试和人工介入；
- Guardrail、Monitor 和 Grader 结果；
- 已执行的缓解与回滚动作；
- 证据完整性和采集缺口。

但保全不等于无限复制。应同时生成两份视图：

~~~text
Restricted Incident Evidence
  原始内容，最小授权访问，短期保留

Sanitized Investigation Bundle
  默认脱敏，供复现、评测和协作使用
~~~

下一篇会详细讨论 Trace 的安全、隐私和数据治理；本篇只强调：原始生产数据不是默认可进入 Eval Dataset 的材料。

## 第三步：先归因“哪一层失败”

根据[评测对象的四层边界](./agent-evaluation-target-boundaries.md)，一次失败可能属于：

| 层次 | 典型问题 | 是否直接做 Agent Regression Case |
| --- | --- | --- |
| Model | 推理、知识或指令遵循问题 | 可能 |
| Agent Harness | 上下文、工具编排、记忆、终止策略 | 通常需要 |
| Complete System | Guardrail、权限、工具后端、状态一致性 | 需要系统级 Case |
| Product | 任务定义、交互、审批和用户预期 | 可能先修 Contract |

还要排除测量系统问题：

~~~text
Observed failure
├── Genuine Agent/System failure
├── Evaluation Contract gap
├── Grader error
├── Harness or infrastructure error
├── Telemetry loss
├── Product policy ambiguity
└── Expected behavior misunderstood by reporter
~~~

如果问题是 Grader 错拒合法答案，应修复 Grader 并增加 Grader 测试，而不是训练 Agent 迎合错误评分器。

### Triage 决议

~~~yaml
triage:
  decision: genuine_system_failure
  failure_layer: agent_harness
  failure_family: unsafe_retry_after_partial_write
  severity: critical
  user_impact: external_state_inconsistent
  contributing_factors:
    - ambiguous_tool_result
    - retry_policy_ignored_idempotency
  contract_gap: false
  grader_gap: false
  regression_case_required: true
~~~

避免只写“根因：模型幻觉”。这类标签太宽，无法指导复现、修复和 Grader。

## 第四步：建立受控复现，而不是重播原始对话

生产失败可能依赖：

- 特定工具返回；
- 某个权限状态；
- 部分写入后的中间状态；
- 并发和时序；
- 缓存、限流或网络故障；
- 上下文长度与历史消息；
- 模型、Prompt 和工具版本；
- 用户的后续澄清。

复现矩阵应逐步固定变量：

| 维度 | 原始条件 | 复现控制 |
| --- | --- | --- |
| Agent Bundle | 生产版本 | Digest 固定 |
| 初始状态 | 事件前状态 | Fixture 重建 |
| 工具响应 | 实时系统 | 录制后脱敏 Stub |
| 并发/时序 | 不确定 | 可控 Scheduler |
| 随机性 | 未知 | 多 Trial + 预声明 Seed |
| 外部副作用 | 已发生 | 沙箱或 Fake Gateway |
| Grader | 事后人工判断 | 可执行 Contract |

复现状态至少区分：

~~~yaml
reproduction_status:
  - CONFIRMED
  - PARTIAL
  - NOT_REPRODUCED
  - BLOCKED_BY_MISSING_EVIDENCE
  - INVALID_SIGNAL
~~~

`NOT_REPRODUCED` 不代表原事件不存在，只表示当前证据不足以稳定重建。此时应保留生产 Monitor 和人工调查，不要制造一个与原问题无关的假 Case。

## 第五步：最小化时保留因果特征

Case 最小化的目标不是把文本缩到最短，而是移除无关细节，同时保留触发失败的必要条件。

可以使用 Delta Debugging 思路：

1. 删除一段历史或一个环境因素；
2. 重跑足够多 Trial；
3. 判断 Failure Signature 是否仍存在；
4. 若存在则保留删除，否则恢复；
5. 直到每个剩余因素都有解释。

Failure Signature 不应只是输出字符串：

~~~yaml
failure_signature:
  required_precondition:
    external_state: partially_committed
    tool_response: ambiguous_timeout_after_commit
  forbidden_behavior:
    - retry_non_idempotent_write_without_state_check
  observable_effect:
    duplicate_external_record_count: 2
~~~

如果删掉“部分写入”后仍失败，可能它不是必要条件；如果把工具响应从“超时但已提交”改成“明确失败”后问题消失，模糊提交状态就是关键因果特征。

## 第六步：脱敏不是简单字符串替换

需要处理的不只是姓名和邮箱，还包括：

- 凭证、Cookie、Token、签名和 URL Query；
- 用户内容、代码、文件和附件；
- 内部域名、仓库、服务和网络地址；
- 数据库主键与可关联标识符；
- 工具 Schema 中的隐藏业务字段；
- 时间、地理和组合属性带来的重识别风险。

脱敏后的 Case 必须同时满足：

1. 无法恢复真实主体或内部系统；
2. 仍保留失败所需语义；
3. Fixture、Grader 和参考解都使用替代值；
4. 通过敏感信息扫描和人工复核；
5. 与原始证据只通过受控 Lineage ID 关联。

示例替换：

~~~yaml
sanitization:
  domain: example.com
  ipv4: 192.0.2.1
  account_id: <USER_ID>
  token: <TOKEN>
  repository: example-org/example-repo
  local_path: /path/to/project
~~~

若某个敏感字段本身就是失败触发条件，例如 Unicode 姓名、超长密钥格式或权限范围，应保留**结构特征**，而不是保留真实值。

## 第七步：重新写 Evaluation Contract

生产投诉经常是模糊的：“它做错了”“感觉不安全”“结果不好”。Regression Case 必须把它改成可判定契约。

~~~yaml
case:
  id: regression-unsafe-retry-001
  version: 1
  source:
    type: production_incident
    lineage_id: incident-family-unsafe-retry
    sanitized: true
  task:
    instruction: >-
      Complete the requested write exactly once. If the tool result is
      ambiguous, verify the external state before retrying.
  fixture:
    initial_state: no_record
    tool_behavior: commit_then_timeout_on_first_call
  required_outcomes:
    external_record_count: 1
    user_receives_truthful_status: true
  forbidden_outcomes:
    duplicate_record: true
    unverified_success_claim: true
  budget:
    maximum_write_calls: 2
  severity: critical
~~~

Contract 应允许多种正确路径。例如 Agent 可以先查询状态，也可以使用幂等键；Grader 应验证最终状态与禁止行为，而不是强迫它复制参考 Trace。

## 第八步：为真实 Failure 设计可信 Grader

优先级通常是：

1. 可信外部状态；
2. 确定性不变量；
3. Trace Rule；
4. 经过校准的 LLM Judge；
5. Human Review。

示例：

~~~ts
type Evidence = {
  finalRecordCount: number
  writeCalls: Array<{ idempotencyKey?: string; result: string }>
  userClaim: 'SUCCESS' | 'FAILURE' | 'UNKNOWN'
}

export function grade(evidence: Evidence): 'PASS' | 'FAIL' {
  if (evidence.finalRecordCount !== 1) return 'FAIL'
  if (evidence.userClaim === 'SUCCESS' && evidence.finalRecordCount !== 1) return 'FAIL'
  return 'PASS'
}
~~~

Grader 还要有自己的测试：

- Reference Solution 能通过；
- 原始失败重放能失败；
- 合法替代方案能通过；
- 伪造最终回答但未改变状态会失败；
- 证据缺失返回 `UNSCORABLE` 或 Grader 状态，不伪造 Agent Outcome。

## 第九步：必须做 fail-before / pass-after

Regression Case 被接纳前至少验证四件事：

| 验证 | 目的 |
| --- | --- |
| Fail before fix | Case 确实捕获原失败，而不是事后编故事 |
| Pass after fix | 修复在相同协议下有效 |
| Pass reference solution | 任务可解、Grader 没写坏 |
| No unrelated regression | 修复没有破坏邻近能力 |

Agent 非确定时不能只各跑一次。应使用预声明 Trial 数和门槛：

~~~yaml
validation:
  before_fix:
    trials: 10
    forbidden_event_count: 4
    expected: reproduces_failure
  after_fix:
    trials: 30
    forbidden_event_count: 0
    required_pass_rate_lcb_minimum: 0.90
  reference_solution:
    trials: 3
    pass_required: 3
~~~

具体数值取决于风险和成本；Critical Case 通常要同时满足零容忍事件和足够证据上界。

## 第十步：从一条 Case 扩展为 Case Family

只保存原始输入会诱导 Patch Overfitting。更稳健的资产是一组围绕 Failure Mechanism 的邻域样本：

~~~text
Failure Family: ambiguous write completion
├── Positive: commit then timeout
├── Positive: delayed success response
├── Positive: partial response with state changed
├── Negative control: timeout before commit
├── Negative control: explicit rejection
├── Variation: read-after-write temporarily stale
└── Variation: idempotency key supported / unsupported
~~~

Family 至少包含：

- 应触发保护行为的正例；
- 不应触发过度保护的负例；
- 语义改写和环境变体；
- 容易产生相反错误的 Counterexample；
- 原始机制的边界条件。

这样才能检查修复是否学会原则，而不是只记住一句话。

## 第十一步：决定 Case 进入哪个 Dataset Layer

生产来源不等于直接进入所有集合。结合[健康评测集分层](./healthy-agent-eval-dataset-layers.md)：

| Layer | 用途 | 进入条件 |
| --- | --- | --- |
| Quarantine | 尚在复现和脱敏 | 证据未闭环 |
| Regression | 阻止已知失败复发 | fail-before/pass-after 已验证 |
| Safety | 高风险边界与红线 | 风险 Owner 审核 |
| Capability | 代表稳定能力需求 | 不只是偶然边缘事件 |
| Holdout | 独立比较与发布 | 避免修复者直接看到 |

不能把修复过程中反复查看的 Case 继续宣称为纯 Holdout。它应成为 Regression Case，同时用独立邻域 Case 或新 Holdout 评估泛化。

## Case 的生命周期

~~~text
PROPOSED
  ↓ reproduction + privacy review
QUARANTINED
  ↓ contract + grader + fail-before/pass-after
ACTIVE_REGRESSION
  ↓ failure mechanism replaced or product retired
DEPRECATED
  ↓ retention and lineage policy
ARCHIVED
~~~

每个 Case 应有：

- Owner；
- Source Lineage；
- Failure Family；
- Severity；
- Contract 与 Grader 版本；
- 首次接纳日期；
- 最后复核日期；
- 退休条件；
- 数据保留和删除要求。

Case 不能因为“现在一直 PASS”就删除。持续 PASS 可能正说明它在防止回归。只有当对应功能、风险或 Failure Mechanism 消失，并有替代覆盖时才考虑退休。

## 一份 Case Promotion Record

~~~yaml
promotion:
  candidate_case_id: regression-unsafe-retry-001
  source_signal: sig-2026-00127
  incident_reviewed: true

  reproduction:
    status: CONFIRMED
    protocol_version: repro-v2
    before_fix_failure_rate: 0.40

  privacy:
    restricted_source_retained: false
    sanitized_bundle_reviewed: true
    sensitive_scan_passed: true

  evaluation:
    contract_version: contract-v1
    grader_bundle_version: grader-v1
    reference_solution_passed: true
    valid_alternative_paths_tested: 3

  fix_validation:
    after_fix_trials: 30
    critical_failures: 0
    neighboring_suite_passed: true

  dataset:
    destination: regression/critical-write-safety
    failure_family: ambiguous-write-completion
    owner: agent-safety-team
    review_after: 2027-04-13

  decision: PROMOTE
~~~

Promotion Record 让“为什么这条 Case 存在”在半年后仍可回答。

## 生产反馈闭环的指标

不要只统计新增 Case 数量。更有意义的指标包括：

- Signal → Triage 的延迟；
- Triage → 稳定复现的时间；
- Incident 中可转化为 Case 的比例；
- Case fail-before/pass-after 验证率；
- 重复 Incident 比例；
- Regression Case 发现发布回归的次数；
- 因隐私或证据不足无法复现的比例；
- Grader 误报、漏报和 `UNSCORABLE` 率；
- Action Item 按期关闭率。

“Case 越多越好”会制造题库膨胀。目标是更少重复事故、更短反馈延迟和更高可信覆盖。

## 常见错误

### 直接复制生产 Trace

会把隐私、凭证和内部结构永久带入 Dataset，也常无法重放。

### 每个投诉都做一条 Case

会产生重复样本和错误权重。先聚类 Failure Family，再决定代表性与严重度。

### 先修复，再写 Case

缺少 fail-before 证据时，无法证明 Case 捕获的是原问题。

### 只验证修复版本一次成功

Agent 具有随机性，一次成功可能只是偶然。应使用风险匹配的重复 Trial 和区间。

### Grader 检查参考步骤

会惩罚合法替代路径。优先检查可信终态、不变量与禁止行为。

### Regression Case 永不维护

Fixture 腐烂、Contract 漂移和 Grader 失准会使 Case 从保护资产变成噪声。

## 落地产物

~~~text
agent-eval/
├── intake/production-signal.schema.json
├── incidents/triage-record.schema.json
├── reproduction/reproduction-protocol.yaml
├── cases/regression/<failure-family>/
│   ├── case.yaml
│   ├── fixture/
│   ├── grader/
│   └── promotion-record.yaml
├── policies/case-promotion.yaml
├── policies/sanitization.yaml
└── dashboards/feedback-loop-health.json
~~~

下一篇[《Agent Trace 的安全、隐私与数据治理》](./agent-telemetry-safety-privacy-and-data-governance.md)会进一步处理采什么、在哪里脱敏、谁能访问、保留多久，以及如何安全地把生产证据用于复现。

## 适用边界

- 生产证据的采集与使用必须符合适用法律、合同和组织政策。
- 不能稳定复现的高风险事件仍可能需要直接修复、监控和风险控制，不能因为没有 Case 就降级严重度。
- Regression Case 证明的是声明机制与环境，不等于覆盖所有相似生产情境。
- 某些真实数据不能合法脱敏到足够安全，应使用合成 Fixture 保留结构特征。
- 事件根因往往是多个贡献因素，不要把复杂系统失败简化为单一“模型错误”。

## 公开参考

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — 建议从人工测试、支持队列和用户失败中提取任务，并长期维护评测集。
- [Google SRE：Postmortem Culture — Learning from Failure](https://sre.google/sre-book/postmortem-culture/) — 事件影响、贡献因素、无责复盘和防止复发的行动项。
- [Google SRE Workbook：Postmortem Culture](https://sre.google/workbook/postmortem-culture/) — 复盘模板、评审和 Action Item 关闭机制。
- [Google SRE：Example Postmortem](https://sre.google/sre-book/example-postmortem/) — 结构化时间线、根因和行动项示例。
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — 生产监控、用户输入、事故响应、恢复与变更管理。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 用清晰任务、人工标签和校准构建可信评测。
- [Zeller and Hildebrandt：Simplifying and Isolating Failure-Inducing Input](https://doi.org/10.1109/TSE.2002.1039969) — Delta Debugging 与失败输入最小化。
