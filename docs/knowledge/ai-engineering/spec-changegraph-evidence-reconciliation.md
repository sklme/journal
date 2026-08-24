---
title: Spec、ChangeGraph 与 EvidenceGraph：Agent 开发的意图—实现—证据闭环
date: 2026-08-24
tags:
  - AI 工程
  - Spec
  - ChangeGraph
  - EvidenceGraph
  - Agent Harness
description: 把 Spec 抽象为意图层，并用实现图和证据图持续发现漂移、完成对齐与验收
---

# Spec、ChangeGraph 与 EvidenceGraph：Agent 开发的意图—实现—证据闭环

## 要解决的问题

Spec-first 希望在人与 Agent 开始实现前先对齐需求，这个方向直觉上非常合理。但实际开发中，规格、设计和任务会随着理解深入而频繁变化：最初方案可能被推翻，范围可能收缩，代码可能暴露未知约束，开发结束时甚至没有人记得当前 Spec 处于什么状态。

另一个问题是，过于详尽的 Spec 本身也会超过人的理解能力。团队可能从“读不完代码”走向“既读不完代码，也读不完规格”，最后仍只能依赖测试和 Agent 的解释。

这并不意味着 Spec 没有价值。即使它不断变化，仍然保留了需求为什么产生、如何演化以及哪些决策曾经被明确讨论的轨迹。

真正需要解决的是：

> 如何让 Spec 成为可演化的意图层，而不是假装永远正确的唯一事实；如何让代码变化和验证证据持续反向校验这层意图？

## 核心结论

Spec、代码和测试不应争夺“唯一事实来源”。它们分别表达不同类型的事实：

- **Spec 是规范性意图**：系统应该做什么。
- **Code 是操作性现实**：系统当前被实现成什么。
- **Tests 与 Runtime 是经验性证据**：哪些行为被验证或观察到。
- **ChangeGraph 是对齐与解释层**：实现具体改变了什么，以及这些改变如何关联意图与证据。

理想系统不应选择其中一个覆盖其他层，而应持续管理它们之间的差异。

## 三图结构

可以把一次 Agent 变更表达成三个互相关联的图：

```text
意图图 Intent Graph
  “系统应该发生什么变化”
            │
            │ implements
            ▼
实现图 ChangeGraph
  “代码实际上发生了什么变化”
            │
            │ verified_by
            ▼
证据图 Evidence Graph
  “哪些行为得到测试或运行证据支持”
```

三张图分别产生一个 Delta：

```text
ΔI：期望行为发生了什么变化
ΔC：代码、结构和数据关系实际发生了什么变化
ΔE：增加、减少或失效了哪些验证证据
```

Review 不再只是阅读 `ΔC`，而是比较三者：

- `ΔI` 中的每个重要声明是否有实现？
- `ΔC` 中的每个重要变化是否能解释其意图来源？
- 每个行为与风险声明是否有足够的 `ΔE`？
- 三者冲突时，是修改 Spec、修改代码，还是接受一个有记录的例外？

## Spec 层不是某个工具或目录格式

Spec 层不应与 OpenSpec、某个 Markdown 模板或固定开发流程绑定。它是一个抽象的信息层，可以从多种来源输入：

- Issue、用户故事和需求文档。
- 对话中确认的目标与限制。
- OpenSpec、Spec Kit 或其他规格工具。
- API Schema、数据约束和协议定义。
- 既有测试表达的行为契约。
- 架构规则、合规要求与运维限制。

OpenSpec 可以作为其中一种适配器：它提供 proposal、behavior spec、design、tasks 和 delta spec 等制品，但 ChangeGraph 系统不应要求所有项目采用同一套工具。

内部需要的是统一的意图模型，而不是统一的写作方式：

```text
OpenSpec ──────┐
Issue / PRD ───┤
Chat 决策 ─────┼──► Intent Normalizer ──► Intent Graph
API Schema ────┤
人工录入 ──────┘
```

这让团队可以继续使用熟悉的需求工具，同时获得相同的意图—实现—证据对齐能力。

## 不同制品需要不同生命周期

“Spec 会消失”往往是因为把生命周期完全不同的内容放进同一种文档。

| 制品 | 表达内容 | 合理生命周期 |
| --- | --- | --- |
| Proposal | 为什么做、范围是什么 | 一次变更，完成后归档 |
| Behavior Claim | 外部行为、不变量和约束 | 相对长期，但允许演化 |
| Design Decision | 技术方案和关键取舍 | 保留重要决策，淘汰临时细节 |
| Tasks | Agent 的执行清单 | 短期，完成后只保留必要记录 |
| Code | 当前实现机制 | 持续演化 |
| Evidence | 测试、检查、Trace 和监控 | 随实现与环境持续变化 |

真正应该长期保留的不是每个实现步骤，而是：

- 需求为何产生。
- 哪些外部行为必须成立。
- 哪些不变量不能破坏。
- 哪些范围明确不做。
- 实现过程中改变过哪些重要假设。
- 最终实现与最初意图之间有哪些经确认的差异。

Tasks、文件列表和临时方案可以归档，不必持续占据当前理解界面。

## Spec 的最小稳定内核

为了避免规格膨胀，Spec 层只应要求足以支持实现和验证的最小稳定意图：

- 目标和业务原因。
- 可观察行为。
- 前置条件与触发条件。
- 结果和可观察副作用。
- 不变量与禁止行为。
- 非目标和范围边界。
- 风险等级。
- 必须提供的验证证据。

它不应默认包含：

- 内部类名和函数名。
- 文件修改清单。
- 逐步实现计划。
- 可以从代码自动提取的结构细节。
- Agent 为完成任务临时产生的思考过程。

实现细节属于 Design 和 ChangeGraph，而不是长期行为契约。

## 行为层的初步模型

行为不一定要先写成长篇自然语言文档。可以把它建模成一组可演化的 **Behavior Claim**，每个声明具有稳定标识、明确边界和期望证据。

```yaml
id: order.timeout-close
title: 未支付订单超时关闭

intent:
  goal: 避免未支付订单长期占用库存

behavior:
  trigger: 订单超过支付时限
  preconditions:
    - 订单仍处于未支付状态
  outcomes:
    - 订单进入关闭状态
    - 被占用库存得到释放

invariants:
  - 已支付订单不得被超时关闭
  - 同一订单的库存最多释放一次

forbidden:
  - 不得产生重复退款或重复撤销

nonGoals:
  - 不调整人工取消订单流程

risk: high

requiredEvidence:
  - end-to-end
  - concurrency
  - compensation-path
```

这不是要求所有团队采用 YAML，而是说明 Intent Graph 至少需要哪些语义。输入可以来自 Markdown、表单、对话或其他 Spec 工具，最终归一化成相同的声明节点。

### 行为声明的节点类型

首版模型可以包含：

- **Goal**：为什么需要这个变化。
- **Behavior**：外部可观察结果。
- **Scenario**：一个具体的 Given/When/Then 示例。
- **Invariant**：无论实现如何都必须成立的性质。
- **Forbidden Behavior**：明确禁止发生的结果。
- **Non-goal**：本次不会处理的范围。
- **Risk**：失败代价、不可逆性与敏感区域。
- **Evidence Requirement**：接受前必须提供什么证据。

### 行为声明之间的关系

Intent Graph 还需要表达：

- `refines`：一个场景细化某项行为。
- `constrained_by`：行为受某个不变量约束。
- `conflicts_with`：两个意图存在冲突。
- `supersedes`：新声明取代旧声明。
- `depends_on`：一个行为依赖另一项能力。
- `out_of_scope`：明确排除的相邻能力。

这比把所有内容塞进一篇 Spec 更适合增量演化和交互 Review。

## 从 Intent Graph 看实现覆盖

每个重要行为声明都应连接到实际实现和验证证据：

```text
Behavior：订单超时后自动关闭
      │
      ├─ implements ──► Timeout Scheduler
      ├─ implements ──► Order Cancellation Flow
      └─ verified_by ─► 订单超时端到端测试

Invariant：库存最多释放一次
      │
      ├─ enforced_by ─► Idempotency Guard
      └─ verified_by ─► 并发执行测试
```

没有实现关系的声明是“未实现意图”；有实现但没有证据的声明是“未验证意图”。

## 从 ChangeGraph 看范围越界

ChangeGraph 也要反向检查每项重要代码变化是否有来源：

```text
修改 Payment Retry Policy
      │
      └─ 没有对应 Behavior / Design / Constraint
```

这不一定说明代码错误，可能有四种解释：

1. Agent 修改超出授权范围。
2. Spec 遗漏了必要行为。
3. 实现发现了新的技术约束。
4. Agent 顺便进行了没有价值的重构。

系统应暴露差异，而不是自动选择哪一方正确。

## Evidence Graph 不只是测试文件列表

证据需要表达“什么结果支持什么声明”，而不只是把测试文件连接到函数。

可能的证据节点包括：

- 单元、集成和端到端测试结果。
- 属性测试和反例搜索。
- 类型检查、静态分析和安全扫描。
- API、Schema 和依赖契约 Diff。
- 性能基准和资源限制。
- 运行时 Trace、灰度指标和监控告警。
- Reviewer 人工确认。

Evidence Graph 应记录：

- 证据支持哪个声明。
- 由谁或什么工具生成。
- 是否与 Builder 保持独立。
- 对应哪个代码版本和运行环境。
- 证据何时失效。
- 它证明了什么，又没有证明什么。

测试通过不是一个全局布尔值，而是局部证据。例如单元测试可以支持局部计算，却不能单独证明公共协议未改变；运行时 Trace 可以证明某条路径发生过，却不能证明其他路径不存在。

## 持续对齐，而不是开发结束后补文档

ChangeGraph 不应只在 Agent 完成全部实现后生成。理想流程是在实现过程中持续比较三张图：

```text
1. 捕获最小意图
          ↓
2. 人确认高风险声明、不变量和非目标
          ↓
3. Builder Agent 开始实现
          ↓
4. ChangeGraph 持续计算实际代码 Delta
          ↓
5. 系统发现缺失实现和范围外变化
          ↓
6. 独立 Verifier 构建 Evidence Graph
          ↓
7. 人按风险逐级 Review
          ↓
8. 处理全部重要漂移后接受或归档
```

实现过程中发现原意图错误时，不应为了“遵守 Spec”继续实现错误行为。正确流程是保留差异，请人确认后更新 Intent Graph：

```text
原意图
  ↓
实现发现新约束
  ↓
产生 Drift Proposal
  ↓
人确认
  ├─ 修改 Intent
  └─ 或要求修改 Code
```

Agent 可以提出意图更新，但不能因为代码已经这样写了，就自动把实现升级为需求事实。

## 四类需要显式处理的漂移

### 有意图，没有实现

```text
Intent Claim ──► Missing Implementation
```

继续实现，或明确缩减需求范围。

### 有实现，没有意图来源

```text
Unplanned Change ──► No Intent / Design Link
```

判断是实现越界、必要技术工作，还是 Intent 需要补充。

### 有意图和实现，没有证据

```text
Intent ──► Implementation ──► Missing Evidence
```

交给独立 Verifier 设计验证、反例或运行观测。

### 意图、实现和证据互相冲突

```text
Spec 期望 A
Code 实现 B
Test 验证 B
```

测试通过只能证明 B 自洽，不能证明 B 是正确需求。需要人判断修改 Spec 还是修改实现。

## Review 页面不应要求人阅读全部 Spec

默认界面应该展示对齐状态，而不是一次展开所有原始文档：

```text
Behavior：订单超时自动关闭

✓ 自动关闭入口已实现
✓ 订单状态转换已实现
✓ 库存释放已实现并有测试
△ 补偿路径已实现，但缺少集成证据
✗ 并发幂等不变量没有验证

范围外变化：
△ Agent 额外修改了支付重试策略
```

人按需逐步展开：

```text
行为声明
  → 实现节点
    → ChangeGraph 链路
      → 测试和 Trace
        → 原始代码
          → 完整 Spec / Design 历史
```

Spec 层提供原始意图材料，ChangeGraph 把它编译成可审查的变化视图，EvidenceGraph 说明哪些声明已有独立支持。

## 归档前的 Reconciliation

归档不应只是把文档移动到历史目录，而应完成一次显式校准：

```text
归档前必须处理：

- 未实现的 Behavior Claim
- 没有 Intent 来源的重要代码变化
- 没有证据支持的高风险声明
- 已经失效的 Design 假设
- Intent、Code 和 Evidence 之间的冲突
```

每个差异只能以三种方式关闭：

1. **修改实现**：代码偏离了确认后的意图。
2. **修改意图**：开发过程中发现需求或约束需要演化。
3. **记录例外**：当前明确接受差异，并保留原因、风险和责任人。

闭环原则可以概括为：

```text
Intent first
Evidence throughout
Reconciliation before acceptance
```

这里的 Intent first 不是瀑布式冻结需求，而是先建立一个可以被讨论和追踪的最小意图基线；Evidence throughout 表示证据在开发过程中持续建立，而不是最后补测试；Reconciliation before acceptance 表示接受变更前必须显式处理重要差异。

## 与渐进式 Review 结合

Spec 严谨度和 Review 深度都应由风险决定。

### 低风险变更

- 只记录轻量目标、验收条件和非目标。
- 依赖强自动验证。
- ChangeGraph 没有范围越界即可快速接受。

### 中风险变更

- 建立 Behavior Delta。
- 展示 Intent 到 ChangeGraph 的实现覆盖。
- 检查影响范围和证据缺口。
- 人审查关键业务链路。

### 高风险变更

- 明确不变量、禁止行为和失败路径。
- 强制独立 Verifier。
- 深入检查数据流、副作用和公共契约。
- 对关键节点进入源码级审查。
- 使用灰度、监控和回滚补充合并前证据。

风险配置可以保存在仓库中，为不同路径和变更类型声明所需 Spec 严谨度、Review 深度和 Evidence 类型。

## 最小可行实现

首版不需要建立完整的规格语言，可以从一个窄闭环开始：

1. 接收 Issue、Markdown 或 Spec 工具生成的需求。
2. 用 Agent 提取 Goal、Behavior、Invariant、Non-goal 和 Evidence Requirement。
3. 由人确认高风险声明，生成稳定 Claim ID。
4. 从 Git Diff 和代码分析构建局部 ChangeGraph。
5. 自动尝试建立 `implements` 和 `affected_by` 关系。
6. 从测试与 CI 构建局部 EvidenceGraph。
7. 输出未实现、未解释、未验证和互相冲突的声明。
8. 归档前要求人处理高风险漂移。

首版的价值不在于把自然语言完全形式化，而在于让重要意图不再只存在于长文档中，并能与实际变化和证据建立可检查的关系。

## 行为层仍需继续研究的问题

### 声明粒度

一个 Behavior 应对应用户能力、业务规则、状态转换还是单个验收场景？粒度过大会无法连接具体实现，粒度过小又会产生与代码图相同的节点海洋。

### 自然语言与结构化模型的边界

哪些部分必须结构化，哪些应保留自然语言弹性？完全形式化成本太高，完全自由文本又难以自动对齐。

### 稳定身份

需求改名、拆分、合并和替代后，Claim ID 如何保持可追踪？`supersedes`、`split_into` 和 `merged_from` 等演化关系可能是必要能力。

### 意图修改权限

Agent 在什么情况下可以直接修正文案，什么情况下必须生成 Drift Proposal 等待人确认？不同风险级别可能需要不同权限。

### 证据充分性的判断

系统如何知道一个测试真正支持某个 Behavior，而不只是文件名相似或覆盖了相关代码？需要结合测试语义、执行路径和独立 Verifier 的判断。

### 非功能性行为

性能、隐私、兼容性、可维护性和运维恢复能力如何进入 Intent Graph？这些约束通常难以用单个 Given/When/Then 场景表达。

### 多变更并行

多个 Agent 同时修改同一 Intent、代码路径或公共契约时，如何检测语义冲突，而不仅是 Git 文本冲突？

这些问题说明行为层不应过早冻结成一种 DSL。更合适的路线是先验证“声明—实现—证据”闭环能否减少 Review 成本，再逐步收敛模型。

## 应避免的方向

### 把 Spec 当成不可修改的真理

开发会产生新知识。冻结 Spec 会把合理学习过程误判为违规。

### 自动用代码覆盖意图

代码可能只是错误实现。任何重要 Intent 更新都需要显式依据和审批。

### 把所有实现细节写进 Spec

可以从代码自动提取的信息不应重复人工维护，否则会快速漂移。

### 强制所有代码节点映射 Behavior

辅助代码、内部重构和必要基础设施不一定直接对应业务需求，可以映射到 Design、Constraint 或 Necessary Implementation。

### 让同一个 Agent 完成全链路自证

生成 Intent、实现代码、编写测试并判断对齐都由同一认知主体完成时，共同盲区仍然存在。

### 默认展示全部历史

历史需要保留，但当前界面只应突出有效意图、本次 Delta、未解决漂移和证据状态。

## 可复用原则

1. **Spec 是意图层，不是某个工具或文件格式。**
2. **意图、实现和证据表达不同类型的事实。**
3. **长期保留稳定行为和决策，归档临时计划与任务。**
4. **用最小行为声明代替不断膨胀的规格文档。**
5. **ChangeGraph 持续发现实现覆盖和范围越界。**
6. **EvidenceGraph 记录局部证据的来源、范围和有效期。**
7. **Agent 可以提出意图变化，但不能静默改写高风险意图。**
8. **接受变更前必须显式处理重要漂移。**
9. **先验证闭环价值，再逐步形式化行为模型。**

## 延伸阅读与公开参考

- [AI 代码知识图谱的价值边界：从 Agent 加速层到人类代码地图](./ai-code-knowledge-graph-and-human-first-code-map.md)
- [Agent 代码审查的哲学：从黑盒验证到渐进式保证](./agent-code-review-progressive-assurance.md)
- [OpenSpec Core Concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/overview.md)
- [OpenSpec Concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md)
