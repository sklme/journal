---
title: Agent Trace 的安全、隐私与数据治理
date: 2026-10-13
tags:
  - Agent Evaluation
  - Privacy
  - Telemetry
  - Data Governance
description: 用数据最小化、字段分级、分层存储、访问审计和删除血缘，让 Agent Trace 可用于评测而不成为新的安全风险
---

# Agent Trace 的安全、隐私与数据治理

## 要解决的问题

Agent Trace 比传统应用日志更容易包含完整业务语义：

- 用户输入和对话历史；
- 代码、文件、附件和检索文档；
- 模型 Prompt、Response 和推理摘要；
- 工具参数、返回值与外部状态；
- 身份、权限、审批和 Handoff 信息；
- URL、Header、Cookie、Token 和签名；
- Agent 修改前后的系统状态。

这些信息对调试、评测和事故复现很有价值，也可能把可观测性系统变成新的高价值攻击面。

两个极端都不可取：

~~~text
默认什么都不记
  → 无法解释失败、复现事故或校准 Grader

默认全部永久保存
  → 扩大隐私、凭证、越权访问和数据泄漏风险
~~~

正确目标不是“尽可能多采集”，而是：

> 为声明的质量与安全用途，采集最少且足够的证据；在数据的采集、传输、存储、使用、派生和删除全过程中保持可解释的治理边界。

## 先定义数据用途，再决定采什么

每一个 Trace 字段都应至少对应一个合法、明确的用途：

| 用途 | 需要的典型证据 | 通常不需要 |
| --- | --- | --- |
| 性能监控 | 时间、状态、Token、错误类型 | 完整用户正文 |
| 工具可靠性 | 工具名、结果码、延迟、重试 | 原始凭证和全部 Payload |
| Outcome 验证 | 可信终态摘要、资源标识符替身 | 无关历史消息 |
| 安全审计 | 权限决策、审批、风险动作 | 普通低风险内容全文 |
| 质量评测 | 脱敏任务、产物和引用证据 | 身份与内部地址 |
| 事故复现 | 最小 Fixture、版本和关键响应 | 与失败无关的生产数据 |

如果无法说明字段用于哪个决策、由谁使用、保留多久，就不应默认采集。

## 把 Telemetry Contract 当成一等接口

Telemetry Schema 不是随手打日志。它应像 API 一样版本化：

~~~yaml
telemetry_contract:
  id: agent-trace-v4
  purpose:
    - reliability_monitoring
    - regression_case_reproduction
    - safety_audit
  prohibited_uses:
    - unrelated_user_profiling
    - employee_performance_scoring

  collection_mode: allowlist
  default_content_capture: false
  schema_version: 4
  redaction_policy_version: 7
  retention_policy_version: 3
  owner: observability-governance
~~~

Schema 变更必须经过：

- 数据分类；
- 用途和必要性审查；
- 兼容与迁移计划；
- 保留和删除影响分析；
- 安全与隐私 Review；
- 下游 Grader 和 Dashboard 更新。

## 建立字段级数据分类

可以使用四级模型：

| 级别 | 示例 | 默认处理 |
| --- | --- | --- |
| Public | 公开模型名、公共 Benchmark ID | 可按普通 Telemetry 处理 |
| Internal | 版本 Digest、通用错误码、非敏感指标 | 受组织访问控制 |
| Confidential | 用户内容、代码、文件、业务 Payload | 默认不采或短期加密保存 |
| Restricted | 凭证、密钥、支付/身份数据、高风险内容 | 禁止进入普通 Trace；专用受控流程 |

分类必须作用于嵌套字段和派生内容，而不是只看顶层字段名。`tool.response` 可能包含任何类型的数据；`url.query` 可能包含签名；错误栈也可能回显密钥。

示例 Schema：

~~~yaml
fields:
  trace_id:
    classification: internal
    capture: always
  model_id:
    classification: internal
    capture: always
  tool_name:
    classification: internal
    capture: always
  tool_arguments:
    classification: confidential_dynamic
    capture: allowlisted_fields_only
  tool_response_body:
    classification: confidential_dynamic
    capture: false
  authorization_header:
    classification: restricted
    capture: forbidden
  user_content:
    classification: confidential
    capture: sampled_with_consent_and_policy
~~~

## 数据最小化要发生在采集源头

最安全的敏感字段，是从未进入 Telemetry Pipeline 的字段。

推荐顺序：

~~~text
Source instrumentation allowlist
  ↓
In-process structural redaction
  ↓
Collector policy enforcement
  ↓
Storage admission scan
  ↓
Query-time masking as final defense
~~~

只在查询界面打码不够，因为原始敏感数据已经存在于网络、队列、缓存、备份和存储中。

### 优先记录结构，而不是正文

例如工具调用可以默认保存：

~~~yaml
tool_event:
  tool_name: search_documents
  arguments_schema_version: 3
  argument_presence: [query, filters]
  argument_sizes: {query: 42, filters: 2}
  risk_class: read_only
  result_status: OK
  result_count: 8
  duration_ms: 317
~~~

只有在受控采样、事故保全或明确评测用途下，才进入内容视图。

## Redaction 要理解结构和语义

简单正则替换只能覆盖部分已知格式。完整策略至少包括：

- Header Allowlist，默认不采集 Cookie 与 Authorization；
- URL Query 按参数名清洗，保留 Key、替换 Value；
- JSON 按 Schema 和 JSONPath 处理；
- 日志模板参数与自由文本分开；
- 文件和附件只存 Digest、MIME、大小和受控引用；
- 高熵字符串、密钥格式和凭证前缀检测；
- 用户标识使用不可逆、带作用域的 Tokenization；
- 自由文本采用规则、模型与人工抽查组合；
- Redaction Failure 采取 Fail Closed，而不是原文放行。

OpenTelemetry 的 URL Semantic Conventions 明确要求不得记录 URL User Info，并建议清洗敏感 Query；HTTP 约定也提醒完整 Header 采集有泄漏风险。Instrumentation 应把这些要求落实为默认配置，而不是依赖使用者记得关闭。

示例：

~~~text
Before:
https://example.com/action?user=<USER_ID>&sig=<TOKEN>&mode=preview

After:
https://example.com/action?user=REDACTED&sig=REDACTED&mode=preview
~~~

有时 Key 本身也敏感，应连同字段删除。

## 使用双平面或三层数据存储

建议把元数据和内容物理分开：

~~~text
Tier 0 · Operational Metrics
  聚合指标、错误类型、延迟、计数
  长期保留，最低敏感度

Tier 1 · Sanitized Trace
  脱敏事件、结构摘要、版本与 Evidence Ref
  用于日常调试和评测

Tier 2 · Restricted Evidence
  必要的原始内容或高敏证据
  极少访问、短期保留、独立密钥和审批
~~~

一个普通 Trace Viewer 不应自动拥有 Restricted Evidence 的读取能力。Tier 1 只保留不可直接猜测的引用，Tier 2 的访问通过独立控制面审批并记录审计日志。

## 身份与访问控制必须围绕用途

不要只使用“工程师”或“管理员”这种宽角色。至少区分：

- On-call：查看运行元数据和必要故障摘要；
- Evaluation Author：使用脱敏 Trace 构建 Case；
- Privacy Reviewer：审核原始到脱敏的转换；
- Incident Commander：在时限内访问必要受限证据；
- Grader Service：仅获取声明的 Evidence Projection；
- Platform Operator：维护管道但默认看不到内容。

访问策略可表达为：

~~~yaml
access_request:
  subject_role: incident_responder
  dataset_tier: restricted_evidence
  purpose: reproduce_critical_incident
  incident_id: inc-2026-0042
  fields: [tool_response_fragment, final_state]
  expires_after_hours: 24
  approval_required: privacy_owner
  audit: mandatory
~~~

使用 Just-in-Time、最小字段、短时授权和不可抵赖审计，优于长期共享权限。

## 加密解决不了用途越界

传输加密和静态加密是必要基础，但无法防止：

- 合法账户查看了不必要内容；
- 数据被复制到新的系统后失去删除能力；
- Grader Prompt 把内容发送给未批准的模型或地域；
- 原始 Trace 被导出到本地；
- 备份比主数据保留更久；
- 派生 Dataset 无法追溯来源。

因此安全模型必须包含用途、血缘、保留和派生控制。

## 保留期限应按数据层与用途设置

~~~yaml
retention:
  operational_metrics:
    duration_days: 400
  sanitized_trace:
    duration_days: 90
  restricted_evidence:
    duration_days: 14
  legal_hold:
    requires: legal_and_privacy_approval
  backups:
    maximum_lag_days: 30
~~~

真实期限取决于业务、合同和法规。重要的是：

- 不是所有层统一永久保存；
- 延长保留需要用途和批准；
- 删除要覆盖索引、缓存、导出、备份和派生数据；
- Hold 必须可审计、可到期。

## 建立数据血缘与删除传播

Production Trace 可能派生为：

~~~text
Raw Trace
├── Sanitized Trace
├── Incident Bundle
├── Regression Case
├── Grader Calibration Sample
├── Dashboard Aggregate
└── Export / Backup
~~~

每个派生物应记录：

~~~yaml
lineage:
  source_id: restricted-trace-00127
  derivative_id: regression-case-unsafe-retry-001
  transform_version: sanitize-v7
  fields_retained:
    - tool_result_status
    - external_state_count
  fields_removed:
    - user_content
    - credential_material
  reidentification_key_retained: false
  deletion_behavior: review_then_propagate
~~~

删除不能盲目摧毁已经完全匿名化、具有公共安全价值的 Regression Case，也不能因为“已进 Dataset”就拒绝处理合法删除请求。需要在设计时定义：哪些派生物仍是可关联数据、哪些已经不可逆匿名化、哪些因法律或安全义务受到特殊保留。

## Replay 必须在隔离环境中进行

直接重放生产 Trace 可能再次执行真实写操作或调用带权限的工具。

Replay Harness 至少应提供：

- 网络默认拒绝；
- Fake Credential 与 Secret Ref 替换；
- Tool Gateway 切换到 Stub 或沙箱；
- 写操作使用可回滚 Fixture；
- 外部标识映射为测试标识；
- 预算和 Deadline；
- Replay 与生产身份完全隔离；
- 禁止从 Trace 中恢复原始 Authorization。

~~~yaml
replay_policy:
  network: deny_by_default
  external_writes: sandbox_only
  credentials: synthetic_only
  tool_mode: recorded_stub
  user_notification: disabled
  side_effect_verification: required
~~~

Trace 是数据，不是可信指令。重放系统不能执行 Trace 中嵌入的提示、脚本或工具参数，除非它们通过声明的沙箱接口。

## Grader 只获取最小 Evidence Projection

Grader 不需要自动看到完整 Trace。

~~~text
Full Trace
  ↓ trusted projection
Evidence Bundle
  ├── final state assertions
  ├── allowed tool-event fields
  ├── redacted output
  └── provenance and integrity metadata
  ↓
Grader
~~~

对 LLM Judge，还要声明：

- 使用哪个供应商和地域；
- 内容是否会被保留或用于训练；
- 最大输入字段；
- 是否允许敏感类别；
- 输出中是否可能复述输入；
- 失败时是否 Fail Closed；
- 人工升级时谁能看原证据。

如果政策不允许内容离开受控环境，应使用本地模型、确定性 Grader 或人工受控 Review，而不是默认调用外部 Judge。

## 完整性与保密性同样重要

评测证据不仅可能泄漏，也可能被篡改、截断或错配。

应记录：

- Event ID、Trace ID、Parent ID；
- 单调或可信时间信息；
- Schema、Agent、Tool 与 Grader 版本；
- Evidence Digest；
- 采集缺口和丢弃原因；
- Pipeline 处理版本；
- 是否完整、是否重排；
- 访问和导出审计。

~~~yaml
evidence_integrity:
  event_count_expected: 27
  event_count_observed: 27
  digest: sha256:<EVIDENCE_DIGEST>
  redaction_policy_version: 7
  collection_gaps: []
  verified_at: <TIMESTAMP>
~~~

不完整证据不能被静默当成完整失败或成功，应进入 Coverage 与 `UNSCORABLE` 路径。

## 监控治理系统本身

建议为 Telemetry Pipeline 建立 SLO 与 Guardrail：

- 禁止字段进入普通存储的事件数；
- Redaction Failure Rate；
- 未分类字段比例；
- Restricted Evidence 访问次数与异常；
- 数据导出和本地下载次数；
- 删除请求按期完成率；
- 过期数据清理率；
- Evidence 丢失、延迟和错配率；
- Schema 未兼容消费者数量；
- 隐私抽查命中率。

一个“Trace 全部成功上报”的管道，如果同时泄漏敏感内容，不能算健康。

## 事件响应

发现 Telemetry 泄漏时，需要预先定义：

~~~text
Detect
  ↓ stop collection / quarantine pipeline
Contain
  ↓ revoke access / rotate exposed credential
Assess
  ↓ affected fields, subjects, stores, exports
Remediate
  ↓ purge, patch, backfill redaction
Notify
  ↓ follow applicable policy and law
Learn
  ↓ add pipeline regression test and policy gate
~~~

如果真实凭证进入日志，删除日志不等于修复，首先要轮换或撤销凭证。

## 一份可执行的 Governance Manifest

~~~yaml
trace_governance:
  schema_version: 4
  owner: observability-governance

  purpose_allowlist:
    - reliability_monitoring
    - safety_audit
    - regression_reproduction

  collection:
    default_content_capture: false
    header_allowlist: [content-type, traceparent]
    forbidden_fields:
      - authorization
      - cookie
      - raw_secret
    dynamic_payload_policy: structured_allowlist

  storage:
    tiers: [operational_metrics, sanitized_trace, restricted_evidence]
    encryption_in_transit: required
    encryption_at_rest: required
    separate_keys_for_restricted_tier: true

  access:
    just_in_time: true
    purpose_binding: true
    audit_required: true
    local_export: denied_by_default

  retention:
    sanitized_trace_days: 90
    restricted_evidence_days: 14
    deletion_propagation: required

  replay:
    network: deny_by_default
    credentials: synthetic_only
    external_writes: sandbox_only

  validation:
    sensitive_scan: required
    redaction_regression_suite: required
    quarterly_access_review: required
~~~

## 常见错误

### “仓库是私有的，所以 Trace 可以原样保存”

私有不等于最小权限，也不解决内部滥用、导出、备份和供应链风险。

### 只在 UI 打码

底层数据仍然完整存在，泄漏面没有减少。

### 使用 Blocklist 采集 Header

新 Header 或自定义字段会绕过列表。安全默认应是 Allowlist。

### 用 Hash 代替匿名化

可枚举标识符、跨表一致 Hash 和保留映射都可能允许重识别。需要带作用域 Tokenization、Salt 管理或真正不可逆聚合。

### 所有人都能查看完整 Trace

调试方便不能代替用途和最小权限。元数据、脱敏内容与受限证据应分层。

### 删除主表就算完成

索引、缓存、导出、Case、校准集和备份可能仍有副本。

### 让 Grader 直接读取生产数据库

这扩大权限、破坏可复现性，也使 Grader 成为高风险执行者。应生成冻结、最小化的 Evidence Bundle。

## 落地产物

~~~text
agent-observability/
├── schemas/agent-trace-v4.yaml
├── policies/data-classification.yaml
├── policies/collection-allowlist.yaml
├── policies/redaction-v7.yaml
├── policies/access-control.yaml
├── policies/retention-and-deletion.yaml
├── pipelines/evidence-projection/
├── tests/redaction-regression/
├── audits/access-review/
└── runbooks/telemetry-data-incident.md
~~~

下一篇[《什么时候才值得建设 Agent Eval 平台》](./when-to-build-an-agent-eval-platform.md)会在这些数据与治理契约之上讨论平台化的边界：哪些能力先用脚本即可，哪些重复负担才值得抽成共享基础设施。

## 适用边界

- 具体数据分类、保留期限和用户权利取决于适用法律、合同、行业规范和组织政策。
- “匿名化”有严格法律与技术含义，不能用简单替换或 Hash 自行宣称。
- 安全扫描无法证明零泄漏，需要结构化采集、默认拒绝和持续抽查共同防御。
- 高风险调查有时需要受限原始证据，但应采用短时授权、最小字段和审计。
- 任何为了评测而扩展数据用途的决定，都应重新进行用途与风险审查。

## 公开参考

- [NIST：Privacy Framework](https://www.nist.gov/privacy-framework/privacy-framework) — 从数据处理全生命周期识别和管理对个体的隐私风险。
- [NIST：Privacy Framework Getting Started](https://www.nist.gov/privacy-framework/getting-started-0) — 将隐私风险管理嵌入组织角色、产品和数据生态。
- [NIST：AI Risk Management Framework 1.0](https://doi.org/10.6028/NIST.AI.100-1) — AI 系统全生命周期的风险治理、测量和文档化。
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — 生产监控、隐私风险、事件响应和变更管理要求。
- [OpenTelemetry：Semantic conventions for URL](https://opentelemetry.io/docs/specs/semconv/url/) — URL User Info、Query 与敏感信息清洗要求。
- [OpenTelemetry：Semantic conventions for HTTP spans](https://opentelemetry.io/docs/specs/semconv/http/http-spans/) — Header 采集风险与 Query Redaction 约定。
- [OpenTelemetry：Log redaction](https://opentelemetry.io/docs/languages/dotnet/logs/redaction/) — 在日志管道中标记、分类与清洗敏感数据的工程示例。
- [Google SRE：Postmortem Culture](https://sre.google/sre-book/postmortem-culture/) — 生产事件证据、复盘共享与终端用户信息保护边界。
