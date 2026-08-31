---
title: 从多角色协作到 Agent Runtime：工程化设计指南
date: 2026-08-31
tags:
  - Multi-Agent
  - Agent Runtime
  - Agent Architecture
  - MCP
  - AI Engineering
description: 用控制面、执行面、能力面、证据面和治理横切层设计可调度、可验证、可渐进演进的多 Agent 系统
---

# 从多角色协作到 Agent Runtime：工程化设计指南

## 要解决的问题

把产品、架构、开发、评审和测试分别交给不同 Agent，看起来像组建了一支软件团队。但如果系统只是给同一个模型换几段角色提示词，再让它们互相聊天，就很难稳定获得工程收益。

真正需要设计的是一套 Agent Runtime：它能根据任务风险决定是否拆分工作，为运行中的 Agent 分配上下文、Skills、能力和权限，让不同阶段通过结构化产物协作，并用测试、规则与人工门禁验证结果。

本文聚焦以下问题：

1. Agent Runtime、Orchestrator、Agent、Skill、Capability、Tool 和 MCP 分别处在哪一层？
2. 多角色应当是常驻服务，还是按任务创建的配置实例？
3. 如何让 Reviewer 保持独立，又不因为缺少事实而产生无效评审？
4. 如何设计权限、预算、停止条件、证据和评测，避免系统退化成昂贵的“AI 会议”？

如果只想理解为什么角色名称不等于有效分工，可以先阅读[多 Agent 工程协作：角色之外的认知独立性](./multi-agent-cognitive-independence.md)。本文在此基础上继续讨论运行时架构和渐进落地。

## 核心结论

多 Agent 不是默认目标，而是一种针对特定任务结构的优化手段。可以用下面的设计启发判断它是否值得：

```text
系统净收益
  ≈ 专业化收益
  + 并行探索收益
  + 独立验证收益
  - 协调成本
  - 上下文损失
  - 相关性错误
  - 额外延迟与推理成本
```

默认路径应当是：

```text
单个主 Agent
    ↓
确定性工具验证
    ↓
按风险引入 Specialist 或独立 Reviewer
    ↓
达到证据标准或退出条件
```

OpenAI 的 Agent 构建指南建议先保持单 Agent 的可管理性，再在确有需要时引入多 Agent；Anthropic 的工程实践也建议从最简单的方案开始，并仅在评测证明有效时增加复杂度。多 Agent 研究进一步表明，收益依赖任务可并行性、工具使用方式、协调拓扑和基础 Agent 能力，增加 Agent 既可能提高质量，也可能放大错误或降低效率。

## 统一概念模型

| 概念 | 负责回答的问题 | 推荐定义 |
| --- | --- | --- |
| Model | 谁提供推理和生成能力？ | 可被 Runtime 调用的模型，不直接等同于 Agent |
| Agent Profile | 这个执行者被配置成什么？ | Role、Objective、Model、Skills、能力授权、Policies、输出契约和预算的声明式模板 |
| Agent Instance | 当前谁正在执行任务？ | Profile 与当前任务上下文、运行状态、临时记忆和工作区组合出的运行实例 |
| Skill | 这类任务应该怎样做？ | 可复用的过程知识、步骤、脚本、参考资料和模板，可组合多个 Capability |
| Capability | 系统在语义上能做什么？ | 与具体提供方无关的稳定能力接口，例如读取仓库、运行测试、查询工单 |
| Tool | 具体怎样执行能力？ | 函数、API、CLI、本地工具或远程服务暴露的操作 |
| MCP | Tool 如何被标准化接入？ | Tool、Resource、Prompt 等上下文能力的一种客户端—服务端协议，不等同于 Tool 或 Capability 本身 |
| Policy | 什么情况下允许执行？ | 权限、审批、预算、数据边界、风险和审计规则 |
| Orchestrator | 什么时候让谁做什么？ | 拆解任务、创建实例、调度依赖、管理状态、预算、重试、退出和人工升级 |
| Runtime | 上述组件在哪里运行？ | 承载控制面、执行面、能力面、状态与治理机制的执行环境 |

Agent Skills 开放规范把 Skill 定义为包含 `SKILL.md`，并可附带脚本、参考资料和资源的目录；其核心作用是封装可发现、按需加载的过程知识。MCP 则聚焦 Host、Client 与 Server 之间的上下文和工具交换。两者可以协作，但职责不同：Skill 教 Agent 如何完成工作，MCP 让 Runtime 接入外部能力。

## 总体架构：四个面与一个横切层

Agent Runtime 不应画成 Orchestrator 上方的一个普通节点。更准确的关系是：Runtime 是整体执行边界，内部包含控制面、执行面、能力面和证据面，Policy 作为治理层横切它们。

```text
┌──────────────────────────── Agent Runtime ────────────────────────────┐
│                                                                       │
│  ┌─────────────────────── Control Plane ───────────────────────────┐  │
│  │ Orchestrator · Planner · Scheduler · State · Budget · Exit     │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │ create / route / supervise            │
│  ┌────────────────────── Execution Plane ──────────────────────────┐  │
│  │ Agent Profiles → Agent Instances → Skills → Model / Workspace  │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │ capability request                    │
│  ┌────────────────────── Capability Plane ─────────────────────────┐  │
│  │ Capability Gateway · Registry · Adapters · Sandbox · Approvals │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│  ┌──────────────────── Artifact & Evidence Plane ──────────────────┐  │
│  │ Spec · Plan · Decision · Diff · Test Result · Review Finding   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Policy & Permission Engine ── enforce / authorize / audit / limit    │
└─────────────────────────────────┬─────────────────────────────────────┘
                                  │
                     Tool Adapters / MCP Clients
                                  │
               MCP Servers · APIs · CLI · Filesystem · CI
```

这种分层避免了三个常见混淆：

- Runtime 不是 Orchestrator 的上游调用者，而是容纳 Orchestrator 和 Agent 执行的环境。
- 每个角色不必实现一套独立 Capability Layer；能力可以逻辑共享，但通过权限生成不同视图。
- Policy 不由 Skill 产生，也不只约束 Tool，而是同时限制调度、上下文、实例和外部操作。

### 控制面

控制面负责管理任务，而不是替所有 Agent 做推理：

- 将目标拆成带依赖的阶段或子任务；
- 根据风险、领域和成本选择 Agent Profile；
- 创建、暂停、恢复和终止 Agent Instance；
- 管理并发、超时、重试、最大轮次和 Token 预算；
- 检查阶段交付物是否满足输出 Schema；
- 在缺少权限、高风险、冲突无法裁决或超过预算时升级给人。

OpenAI Agents SDK 将多 Agent 编排区分为由模型决定流程与由代码决定流程，并提供 manager、agents-as-tools、handoff、串行链、并行执行和 evaluator 循环等模式。工程系统通常需要混合使用：开放式规划可以交给模型，权限、预算、退出和关键状态转移更适合由代码控制。

### 执行面

执行面运行实际 Agent：

- 组装模型、Instructions、Skill 与当前任务上下文；
- 创建隔离工作区和临时记忆；
- 执行模型—工具循环；
- 把中间结果写入结构化产物，而不是只留在聊天记录里；
- 将最终结果和证据交还控制面。

同一个 Reviewer Profile 可以在不同任务中产生多个实例。它们共享职责定义，但拥有不同输入、预算和运行状态。因此，Product、Engineer 和 Reviewer 更适合作为 Profile，而不是三个必须永久运行的服务。

### 能力面

能力面把 Agent 的语义请求映射为具体工具调用：

```text
Agent
  ↓
Skill
  ↓
Capability Request
  ↓
Policy & Permission Check
  ↓
Capability Gateway
  ↓
Tool Adapter
  ↓
MCP Server / API / CLI / Native Tool
```

例如，`test.run` 可以由本地命令、容器沙箱或 CI 平台实现。Agent 依赖稳定的 Capability，而不必知道每个环境的具体命令和服务地址。

MCP 的 Host—Client—Server 架构适合成为 Tool Adapter 的一种实现：Host 管理多个 Client，每个 Client 与对应 Server 交换工具、资源和提示。MCP 本身不规定 AI 应用如何规划任务，所以不应把 Orchestrator、Skill 或业务状态机下沉到协议层。

### 证据面

Agent 之间最好通过版本化产物协作：

| 阶段 | 主要产物 |
| --- | --- |
| Analyze | 问题定义、非目标、约束、验收标准 |
| Design | 方案、契约、权衡、失败模式、决策记录 |
| Implement | 代码差异、变更说明、自测结果、已知限制 |
| Review | 严重度、位置、证据、影响、通过条件 |
| Verify | 测试、静态检查、运行结果、未覆盖范围 |

产物是协作事实来源；聊天、思考过程和临时计划只用于帮助当前 Agent 工作。这样既能降低上下文污染，也让 Orchestrator 可以基于 Schema 和证据判断阶段是否完成。

## Agent Profile 与运行实例

一个可执行的 Profile 至少应声明目标、输入、能力、策略、输出和预算：

```yaml
profile:
  id: reviewer
  role: independent_reviewer
  objective: find_falsifiable_acceptance_blockers
  model_class: reasoning

  context:
    required:
      - requirements
      - accepted_design
      - code_diff
      - test_results
    excluded:
      - engineer_private_scratchpad

  skills:
    - code_review
    - security_review

  capability_grants:
    - repository.read
    - diff.read
    - test.run

  policies:
    - no_source_write
    - evidence_required
    - no_external_publish

  output_schema:
    - severity
    - location
    - evidence
    - impact
    - pass_condition

  budget:
    max_turns: 3
    max_review_rounds: 2
```

运行时再加入任务特定状态：

```text
Agent Instance
  = Agent Profile
  + Current Task
  + Selected Context
  + Runtime State
  + Temporary Memory
  + Isolated Workspace
```

Profile 不应永久拥有全部权限。有效能力集合可以表示为：

```text
effective capabilities
  = profile defaults
  ∩ task grants
  ∩ runtime policy
  ∩ current user authorization
```

Engineer 可以默认写代码，但在只读审计任务中仍只获得读取能力；Reviewer 可以默认只读，需要修复时由 Orchestrator 创建新的 Engineer Instance，而不是临时突破 Reviewer 边界。

## 根据任务结构选择编排模式

### 单 Agent 循环

适用于边界明确、上下文集中、确定性验证充分的任务。增加工具通常比增加角色更经济。

```text
Agent → Act → Observe → Verify → Exit / Retry
```

### Manager 与按需 Specialist

主 Agent 保留最终责任，把检索、安全分析或独立模块等有明确输出的子任务交给 Specialist。OpenAI Agents SDK 把这类模式称为 agents as tools，适合需要统一汇总和统一用户界面的场景。

### Handoff

当后续阶段需要完全切换职责、Instructions 和上下文时，由当前 Agent 把控制权交给 Specialist。Handoff 适合“接管式”流程；如果只是请专家完成一个局部分析，manager 模式通常更清晰。

### 代码控制的顺序流水线

```text
Analyze → Design → Implement → Review → Verify
```

适用于阶段依赖稳定、产物 Schema 明确的工作。状态转移、最大轮次和失败分支应由代码维护，不要让 Agent 临时发明流程。

### 并行探索

```text
             ┌→ conservative proposal ─┐
Requirement ─┼→ growth-first proposal ─┼→ evidence-based decision
             └→ cost-first proposal ───┘
```

适用于可以独立探索的设计空间。候选方案必须围绕预先声明的评价维度展开，否则并行只会生成更多相似文字。

### Evaluator—Optimizer

一个 Agent 生成，另一个 Agent 按明确标准评估，再由生成者修改。Anthropic 将其列为典型工作流，并强调只有评价标准清楚、反馈可以证明改善结果时才值得使用。

```text
Generator → Deterministic Checks → Evaluator
    ↑                                │
    └──────────── verified feedback ─┘
```

## 设计独立但可落地的 Reviewer

Reviewer 往往是多 Agent 系统最先产生收益的角色，但只有“换一个会话再看一遍”仍然不够。

Reviewer 应看到：

- 最终需求、非目标和验收标准；
- 已接受的设计与关键决策；
- 代码差异，而不是默认读取所有无关源码；
- 单元测试、静态检查和运行结果；
- Engineer 明确声明的已知限制。

Reviewer 不必看到：

- Engineer 的完整私有推理过程；
- 已经被推翻的中间方案；
- 没有证据的自我评价；
- 与当前变更无关的大量历史对话。

这种隔离不是为了隐藏事实，而是避免 Reviewer 被实现者的叙事锚定。共享规格和证据，隔离主观解释，通常比“完全共享”或“完全隔离”更可靠。

每条阻塞问题至少包含：

```yaml
finding:
  severity: high
  location: module_or_behavior
  claim: behavior_violates_acceptance_rule
  evidence: reproducible_test_or_trace
  impact: user_or_system_consequence
  pass_condition: observable_condition_for_closure
```

普通建议应与验收缺陷分开，防止风格偏好制造无穷返工。修复后由 Engineer 提交新证据，Reviewer 复查原问题，不重新发明范围。超过最大轮次、双方对规格解释冲突或问题无法通过现有证据裁决时，交给 Orchestrator 或人工处理。

研究工作 MAST 将多 Agent 失败归纳为规格与系统设计、Agent 间失配、任务验证与终止等类别。这说明 Reviewer 不是万能补丁：如果规格本身含糊、交接对象不完整或退出条件缺失，多一个评审者仍可能让系统失败。

## Policy 是横切治理层

Policy 不应只写在某个 Agent 的 Prompt 里。至少需要在三个位置执行：

1. **调度前**：这个任务是否允许创建某类 Agent、使用某种模型或进入某个环境？
2. **调用前**：当前实例是否拥有此 Capability，参数是否越界，是否需要人工确认？
3. **调用后**：结果是否包含敏感信息，是否允许写入状态、交给下游或发送到外部？

MCP 当前工具规范明确建议用户能够看到并拒绝工具调用，并允许工具列表根据请求携带的授权发生变化。其安全最佳实践进一步建议使用渐进式最小权限 Scope、沙箱化本地进程、限制文件系统访问，并禁止把并非为当前 MCP Server 签发的 Token 直接传给下游服务。

Capability Gateway 至少应支持：

- 按 Profile 和任务裁剪工具；
- 区分读取、写入、破坏性和外部通信风险；
- 对高风险调用要求人工确认；
- 参数与输出 Schema 校验；
- 身份、Scope 与资源级授权；
- 超时、限频、幂等和重试边界；
- 敏感字段处理与完整审计。

Guardrail 可以检查输入、输出和工具调用，但不能替代认证、授权、沙箱和业务校验。OpenAI Agents SDK 也区分 Agent 输入/输出 Guardrail 与每次 Tool 调用都会经过的 Tool Guardrail，这说明高风险控制应尽量靠近实际副作用边界。

## Context、Memory 与交接

多 Agent 的上下文管理应围绕“当前阶段需要哪些事实”展开，而不是把所有历史复制给每个 Agent。

推荐共享：当前有效规格、已接受的设计决策、结构化约束和非目标、变更差异、工具执行结果、未解决问题与负责人。

谨慎共享：未验证猜测、其他 Agent 的完整推理过程、已失效计划、与当前职责无关的工具输出。

一个通用交接对象可以是：

```yaml
handoff:
  phase: review
  artifact_version: 4
  inputs:
    - requirements
    - accepted_design
    - code_diff
  decisions:
    - decision_id_and_reason
  evidence:
    - test_result_reference
  assumptions:
    - unverified_assumption
  open_questions:
    - unresolved_question
  requested_output: review_findings
```

长期 Memory 只应保存经过验证、未来仍可复用的事实或偏好；当前任务中的争论、失败尝试和临时状态属于 Artifact Store 或 Trace，不应自动升级为长期记忆。

## 可观测性与评测

没有 Trace，就很难判断失败来自模型、工具、上下文、交接还是 Orchestrator。OpenAI Agents SDK 的 Trace 会记录模型生成、工具调用、Handoff、Guardrail 和自定义事件，这类事件模型适合作为 Runtime 的最小观测骨架。

| 维度 | 指标示例 |
| --- | --- |
| 结果质量 | 任务通过率、回归缺陷、验收失败、未覆盖范围 |
| Reviewer 质量 | 有效问题率、误报率、重复问题、修复后重开率 |
| 协调效率 | Handoff 次数、等待时间、循环轮数、阻塞原因 |
| 工具可靠性 | 调用成功率、参数错误、超时、重试和权限拒绝 |
| 成本 | Token、模型调用次数、工具成本、总时延 |
| 治理 | 高风险调用、确认覆盖率、越权拦截、人工介入原因 |

Anthropic 的 Agent 评测实践建议组合确定性检查、代码或环境验证、模型评分和人工校准，而不是依赖单一 Judge。对编码任务，单元测试、静态分析和运行环境结果通常应优先于模型意见。

评测时至少比较：

```text
A. 单 Agent
B. 单 Agent + 确定性验证
C. Engineer + 独立 Reviewer
D. 动态 Specialist + 完整 Runtime
```

使用相同任务、近似预算和独立评分标准，才能判断收益来自架构，还是仅仅来自更多 Token。近期关于 Agent 系统扩展规律的预印本也显示，顺序任务、工具密集任务和不同协调拓扑可能出现完全不同的结果，因此不能把某个基准上的“更多 Agent 更好”当作普遍规律。

## 渐进式落地路线

### L0：单 Agent、工具和确定性验证

- 建立清晰工具契约；
- 接入测试、静态分析和可复现环境；
- 记录 Trace、成本和退出原因；
- 用代表性任务建立基线。

没有可靠工具和评测时，不要先建设多 Agent 平台。Anthropic 在 Coding Agent 实践中也强调，工具界面优化经常比复杂 Prompt 更重要。

### L1：Profile 与最小权限能力视图

- 把 Instructions、Skills、Capability Grants、Policy 和输出 Schema 配置化；
- 区分 Profile 与运行实例；
- 按任务计算有效权限；
- 为高风险工具增加确认与审计。

### L2：增加独立 Reviewer

- 先在高风险或高价值任务启用；
- 共享规格、差异和证据，隔离实现者私有推理；
- 要求问题可复现、可证伪；
- 设置最大评审轮次和人工裁决。

### L3：状态机与按需 Specialist

- 用代码维护阶段和失败转移；
- 仅在领域风险出现时创建 Specialist；
- 对可并行子任务使用并发；
- 对紧密耦合任务保持单一负责人。

### L4：平台化 Agent Runtime

只有当多个团队、任务、执行环境或模型需要共享治理时，再建设 Profile 与 Skill Registry、Capability Gateway、Policy Engine、Durable Task、Artifact Store，以及统一 Trace、评测、成本和跨会话恢复能力。

如果问题只是单个任务内部的局部分工，主 Agent 加按需子 Agent 通常已经足够。关于任务内子 Agent 与长期控制面的边界，可继续阅读[Multica：Agent 管理层、控制面与适用边界](./multica-agent-control-plane.md)。

## 常见反模式

1. **用角色名称代替架构**：不同 Agent 使用相同上下文、工具、模型和目标，只是职位名称不同。
2. **每个 Agent 各建一套 Capability Layer**：重复实现造成工具版本和安全策略漂移；优先共享语义契约，通过授权生成能力视图。
3. **把 Policy 当作 Prompt 文本**：Prompt 不能可靠阻止越权写入或外部副作用，关键策略必须由 Runtime 和底层服务执行。
4. **用多数投票代替证据**：多个 Agent 同意不能证明正确，优先检查规格、测试、运行结果和可复现反例。
5. **Reviewer 直接修代码**：它会从独立验证者变成第二个实现者；需要修复时应创建新的 Engineer Instance。
6. **所有任务启动完整团队**：简单任务不应承担固定多角色流程的延迟、成本和交接损失。
7. **Orchestrator 成为超级 Agent**：它应管理状态、契约和资源，而不是再次垄断需求、实现、评审和最终裁决。

## 架构评审清单

### 是否需要多 Agent

- 单 Agent 加确定性工具是否已经足够？
- 子任务是否真的可以独立完成和验收？
- 新 Agent 是否拥有不同目标、证据、专业能力或权限边界？
- 质量收益能否覆盖延迟、Token 和协调成本？

### Agent 与交接

- Profile 与 Instance 是否分开？
- 每个阶段是否有明确输入、输出 Schema 和完成条件？
- 交接传递的是有效产物，还是整段聊天历史？
- 冲突由规格、测试、规则还是人工裁决？

### 能力与安全

- Capability 是否独立于具体 Tool 实现？
- Agent 是否只看到当前任务需要的工具？
- 权限是否由 Profile、任务、Runtime Policy 和用户授权共同决定？
- 写入、破坏性操作和外部通信是否有审批、幂等和审计？

### 验证与运行

- 是否优先使用测试、静态分析和运行结果？
- Reviewer 的问题是否必须提供证据和通过条件？
- 是否设置最大轮次、预算、超时和人工升级？
- Trace 能否还原模型、工具、Handoff、Guardrail 和状态转移？
- 是否用单 Agent 基线证明多 Agent 的增量价值？

## 延伸阅读

- [多 Agent 工程协作：角色之外的认知独立性](./multi-agent-cognitive-independence.md)
- [Agent 代码审查的哲学：从黑盒验证到渐进式保证](./agent-code-review-progressive-assurance.md)
- [MCP 工具网关：基础架构与核心契约](./mcp-gateway-foundation.md)
- [Multica：Agent 管理层、控制面与适用边界](./multica-agent-control-plane.md)

## 公开参考

- OpenAI, [A practical guide to building agents](https://openai.com/business/guides-and-resources/a-practical-guide-to-building-ai-agents/)
- OpenAI Agents SDK, [Agent orchestration](https://openai.github.io/openai-agents-python/multi_agent/)
- OpenAI Agents SDK, [Guardrails](https://openai.github.io/openai-agents-python/guardrails/)
- OpenAI Agents SDK, [Tracing](https://openai.github.io/openai-agents-python/tracing/)
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)
- Anthropic, [Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- Agent Skills, [Specification](https://agentskills.io/specification)
- Model Context Protocol, [Architecture overview, revision 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/learn/architecture)
- Model Context Protocol, [Tools specification, revision 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
- Model Context Protocol, [Security Best Practices, revision 2026-07-28](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices)
- Wu et al., [AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation](https://www.microsoft.com/en-us/research/publication/autogen-enabling-next-gen-llm-applications-via-multi-agent-conversation-framework/)
- Cemri et al., [Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657)
- Kim et al., [Towards a Science of Scaling Agent Systems](https://arxiv.org/abs/2512.08296)
