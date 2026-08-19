---
title: 多 Agent 工程协作：角色之外的认知独立性
date: 2026-08-19
tags:
  - Multi-Agent
  - Agent Architecture
  - AI Engineering
description: 从目标、上下文、工具与权限的差异出发，设计能相互制约并稳定收敛的多 Agent 工程流程
---

# 多 Agent 工程协作：角色之外的认知独立性

## 要解决的问题

把工程任务拆给产品、架构、开发、评审和测试等多个 Agent，直觉上很像组建了一支软件团队。但角色名称本身不会自动提升质量：如果所有 Agent 共享相同上下文、目标和判断偏好，它们很可能重复同一条推理路径，只是增加了调用次数。

多 Agent 系统真正需要解决的不是“安排多少角色”，而是三个问题：

1. 如何让不同阶段形成有效制约，而不是相互附和？
2. 如何为每个 Agent 分配恰当的信息、工具和权限？
3. 如何让协作过程能够收敛，并证明额外成本带来了质量收益？

## 核心判断：角色分工不等于认知独立

单 Agent 容易形成自我确认闭环：它提出方案、完成实现，再沿用相同假设检查自己的结果。多 Agent 的主要价值，是在关键节点引入一条相对独立的判断路径。

因此，一个 Agent 不应只由角色提示词定义。更完整的抽象是：

```text
Agent = Role + Context + Tools + Policy + Memory + Objective + Output Contract
```

其中最关键的差异包括：

| 维度 | 作用 | Reviewer 示例 |
| --- | --- | --- |
| Objective | 决定优化方向 | 尽可能发现可验证的问题，而不是证明实现正确 |
| Context | 控制可见信息 | 阅读需求、设计、变更和测试结果，不继承开发过程中的自我辩护 |
| Tools | 限定行动能力 | 可读文件、查看差异、执行测试 |
| Policy | 建立职责边界 | 只报告问题，不直接修改实现 |
| Output Contract | 约束交付物 | 每个问题必须包含严重级别、位置、证据和修复条件 |

这里的 Objective 或“评价函数”不一定是可以精确计算的数学函数，而是 Agent 面对多个可行选项时优先保住什么。例如 Product 优先用户价值，Architect 优先正确性和演进边界，Engineer 优先以最小复杂度完成契约，Reviewer 则优先发现反例。

### 只有角色名称的伪分工

下面这种设计看起来有三个角色，实际上没有建立新的判断来源：

```text
                         same requirement
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │ Product     │ │ Engineer    │ │ Reviewer    │
        │ same context│ │ same context│ │ same context│
        │ same model  │ │ same model  │ │ same model  │
        └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
               │               │               │
               └───────────────┼───────────────┘
                               ▼
                     mutually agreeable answer
```

三个 Agent 继承了同一组假设，也没有独立证据，最后很可能只是从不同职位口吻确认同一个方案。这不是协作，而是把相似推理重复执行了三次。

### 由不同目标和产物构成的真实分工

更好的设计，是让不同角色沿着一条产物链工作，同时使用不同的优化目标检查上游结果：

```text
                         Requirement
                              │
                              ▼
                    ┌───────────────────┐
                    │ Product Agent     │
                    │ maximize          │
                    │ user value        │
                    └─────────┬─────────┘
                              │ PRD / acceptance criteria
                              ▼
                    ┌───────────────────┐
                    │ Architect Agent   │
                    │ maximize          │
                    │ correctness       │
                    └─────────┬─────────┘
                              │ design / constraints
                              ▼
                    ┌───────────────────┐
                    │ Engineer Agent    │
                    │ minimize          │
                    │ implementation    │
                    │ complexity        │
                    └─────────┬─────────┘
                              │ code / self-test evidence
                              ▼
                    ┌───────────────────┐
                    │ Reviewer Agent    │
                    │ maximize          │
                    │ defect discovery  │
                    └─────────┬─────────┘
                              │ issues / review scope
                              ▼
                    ┌───────────────────┐
                    │ Engineer Agent    │
                    │ fix verified      │
                    │ issues only       │
                    └───────────────────┘
```

这条链路中的 PRD、设计、代码和问题清单是显式交付物。下游 Agent 检查的是上游产物是否满足契约，而不是继续同一段自由讨论。

### 认知独立性来自哪些差异

如果几个 Agent 只有 Role 不同，其他维度完全相同，它们仍然只是同一个模型的多次采样。有效独立性至少可以来自五个方向：

1. **信息不同**：Reviewer 读取最终需求、设计和差异，不继承 Engineer 的全部推理过程。
2. **目标不同**：Engineer 追求完成，Reviewer 追求发现反例，Judge 追求按约束裁决。
3. **证据不同**：实现依赖代码阅读，验证依赖测试结果、静态分析或外部事实来源。
4. **能力和权限不同**：Engineer 可以写代码，Reviewer 默认只读，发布动作由独立阶段控制。
5. **模型或采样路径不同**：必要时使用不同模型、提示结构或独立会话，降低相关性错误。

可以把它理解成一条设计启发，而不是严格公式：

```text
effective independence
    ≈ different objectives
    + separated context
    + independent evidence
    + isolated permissions
    + explicit output contracts
```

真正重要的是“错误是否会被另一条路径发现”。Agent 数量本身不是有效指标。

## 一个可落地的最小工程闭环

对于复杂编码任务，可以从五个阶段开始：

```text
┌─────────────┐    problem / goal
│ User        │
└──────┬──────┘
       ▼
┌─────────────┐    scope + non-goals + acceptance criteria
│ Analyst     │
└──────┬──────┘
       ▼
┌─────────────┐    design + contracts + risks
│ Architect   │
└──────┬──────┘
       ▼
┌─────────────┐    code + self-test evidence
│ Engineer    │
└──────┬──────┘
       ▼
┌─────────────┐    findings + evidence + pass conditions
│ Reviewer    │
└──────┬──────┘
       ▼
┌─────────────┐    acceptance + regression + boundary tests
│ Tester      │
└──────┬──────┘
       │
   ┌───┴────┐
   ▼        ▼
 PASS      FAIL ──→ Engineer ──→ Reviewer ──→ Tester
   │
   ▼
 Done
```

五个阶段不意味着必须常驻五个 Agent。简单任务可以合并 Analyst 与 Architect，或者由测试工具代替独立 Tester。是否拆分，应取决于任务是否存在值得独立判断的风险，而不是为了追求角色数量。

### 明确阶段交付物

每次交接最好传递结构化产物，而不是整段聊天记录：

| 阶段 | 最小交付物 |
| --- | --- |
| Analyst | 问题定义、非目标、边界条件、验收标准 |
| Architect | 方案、受影响契约、权衡、失败模式 |
| Engineer | 实现差异、自测结果、已知限制 |
| Reviewer | 按严重级别排列的问题及其证据 |
| Tester | 验收结果、未覆盖范围、回归风险 |

这种设计既能减少上下文污染，也使 Orchestrator 可以判断当前阶段是否完成，而不是依赖 Agent 自己宣称“已经完成”。

### 用一个具体需求理解分工

假设需求是“为系统增加批量导入用户功能”，不同角色不应只是轮流复述需求：

- Product / Analyst 需要确定导入对象、业务规则、权限要求、错误反馈方式、部分失败是否允许，以及什么状态才算完成。
- Architect 需要决定同步还是异步、任务如何拆分、重复提交如何去重、进度如何查询、失败如何重试，以及数据量增长时系统如何退化。
- Engineer 只在已经批准的契约内实现，记录实际变更、自测结果和未覆盖项，不擅自扩张需求。
- Reviewer 对照验收标准检查权限绕过、并发覆盖、幂等性、资源耗尽、错误处理和过度设计，而不是简单评价代码风格。
- Tester 用正常、空文件、格式错误、重复数据、部分失败、取消、重试和大数据量等用例验证系统行为。

同一个例子也说明，并非每个阶段都必须由大模型完成。格式校验、静态分析、单元测试和性能测试通常应由确定性工具执行，Agent 负责选择、解释和补充这些证据。

## 优先增加对抗式 Reviewer

当只能增加一个新 Agent 时，通常应优先引入 Reviewer。原因不是开发 Agent 缺少生成能力，而是它容易沿用刚刚做出的假设，忽略反例。

Reviewer 要成为有效的对抗面，需要满足以下条件：

- 目标是寻找 correctness、security、maintainability 和需求偏差，而不是总结实现。
- 读取需求、方案、代码差异和测试证据，但不必接收开发过程中的全部推理。
- 默认只读，避免一边评审一边替自己的修改辩护。
- 报告必须指向可复现或可证伪的问题，不能用泛化建议制造噪声。
- “没有发现问题”不等于证明正确；仍需说明检查范围和未验证部分。

最小可用的 Engineer–Reviewer 循环如下：

```text
                       Engineer
                           │
                           │ code + test evidence
                           ▼
                    ┌──────────────┐
                    │ Reviewer     │
                    └──────┬───────┘
                           │
                 ┌─────────┴─────────┐
                 │                   │
             no issue              issues
                 │                   │
                 ▼                   ▼
               Done              Engineer
                                     │
                                     │ fix + new evidence
                                     └──────────→ Reviewer
```

这个闭环要能够收敛，必须再加四条运行规则：

1. Reviewer 只报告阻止验收的具体问题，普通建议与缺陷分开处理。
2. Engineer 逐条回应问题，并提供新的验证证据，不能只回复“已修复”。
3. 同一问题连续争议时，由 Orchestrator 根据需求或测试事实裁决，而不是无限辩论。
4. 达到最大评审轮次、出现高风险不确定性或需要扩大权限时，转交人工决策。

一个简化配置可以表达为：

```yaml
reviewer:
  objective: find_falsifiable_issues
  context:
    - requirements
    - architecture_decisions
    - code_diff
    - test_results
  tools:
    - filesystem_read
    - git_diff
    - test
  policy:
    - no_code_changes
    - evidence_required
  output:
    - severity
    - location
    - evidence
    - pass_condition
```

这类配置比一句“你是一名资深 Reviewer”更能稳定地产生职责差异。

## 多方案辩论何时有效

架构决策可以让多个 Agent 从不同优化目标出发并行提出方案，例如：

- 保守方案：优先复用现有组件，降低引入风险。
- 扩展方案：优先长期容量和演进空间。
- 成本方案：优先交付速度与维护成本。

随后由 Judge 根据预先声明的约束进行选择。Judge 的输入应该是候选方案、证据、代价和适用条件，而不是“哪一方说得更有说服力”。如果不同方案没有明确的优化目标，或者 Judge 没有稳定评价标准，多角色辩论很容易退化成冗长的 AI 会议。

```text
                         Requirement
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
     ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
     │ Architect A    │ │ Architect B    │ │ Architect C    │
     │ conservative   │ │ growth-first   │ │ cost-first     │
     └────────┬───────┘ └────────┬───────┘ └────────┬───────┘
              │ proposal A       │ proposal B       │ proposal C
              └───────────────┬──┴──┬───────────────┘
                              ▼     ▼
                       ┌────────────────┐
                       │ Judge          │
                       │ constraints    │
                       │ evidence       │
                       │ trade-offs     │
                       └───────┬────────┘
                               ▼
                         Final Design
```

在启动辩论前，应先写出 Judge 的评价维度，例如当前规模、SLA、交付期限、运维能力、迁移成本和可逆性。如果评价标准在看到方案之后才临时变化，Judge 很容易选择语言最完整的答案，而不是最适合约束的答案。

## Orchestrator、Agent、Skill 与 Tool 的边界

多 Agent 协作可以与能力层自然结合：

```text
                         ┌──────────────────────┐
                         │ Agent Runtime        │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │ Orchestrator         │
                         │ route / state / stop │
                         └──────────┬───────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
   ┌────────────────┐      ┌────────────────┐      ┌────────────────┐
   │ Product Agent  │      │ Engineer Agent │      │ Reviewer Agent │
   └───────┬────────┘      └───────┬────────┘      └───────┬────────┘
           │                       │                       │
   ┌───────▼────────┐      ┌───────▼────────┐      ┌───────▼────────┐
   │ Skills/Policy  │      │ Skills/Policy  │      │ Skills/Policy  │
   └───────┬────────┘      └───────┬────────┘      └───────┬────────┘
           │                       │                       │
   ┌───────▼────────┐      ┌───────▼────────┐      ┌───────▼────────┐
   │ Search / Docs  │      │ Git / FS / Test│      │ Diff / Test    │
   │ issue tracker  │      │ Terminal       │      │ static analysis│
   └────────────────┘      └────────────────┘      └────────────────┘
```

可以简化为四个问题：

- Tool 回答“能做什么”。
- Skill 回答“应该怎样做”。
- Agent 回答“谁以什么职责来做”。
- Orchestrator 回答“什么时候让谁做，以及何时停止”。

不同角色不必获得全部工具。Analyst 可能只需要文档和检索，Engineer 可以写文件并执行测试，Reviewer 则只读代码和测试结果。按职责裁剪能力既能降低干扰，也能限制错误操作的影响范围。

### Orchestrator 管理的不是聊天，而是状态机

Orchestrator 至少需要维护以下状态：

```text
ANALYZE ──→ DESIGN ──→ IMPLEMENT ──→ REVIEW ──→ TEST ──→ DONE
   ▲           │            ▲           │          │
   │           │ blocked    │ findings  │ failure  │
   └───────────┘            └───────────┴──────────┘

Any state ── high-risk / missing authority / max retries ──→ HUMAN
```

每个状态都应声明：允许进入的前置条件、负责角色、可用工具、交付物 Schema、验证方式、失败转移和停止条件。没有这些约束时，所谓 Orchestrator 往往只是把多个聊天请求串在一起。

一个通用的交接对象可以包含：

```yaml
handoff:
  phase: review
  artifact_version: 3
  inputs:
    - requirements
    - approved_design
    - code_diff
  decisions:
    - chosen_approach_and_reason
  assumptions:
    - facts_not_yet_verified
  evidence:
    - tests_and_checks
  open_questions:
    - unresolved_items
  status: ready_for_review
```

Agent 可以用自然语言工作，但阶段间最好传递这种结构化事实，避免下游从长对话中猜测最新结论。

## 边际收益与扩容准则

多 Agent 的收益通常会递减。第二条独立审查路径可能带来明显提升；继续增加相似角色，常常只会增加延迟、Token 消耗、交接损失和冲突协调成本。

```text
quality gain
    ^
    |                         __________
    |                    ____/
    |                ___/
    |            ___/
    |        ___/
    |_______/________________________________> agent count
           2     3     5          10

           ↑     ↑     ↑           ↑
        critique specialist workflow   coordination cost dominates
```

这条曲线只是设计启发，不是普遍定律。常见现象是从一个 Agent 增加到“执行者 + 独立评审者”时提升最明显；再增加领域 Specialist 仍可能有效；当多个 Agent 的职责开始重叠时，收益会快速变小。

只有当新 Agent 至少满足以下一项时，才值得加入：

- 拥有其他角色没有的领域知识或证据来源。
- 优化目标与现有角色存在必要张力。
- 需要不同的工具或权限边界。
- 能产出独立、可验证的阶段交付物。
- 能替代一个高风险的人工作业节点。

反过来，如果新角色与现有角色看到相同输入、使用相同工具、追求相同目标，并且输出也没有独立验收方式，就应该合并。

可以按风险逐步激活角色，而不是每个任务都启动全套团队：

| 任务特征 | 建议角色 |
| --- | --- |
| 小型、边界明确、确定性测试充分 | Engineer |
| 普通功能修改 | Engineer + Reviewer |
| 需求含糊或跨多个使用场景 | Analyst + Engineer + Reviewer |
| 涉及接口、数据或长期演进权衡 | Analyst + Architect + Engineer + Reviewer |
| 涉及安全、迁移、并发或高影响发布 | 完整流程，并加入相应领域 Specialist 与人工门禁 |

## 如何验证多 Agent 是否真的更好

多 Agent 设计不能只用“回答看起来更完整”来评估。可以用同一组代表性任务比较三种基线：

1. 单 Agent 完成实现和自检。
2. Engineer 加独立 Reviewer。
3. 完整的分析、设计、实现、评审和测试流程。

至少记录以下指标：

- 任务一次通过率与最终通过率。
- 进入生产前发现的有效缺陷数。
- Reviewer 的误报率和重复问题比例。
- 修复后重新打开的问题数。
- 总耗时、模型调用次数和 Token 成本。
- 需要人工介入的次数与原因。

只有当质量提升覆盖了额外成本，新增角色才有工程价值。对低风险、边界明确的小改动，单 Agent 加确定性测试往往更经济。

评估时还要避免两个误区。第一，不能只挑适合多 Agent 的复杂任务，否则结论天然偏向新方案；任务集应同时包含简单修改、模糊需求、架构决策和高风险缺陷。第二，不能把更长的输出当成更高质量，最终评分应尽量来自测试、缺陷复核和人工盲审等独立证据。

## 适用边界与常见失败模式

### 适合使用

- 需求、架构、实现之间存在明显的职责冲突。
- 安全、并发、迁移或兼容性风险需要独立审查。
- 任务可以拆成有清晰输入、输出和验收条件的阶段。
- 不同角色确实需要不同工具、知识或权限。

### 不适合使用

- 任务很小，确定性检查已经足够。
- 交接成本高于任务本身。
- 多个角色只能重复相同上下文和判断标准。
- 没有统一事实来源，也没有冲突裁决规则。

### 常见错误

1. **只改角色提示词**：名称不同，但目标、上下文和工具完全相同。
2. **共享全部推理历史**：Reviewer 被开发过程中的假设锚定，失去独立性。
3. **没有停止条件**：评审与修复反复循环，却没有严重级别和最大轮次限制。
4. **让 Judge 凭印象投票**：没有约束和证据标准，结论只是多数意见。
5. **权限随角色数量扩张**：每个 Agent 都拥有写入和外部操作能力，放大安全风险。
6. **缺少成本基线**：只统计生成质量，不统计时延、Token 与人工协调成本。

## 可复用的设计清单

在增加一个 Agent 前，逐项回答：

- 它负责的判断是否能与现有角色保持独立？
- 它独有的目标、上下文、工具或权限是什么？
- 它要交付什么结构化产物？
- 谁负责验证这个产物？
- 与其他角色冲突时依据什么裁决？
- 什么条件触发返工，最多循环几次？
- 哪些指标可以证明它值得额外成本？

多 Agent 的目标不是模拟一家人员众多的公司，而是构造少量、清晰、可验证的认知分工。先建立独立 Reviewer 和可收敛的工程闭环，再根据真实瓶颈添加 Specialist，通常比一次性堆叠大量角色更可靠。
