---
title: 如何设计 Agent Trace Tree：从模型调用到最终状态
date: 2026-09-01
tags:
  - Agent Observability
  - Distributed Tracing
  - Trace Schema
description: 设计覆盖模型、工具、Handoff、Guardrail、状态变化与产物证据的 Agent Trace Tree，并处理并发、隐私和版本演进
---

# 如何设计 Agent Trace Tree：从模型调用到最终状态

## 要解决的问题

很多 Agent 系统已经记录模型耗时、Token 和工具调用次数，但遇到真实失败时仍然无法回答：

- 哪次模型调用做出了关键错误决策？
- 工具失败后，Agent 是否看到了完整错误？
- 一个子 Agent 的结果如何影响主 Agent？
- 最终文件、数据库或页面状态由哪个动作产生？
- 审批、Guardrail 和人工接管发生在风险动作之前还是之后？
- 为什么同一任务在两次运行中表现不同？

原因通常不是日志不够多，而是日志没有形成可查询的因果结构。Agent Trace 不能只是消息数组，也不能只是工具接口外的一层计数器。它应把一次端到端 Run 组织为 Trace Tree，并通过 Link、Event 和 Artifact Reference 补充树结构表达不了的关系。

## 核心结论

一个可用于调试、评测和实验的 Agent Trace 至少需要表达五类信息：

~~~text
Identity     这是谁的一次运行？
Causality    哪个操作触发了哪个操作？
Configuration 当时运行的模型、Prompt、工具和权限是什么？
Evidence     输入、输出、状态变化与产物在哪里？
Cost & Risk  花了多少资源，是否触发错误或风险边界？
~~~

推荐的数据模型是：

~~~text
Trace
├── Span
│   ├── Attributes
│   ├── Events
│   ├── Artifact References
│   └── Links
└── Run-level Manifest Reference
~~~

[OpenTelemetry 对 Trace 的定义](https://opentelemetry.io/docs/concepts/signals/traces/)将 Span 视为有开始和结束的工作单元，并用 Parent Span ID、Attributes、Events、Links 与 Status 表达嵌套、时间点和跨 Trace 因果关系。[W3C Trace Context](https://www.w3.org/TR/trace-context/)则提供了跨进程传播 Trace ID 与 Parent ID 的标准格式。

## Trace、Transcript 与 Event Log 的区别

三个概念经常被混用：

| 形式 | 主要结构 | 适合回答 |
| --- | --- | --- |
| Transcript | 按对话顺序排列的消息 | 模型看到了什么、说了什么 |
| Event Log | 按时间排列的事件 | 系统依次发生了什么 |
| Trace Tree | 具有父子关系的操作 | 哪个操作由谁触发、耗时和失败传播 |

Transcript 是 Agent Trace 的重要证据，但不是完整 Trace。它通常缺少：

- 工具内部调用和服务链路；
- 并发任务的父子关系；
- 环境状态修改；
- 审批和 Guardrail；
- 版本与资源配置；
- 产物引用与校验结果。

Event Log 可以恢复时间顺序，却不总能恢复因果关系。两个操作同时发生时，仅凭时间无法判断它们属于同一计划、重试还是独立分支。

## Trace Tree 的根应该是什么

根节点应是一项用户可理解的端到端工作，而不是某次 HTTP 请求或模型调用：

~~~text
Agent Run：完成一项研究并保存文章
├── Agent Span：规划
│   └── Model Span
├── Agent Span：资料收集
│   ├── Tool Span：搜索
│   ├── Tool Span：读取来源 A
│   └── Tool Span：读取来源 B
├── Agent Span：写作
│   ├── Model Span
│   └── Tool Span：写文件
├── Guardrail Span：敏感信息检查
├── Tool Span：文档构建
└── State Span：记录最终产物
~~~

根 Trace 的开始是 Agent 接受任务，结束是：

- Agent 已形成最终输出；
- 达到停止条件；
- 超时、取消或人工终止；
- 失败后完成安全清理。

不要在 Agent 返回一段“完成了”的文字时立刻结束 Trace。后台写入、异步导出、状态确认和清理如果仍在执行，也应进入同一端到端证据范围，或通过 Span Link 关联后续 Trace。

## 推荐的 Span 类型

内部 Schema 可以定义以下稳定类型：

| Span 类型 | 记录对象 | 关键字段 |
| --- | --- | --- |
| agent | 一次 Agent 或子 Agent 执行 | agent_version、role、termination |
| model | 一次模型请求与响应 | provider、model、parameters、usage |
| tool | 一次工具调用 | tool_version、arguments_ref、result_ref |
| handoff | Agent 之间的任务移交 | source、target、reason、context_ref |
| guardrail | 输入、输出或动作检查 | policy_version、decision、evidence |
| approval | 人工或策略审批 | action_class、decision、latency |
| state | 可观察状态读取或修改 | target_type、before_ref、after_ref |
| retrieval | 检索或记忆读取 | index_version、query_ref、result_refs |
| workflow | Harness 中的逻辑阶段 | workflow_version、stage |
| cleanup | 资源释放与环境清理 | resource_type、result |

[OpenAI Agents SDK](https://openai.github.io/openai-agents-python/tracing/)默认记录 Agent、Model Generation、Function Tool、Guardrail、Handoff 等 Span。最新的 [OpenTelemetry GenAI Agent Span 约定](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)还定义了 invoke_agent、invoke_workflow、plan、execute_tool 等操作。

OpenTelemetry 的 GenAI 语义约定目前处于 Development，因此更稳妥的做法是：

1. 维护一个版本化的内部 Trace Schema；
2. 使用 Mapper 输出到当前 OTel 语义约定；
3. 记录 Mapper 和语义约定版本；
4. 不把某个供应商字段直接作为永久业务主键。

## 最小 Trace Schema

下面是一份与具体 SDK 无关的最小结构：

~~~yaml
trace:
  schema_version: trace-schema-v1
  trace_id: 4bf92f3577b34da6a3ce929d0e0e4736
  run_id: run-20260901-001
  task_id: research-article-001
  trial_index: 1
  started_at: 2026-09-01T01:00:00Z
  ended_at: 2026-09-01T01:02:10Z
  status: completed
  manifest_ref: artifact://manifests/run-20260901-001

spans:
  - span_id: 00f067aa0ba902b7
    parent_span_id: null
    type: agent
    name: research_and_write
    started_at: 2026-09-01T01:00:00Z
    ended_at: 2026-09-01T01:02:10Z
    status: ok
    attributes:
      agent.version: agent-v4
      harness.version: harness-v7
      prompt.version: prompt-v9
      toolset.version: tools-v5
      permission.profile: public-read-local-write
    events: []
    links: []
    artifacts:
      - role: final_output
        ref: artifact://outputs/article.md
        sha256: ...
~~~

W3C Trace Context 使用 16 字节 Trace ID 与 8 字节 Parent ID 传播分布式因果上下文。即使内部 ID 格式不同，也应保证全局唯一，并在调用外部服务、队列或子 Agent 时传播或映射上下文。

## Span 的必要字段

### 1. Identity

每个 Span 至少需要：

- trace_id；
- span_id；
- parent_span_id；
- type 与 name；
- started_at 与 ended_at；
- status 与 error_type。

此外，Run 层需要：

- run_id；
- task_id；
- trial_index；
- session_id 或 conversation_id；
- experiment_id 与 candidate_id，如果属于实验。

这些 ID 不应直接使用用户邮箱、账号或其他个人标识。使用随机或不可逆映射的技术 ID，并将用户数据保存在受权限控制的独立系统中。

### 2. Configuration

Trace 必须能够回答“当时运行的是什么”：

~~~yaml
configuration:
  agent_version: agent-v4
  harness_version: harness-v7
  prompt_version: prompt-v9
  model_requested: model-a
  model_parameters_ref: artifact://configs/model-a.json
  toolset_version: tools-v5
  permission_profile: profile-v3
  environment_manifest_ref: artifact://manifests/env-v6
~~~

不要只记录可变名称，例如 latest、production 或 default。应记录能够回到不可变内容的版本、摘要或制品 Digest。

### 3. Timing 与 Resource

建议在 Model 与 Tool Span 上分别记录：

- wall time；
- queue time；
- time to first token；
- input、output 与 cache token；
- 请求次数与重试次数；
- 工具调用费用或估算成本；
- 超时预算与实际使用；
- CPU、内存或沙箱资源级别的引用。

资源字段是实验条件，不只是性能监控。[Anthropic 的基础设施噪声研究](https://www.anthropic.com/engineering/infrastructure-noise)显示，仅运行资源配置就可能让 Agent 编码基准相差多个百分点。

### 4. Evidence 与 Artifact

大对象不应全部内联进 Span。推荐存储引用：

~~~yaml
artifacts:
  - role: model_input
    ref: artifact://payloads/input-001
    sha256: ...
    retention_class: restricted-30d
  - role: tool_result
    ref: artifact://payloads/search-result-003
    sha256: ...
    retention_class: public-90d
  - role: state_after
    ref: artifact://snapshots/workspace-after
    sha256: ...
    retention_class: eval-1y
~~~

Artifact Reference 应包含：

- 内容摘要；
- MIME 或 Schema；
- 大小；
- 脱敏状态；
- 保留策略；
- 访问级别；
- 生成它的 Span。

这样既能限制 Trace 存储体积，也能对高敏感输入使用不同权限和保留周期。

### 5. Status 与 Error

区分三种结果：

~~~text
operation_status  这项操作是否正常执行？
task_outcome      整个任务是否成功？
grader_result     评测器如何判断？
~~~

工具返回业务上的“未找到”可能是正常操作结果，不应自动标成基础设施错误；模型调用成功返回也不代表任务成功。

建议 error_type 使用低基数分类：

- timeout；
- rate_limit；
- unavailable；
- invalid_arguments；
- permission_denied；
- malformed_output；
- cancelled；
- infrastructure；
- unknown。

原始错误文本可以放在受控 Artifact 中，避免把大段或敏感错误信息变成高基数检索字段。

## Span、Event、Attribute 和 Link 如何选择

### 用 Span 表达有持续时间的工作

模型调用、工具调用、审批等待和文件构建都有开始与结束，应使用 Span。

### 用 Event 表达重要时间点

[OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/traces/)把 Span Event 定义为 Span 持续期间某个有意义的单一时间点。适合：

- 首个 Token 到达；
- 用户取消；
- 审批请求发出；
- 重试开始；
- 状态发生关键转换；
- 达到预算阈值。

### 用 Attribute 表达无需独立时间点的属性

例如模型名称、工具版本、输入大小、Token 数和权限 Profile。

### 用 Link 表达树之外的因果关系

树结构只有一个 Parent，但 Agent 系统经常出现：

- 一个聚合 Agent 等待多个并行子 Agent；
- 队列任务晚于原 Trace 执行；
- 一个缓存结果被多个 Run 复用；
- 人工审批发生在独立系统；
- 一个生产失败转化为离线回归 Trial。

此时用 Span Link 连接相关 Trace 或 Span，而不是伪造父子关系。OpenTelemetry 明确使用 Link 表达异步操作和跨 Trace 的因果关联。

## 并行、重试与循环如何建模

### 并行调用

多个并行 Tool Span 应共享同一个 Parent：

~~~text
Agent Span：collect_sources
├── Tool Span：source_a
├── Tool Span：source_b
└── Tool Span：source_c
~~~

不要根据结束时间把它们串成错误的顺序关系。

### 重试

每次尝试都应是独立 Span，并使用稳定的 logical_operation_id：

~~~text
Tool Operation：fetch_document
├── Attempt 1：timeout
├── Attempt 2：rate_limit
└── Attempt 3：ok
~~~

这样可以同时看到最终成功和重试成本。只保留最后一次结果会隐藏不稳定性。

### Agent Loop

每轮可以建立 Turn 或 Step Span，但不要让层级无限膨胀。推荐保留：

- 对决策有意义的 Agent Step；
- 每次 Model 与 Tool Span；
- Guardrail、Approval、Handoff；
- 关键状态变化。

纯内部函数调用继续使用普通 APM Trace，必要时与 Agent Span 关联，不必全部复制进 Agent 语义树。

## 状态变化必须成为一等证据

Agent 的成功经常存在于环境，而不是消息中。可以为每个关键写操作记录：

~~~yaml
state_change:
  target_type: file
  target_ref: workspace://docs/article.md
  operation: update
  before:
    exists: false
  after:
    exists: true
    sha256: ...
  verification:
    method: markdown_schema
    result: passed
~~~

对于数据库、日程、工单和云资源，同样应记录稳定资源引用、前后状态摘要和校验证据。

不要把完整数据库快照塞进 Trace；保存受控 Snapshot 或查询证据，并明确一致性时间点。

## Trace 与 Run Manifest 的分工

Trace 记录运行期间发生的事实，Run Manifest 记录运行开始前声明的实验条件：

| 内容 | Trace | Run Manifest |
| --- | --- | --- |
| 实际模型调用 | 是 | 预期模型配置 |
| 实际工具版本 | 是 | 允许的工具集 |
| 实际延迟和 Token | 是 | 超时和预算 |
| 环境中发生的变化 | 是 | 初始环境快照 |
| 错误与重试 | 是 | 重试策略 |
| Grader 输出 | 关联 | Grader 版本 |

两者通过 manifest_ref 与 trace_id 关联。若实际运行与 Manifest 不一致，应该产生 configuration_drift 事件，而不是静默接受。

## 隐私与安全策略

Trace 系统很容易成为新的敏感数据集中地。模型输入、工具参数、返回值和音频可能包含：

- 用户内容；
- 账号与个人信息；
- 凭证和授权材料；
- 内部代码与文档；
- 数据库记录；
- 模型的隐藏推理或供应商受限字段。

[OpenAI Agents SDK 文档](https://openai.github.io/openai-agents-python/tracing/)明确提醒 Generation 与 Function Span 可能捕获敏感输入输出，并提供关闭敏感数据采集的配置。OpenTelemetry GenAI 约定也把 System Instructions、Input Messages 与 Output Messages 设为 Opt-In。

推荐默认策略：

~~~yaml
trace_data_policy:
  capture_raw_model_input: false
  capture_raw_model_output: false
  capture_tool_arguments: redacted
  capture_tool_results: reference_only
  capture_hidden_reasoning: false
  identifiers: pseudonymous
  retention:
    metadata: 180d
    restricted_payloads: 30d
  access:
    metadata: engineering
    restricted_payloads: approved_reviewers
~~~

评测环境若需要完整证据，应使用专用 Dataset、合成身份和隔离存储，而不是放宽全部生产 Trace。

## 采样策略

### 离线 Eval

通常应保留 100% Trace，因为每个 Trial 都要可审计，且任务量受控。

### 生产流量

可以分层采样：

- 所有错误、风险动作和人工接管：完整保留元数据；
- 新版本与灰度流量：提高采样率；
- 正常高频任务：按比例采样；
- 超长、超贵、循环异常：尾部采样；
- 原始 Payload：独立权限与更低采样率。

采样决定需要在 Span 创建时使用的属性，应尽早写入。不要根据后续 Grader 分数选择性删除失败证据。

## Trace 完整性的校验规则

可以把 Trace Schema 本身作为测试对象：

~~~yaml
trace_invariants:
  - every_span_has_trace_id
  - every_non_root_span_has_existing_parent_or_link
  - end_time_is_not_before_start_time
  - every_tool_call_has_result_or_terminal_error
  - every_write_action_has_state_change_evidence
  - every_high_risk_action_has_prior_approval
  - actual_versions_match_manifest_or_emit_drift
  - restricted_payloads_have_retention_class
~~~

如果 Trace 丢失或无法导出，应把该 Trial 标记为 observability_failure，而不是默认认为 Agent 失败或成功。

## 用 Trace 回答的高价值查询

第一版 Trace 系统至少应支持：

- 按 task_id 比较成功与失败 Trial；
- 找出失败前最后一个正常 Span；
- 查看工具参数错误的 Top 类型；
- 统计每个 Agent Step 的耗时和成本；
- 识别重复调用和无效循环；
- 检查风险动作是否缺少审批；
- 比较不同 Harness 版本的 Trace 结构；
- 从 Outcome 反查产生它的写操作；
- 从生产失败 Trace 创建回归 Case。

可视化只是查询的一种形式。若系统只能展示瀑布图，却无法按字段聚合和关联 Eval Result，其评测价值会很有限。

## 常见误区

### 只记录模型调用

Agent 的关键错误可能发生在工具、权限、环境或状态修改。模型调用只是执行树的一部分。

### 把每条日志都变成 Span

Span 表达有持续时间和因果意义的操作。细粒度调试消息适合 Event 或普通 Log，过度 Span 化会让树不可读。

### 只记录工具名称，不记录版本

同名工具的 Schema、描述和实现变化会显著影响 Agent 行为。至少记录版本或内容摘要。

### 内联所有输入输出

这会放大存储成本、泄露范围与保留风险。默认使用摘要与 Artifact Reference。

### 用时间顺序代替因果关系

并发、队列和异步回调无法仅靠时间正确组装。应传播 Trace Context，并使用 Parent 或 Link。

### Trace 成功等于任务成功

Span 全部正常结束，只能证明系统没有报告执行错误。最终 Outcome 仍需独立 Grader。

## 一页式 Trace Schema 检查表

- 根 Trace 是否对应一项完整用户工作？
- 每个 Model、Tool、Handoff、Guardrail 和 Approval 是否可定位？
- 是否传播 trace_id、span_id 与 parent_span_id？
- 并行、重试和异步任务是否正确使用 Parent 或 Link？
- 是否记录 Agent、Prompt、Harness、工具、权限和环境版本？
- 写操作是否关联前后状态与产物证据？
- Operation Status、Task Outcome 与 Grader Result 是否分开？
- 原始输入输出是否默认关闭或引用化？
- 是否有 Schema Version、Mapper Version 和保留策略？
- Trace 丢失是否会被单独标记为可观测性失败？

## 公开参考资料

- [OpenTelemetry：Traces](https://opentelemetry.io/docs/concepts/signals/traces/) — Span、Attribute、Event、Link、Status 与父子关系。
- [OpenTelemetry Trace API](https://opentelemetry.io/docs/specs/otel/trace/api/) — 稳定 Trace API 的生命周期、Event 和 Link 契约。
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) — 跨进程传播 Trace ID、Parent ID 与 Trace Flags 的标准。
- [OpenTelemetry GenAI Agent Span semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md) — Agent、Workflow、Plan 与 Tool Span 的发展中语义约定。
- [OpenAI Agents SDK：Tracing](https://openai.github.io/openai-agents-python/tracing/) — Agent SDK 中 Trace 与各类 Span 的具体实现和敏感数据选项。
- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Transcript、Trace、Outcome 和 Trial 的评测语义。
- [Anthropic：Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise) — 资源配置为何必须进入 Agent Trace 与实验条件。
