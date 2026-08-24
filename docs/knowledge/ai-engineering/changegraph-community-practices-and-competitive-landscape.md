---
title: ChangeGraph 的社区实践与竞品分析：从代码地图到变更保证系统
date: 2026-08-24
tags:
  - ChangeGraph
  - AI代码审查
  - Code Review
  - 软件工程
description: 对比 AI 代码审查、可视化代码地图与代码分析基础设施，提炼面向人的变更保证系统可以复用的能力与差异化方向
---

# ChangeGraph 的社区实践与竞品分析：从代码地图到变更保证系统

## 要解决的问题

Agent 可以快速完成跨文件修改，但人的审查能力没有同步增长。传统 Pull Request 仍以文件和代码行为主要单位，审查者必须自行还原需求、调用链、影响范围和测试覆盖，理解成本往往接近亲自实现。

社区已经出现了 AI 代码审查、代码地图、结构化差异、代码索引、路径分析、运行时追踪和策略即代码等多类产品。问题不在于是否已有“图”，而在于这些能力能否共同回答一次变更最重要的几个问题：

1. 这次变更声称实现什么？
2. 代码实际上改变了什么？
3. 哪些业务链路受到影响？
4. 哪些结论已经有独立证据支持？
5. 哪些部分需要人继续深入审查？
6. Agent 后续修改后，哪些审查结论仍然有效？

本文基于各项目的公开官方资料分析能力边界。厂商公布的效果指标只视为产品声明，不作为独立验证结论；比较重点也不是价格或模型准确率，而是它们选择了什么审查单位、事实模型和人机交互方式。

## 核心判断

目前还没有一个成熟产品完整实现以下闭环：

```text
Intent Graph
“系统应该发生什么变化”
       │ implements
       ▼
ChangeGraph
“代码实际上发生了什么变化”
       │ verified_by
       ▼
Evidence Graph
“哪些声明得到了什么证据支持”
       │ governed_by
       ▼
Review Policy
“谁应该审、审多深、缺什么不能合并”
```

现有能力分布在不同产品类别中：

```text
需求与行为      OpenSpec · Doorstop · Gherkin
语义变化        GumTree · Difftastic
代码事实        SCIP · Kythe
可视化审查      CodeSee Review Maps · CodeRabbit Change Stack
AI PR Review    Copilot Code Review · CodeRabbit · Greptile
影响与风险      CodeQL · SARIF · CodeScene
运行时证据      OpenTelemetry
审查策略        Danger · OPA · CODEOWNERS
增量审查        Gerrit Patch Sets
```

因此，ChangeGraph 的机会不是重新发明所有底层分析能力，而是把成熟零件组织成一种面向人的**变更保证系统**。图是内部连接结构，人的主要操作对象应当是声明、路径、证据、风险和待确认问题。

## 直接竞品：它们如何定义 Review 的基本单位

### GitHub Copilot Code Review：原生工作流中的 AI 评论者

[GitHub Copilot Code Review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review) 可以在 Pull Request 或 IDE 中生成审查评论和可应用的修改建议，支持仓库级、路径级自定义指令，并能使用仓库配置的 Agent Skills 与 MCP 上下文。它始终提交 `Comment`，不会作为批准票或阻断合并。

它的主要优势是原生集成和低使用门槛，基本单位仍然是代码位置上的审查评论：

```text
Pull Request
    └─ File
        └─ Line Range
            └─ AI Comment / Suggested Change
```

这适合自动发现局部问题，但没有把“需求声明—实现路径—验证证据”变成人可检查的一等对象。即使评论引用了更多上下文，审查者仍然需要自行判断它是否覆盖了需求，以及未评论区域是否安全。

### CodeRabbit：从行评论走向分层变更导览

[CodeRabbit](https://docs.coderabbit.ai/guides/code-review-overview) 将多模型、静态分析、代码图、严重程度、增量 Review 和交互式修复结合起来。其代码图用于补充跨文件定义与依赖上下文，后续提交可以只审查新增变化。

2026 年推出的 [Change Stack](https://docs.coderabbit.ai/changelog) 更接近 ChangeGraph 的人类体验：它不再按文件名字母顺序展示大型 PR，而是把变更组织成有顺序的层和批次，在具体代码区间上提供摘要，并在合适的位置生成时序图或数据关系图。

可以借鉴的关键点是：

- 大型变更需要一条经过组织的阅读路线；
- 图只在能解释调用流或数据模型时出现；
- Review 结果需要严重程度和后续增量更新；
- 评论、批准和 Git 平台原生工作流不能被独立工具割裂。

它也是目前最接近 ChangeGraph 交互方向的产品。不过其核心仍是 AI 生成的审查发现和分层导览，而不是显式维护 Intent、Change 与 Evidence 的对应关系。Agent 对代码的理解、问题判断和修复建议仍可能来自同一个认知系统。

### Greptile：用完整仓库图增强 AI Reviewer

[Greptile](https://www.greptile.com/docs/introduction) 为仓库建立函数、类和依赖关系图，用完整代码库上下文审查每个 Pull Request，再将发现作为评论和修复建议返回。它还根据团队对评论的反馈逐渐抑制不受欢迎的建议。

它代表了典型的“面向 AI 的 CodeGraph”路线：

```text
Repository Graph
      │ context retrieval
      ▼
AI Reviewer
      │
      ▼
PR Comments
```

这种路线可以改善 AI 获取跨文件上下文的效率，但图主要存在于 AI 内部。人最终看到的仍然是 AI 对问题的结论，而不是可独立检查的事实关系、证据来源和置信度。因此它更像自动 Reviewer，而不是帮助人建立变更心智模型的 Review Workbench。

### CodeSee Review Maps：最直接的人类变更地图

[CodeSee Review Maps](https://docs.codesee.io/docs/user-guide) 会为 Pull Request 自动生成交互式地图：新增、删除、修改文件使用不同颜色，文件之间显示依赖关系，并补充可能受影响但没有直接修改的文件。新的提交加入后，地图会自动更新。作者还可以使用 Tour 带领审查者按逻辑顺序理解变更。

它证明了两个重要需求是真实存在的：

1. Review 不应只能按文件顺序进行；
2. 修改文件之外的受影响区域也应该进入视野。

它与 ChangeGraph 的差别在于，基本单位主要还是文件和文件依赖：

```text
Changed File
    │ dependency
    ▼
Possibly Affected File
```

面对状态转换、业务不变量、幂等性、数据流和证据缺口，仅有文件依赖仍然太粗。ChangeGraph 需要继续下沉到行为声明、符号变化和关键路径。

### CodeScene：把历史行为变成审查风险

[CodeScene](https://codescene.com/use-cases/refactoring-targets) 将修改频率与代码健康度组合成 Hotspot，并通过 change coupling 发现经常共同变化的模块。它还能把团队所有权和架构边界纳入分析。

这补足了静态依赖图缺少的时间维度：两个模块即使没有显式调用关系，只要长期在相同变更中共同出现，也可能存在隐性业务耦合或组织协作成本。

CodeScene 的重点是代码库健康和风险优先级，不是 Intent 与 Evidence 的闭环，但它提供了 ChangeGraph 风险评分中非常重要的一类信号：

```text
变更风险
  = 本次语义变化
  × 历史修改频率
  × 历史共同变化
  × 代码复杂度
  × 团队边界
```

历史耦合只能提示风险，不能被标注为确定的运行时依赖。

## 产品能力对照

下表描述的是各产品公开资料中的主要产品重心，不代表对分析准确率的实测排名：

| 产品 | 主要审查单位 | 人类变更地图 | 跨文件上下文 | Intent 对齐 | Evidence 对齐 | 增量复审 | 风险策略 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GitHub Copilot Code Review | 行评论、修改建议 | 非核心 | 部分支持 | 自定义指令和外部上下文 | 非核心 | 可重新审查 | 路径级指令 |
| CodeRabbit | 问题、严重程度、分层 Change Stack | 较强 | 代码图与静态分析 | 部分支持 | 工具发现可以成为证据输入，但未形成证据图 | 支持增量 Review | 较强 |
| Greptile | AI 审查评论 | 图主要面向 AI | 较强 | 规则和仓库上下文 | 非核心 | 持续 Review | 反馈学习和规则 |
| CodeSee Review Maps | 文件、文件依赖、Tour | 强 | 文件依赖 | PR 描述和人工 Tour | 非核心 | 地图随提交更新 | 自动化规则 |
| CodeScene | Hotspot、历史耦合、团队边界 | 强 | 结构与历史关系 | 非核心 | 历史数据属于风险信号 | 持续分析 | 强 |
| ChangeGraph 设想 | 声明、语义路径、证据缺口 | 按问题生成路径 | 精确关系与低置信度关系并存 | 一等对象 | 一等对象 | 局部失效 | 风险自适应 |

这个对照揭示了一个关键差异：现有 AI Reviewer 主要在提升“机器发现问题”的能力，CodeSee 和 CodeScene 主要在提升“人看见结构或风险”的能力；ChangeGraph 可以进一步把人的审查对象从代码行提升为可追踪的声明与证据。

## 最值得复用的社区基础设施

### GumTree 与 Difftastic：从文本 Diff 升级为语义变化

[Difftastic](https://difftastic.wilfred.me.uk/introduction) 通过语法结构区分真正的表达式变化和缩进、换行等格式变化；[GumTree](https://github.com/GumTreeDiff/gumtree) 提供 AST 级的增删改移操作。

ChangeGraph 不应该直接把每段文本 Diff 变成节点，而应先产生符号级变化：

```text
OrderService.cancel
    ├─ ADD_CALL    → InventoryService.release
    ├─ REMOVE_CALL → PaymentService.refund
    └─ UPDATE_GUARD → order.status == PAID
```

格式化、变量重命名和语句移动可以保留为低层信息，但默认不占用人的注意力。

### SCIP 与 Kythe：稳定符号身份、源码锚点和关系来源

Sourcegraph 的 [SCIP](https://sourcegraph.com/docs/code-navigation/writing-an-indexer) 使用语言无关的索引记录符号、定义、引用、源码范围和诊断；[Kythe](https://kythe.io/docs/schema-overview.html) 提供跨语言代码事实与关系图模式。

ChangeGraph 可以复用三个原则：

- 每个代码实体必须有跨文件、跨版本尽可能稳定的身份；
- 每个节点和关系必须能够下钻到具体源码位置；
- 每个关系都要记录来源、版本和置信度。

```yaml
relation:
  type: may_call
  source: heuristic_analysis
  confidence: low
  revision: a83fd19
  reason: runtime_dependency_injection
```

高度动态的依赖注入、反射和配置路由不应伪装成确定事实。精确编译器索引、启发式静态推导、Agent 推测和运行时观察必须使用不同的事实类型。

### CodeQL 与 SARIF：显示证据路径，而不是裸露告警

[CodeQL Path Query](https://codeql.github.com/docs/writing-codeql-queries/creating-path-queries/) 使用 source、sink 和中间路径解释问题如何传播。[SARIF 2.1](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html) 则为静态分析结果、代码流、位置和跨版本结果指纹提供标准交换格式。

这提示 ChangeGraph：风险节点必须携带可检查路径。

```text
风险：重复任务可能重复释放库存

TimeoutJob.execute
        │ second execution
        ▼
OrderService.cancel
        │ missing terminal-state guard
        ▼
InventoryService.release
```

“这里可能有幂等问题”只是声明；规则、源码锚点、传播路径和测试结果才构成可审查证据。

### Gerrit Patch Sets：局部失效的增量审查模型

[Gerrit Patch Sets](https://gerrit-review.googlesource.com/Documentation/concept-patch-sets.html) 为同一个 Change 保存多个修订版本；[Review UI](https://gerrit-review.googlesource.com/Documentation/user-review-ui.html) 允许返回的审查者比较新旧 Patch Set，并识别只由 rebase 引入的差异。

ChangeGraph 不应在 Agent 每次修改后让人从头审查，而应保存：

```text
ChangeGraph v1
      │ Agent 继续修改
      ▼
ChangeGraph v2
      ├─ 新增或删除的节点
      ├─ 发生变化的关系
      ├─ 因变化而失效的证据
      └─ 仍然有效的人工确认
```

如果后续只修改日志，业务链路的审查状态可以保留；如果修改了状态守卫，与幂等性相关的声明、证据和人工批准应该重新打开。这可以概括为：

> Review 状态必须局部失效，而不是全量失效。

### Doorstop、OpenSpec 与 Gherkin：把 Intent 拆成可链接的小项

[Doorstop](https://github.com/doorstop-dev/doorstop) 把需求、测试等保存为版本库内可链接的独立项目，并校验追踪关系。[OpenSpec](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md) 使用 proposal、spec delta、design 和 tasks 表达一次变化。[Gherkin](https://cucumber.io/docs/gherkin/reference/) 使用 Feature、Scenario、Given、When、Then 描述可执行行为。

ChangeGraph 应借鉴可追踪性，但不应要求团队维护另一套与代码同等复杂的完整真相。Intent 的基本单位应是小而稳定的行为声明：

```text
INT-001  支付后超时的订单应自动关闭
INT-002  关闭订单时必须释放库存
INT-003  重复执行不得重复释放库存
INT-004  人工取消订单的原有行为不得改变
```

这些声明可以来自 Spec、Issue、验收标准、对话或人工补录。格式不是核心，能够与实现和证据建立关系才是核心。

### OpenTelemetry：把运行路径作为有边界的观测证据

[OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/traces/) 用 Span 和父子关系表示一次请求的运行轨迹，并通过上下文传播跨服务关联信号。

运行时 Trace 适合进入 Evidence Graph，但必须保留环境、版本、时间和样本量：

```yaml
evidence:
  type: runtime_trace
  environment: staging
  revision: a83fd19
  sample_count: 12
  supports:
    - INT-001
  does_not_prove:
    - all_failure_paths
    - concurrency_safety
```

静态分析表示“可能发生”，Trace 表示“某次确实发生”，测试断言表示“某个结果被明确校验”。三者不能互相冒充。

### Danger、OPA 与 CODEOWNERS：把审查深度变成仓库策略

[Danger](https://danger.systems/js/) 用仓库内规则自动执行 Review 惯例；[OPA](https://www.openpolicyagent.org/docs/cicd) 可以对结构化输入执行策略决策；[CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) 提供路径级审查所有权。

ChangeGraph 可以输出统一的结构化变化事实，再由仓库配置决定谁来审、审多深、缺少什么证据不能接受：

```yaml
rules:
  - match:
      paths:
        - src/payment/**
        - src/auth/**
    review_level: deep
    require:
      - independent_verifier
      - runtime_evidence
      - rollback_plan

  - match:
      paths:
        - docs/**
    review_level: quick
```

审查策略应与图生成引擎解耦，避免把不同团队的风险偏好硬编码到底层分析中。

## 理想产品应该如何重新组合这些能力

### 1. 图是内部模型，声明卡片是默认界面

首页不应该首先展示包含数百节点的代码库全景图，而应该展示：

```text
声明 1：新增订单超时关闭能力
状态：实现完成，证据充分

声明 2：重复执行不会重复释放库存
状态：实现完成，但缺少并发场景证据

声明 3：人工取消行为不变
状态：存在未解释的实现变化
```

用户点击声明后，系统再生成最小相关路径；继续点击节点，才展开源码、静态分析来源、运行 Trace、测试和 Agent 解释。

### 2. 明确区分六种信息类型

```text
declared   人或 Agent 声明
derived    编译器或静态分析推导
observed   运行时实际观察
asserted   测试明确断言
approved   人工确认
heuristic  启发式推测
```

Agent 的推理过程只能作为解释和溯源，不能直接升级为实现正确的证据。

### 3. 优先显示三种不一致

```text
有 Intent，没有实现
    → 需求遗漏

有实现，没有 Intent
    → 范围越界或未声明变化

有实现，没有 Evidence
    → 正确性仍未得到支持
```

这三类差集比完整依赖图更适合作为 Review 首页。

### 4. 风险决定审查深度

```text
Review Risk
  = 业务敏感度
  × 影响范围
  × 历史热点与共同变化
  × 关系不确定性
  × 证据缺口
  × 回滚难度
```

低风险、易回滚且证据充分的变化可以只做黑盒验收；风险升高时进入 ChangeGraph 路径审查；核心链路、证据不足或关系不确定时，再深入源码。

### 5. Builder 与 Verifier 必须保留认知独立性

如果同一个 Agent 同时实现代码、编写测试、解释测试为什么充分并决定合并，它提供的是一组相互支持的声明，而不是独立证据。

ChangeGraph 应记录每份产物的生产者与验证者，使系统能够要求：

```text
Builder Agent
    │ produces
    ▼
Implementation
    │ checked by
    ▼
Independent Verifier / Human / External Tool
```

独立性可以来自不同 Agent、不同上下文、确定性分析器、运行环境或人工审查，而不只是更换模型名称。

## MVP 的现实边界

第一版不需要建立完整且永久同步的全仓库 CodeGraph。更可行的范围是：

1. 从 Git Diff 提取符号级语义变化；
2. 接收少量行为声明或从 Issue、PR 描述中提议声明；
3. 为每个声明生成与本次变化相关的最小影响路径；
4. 关联已有测试、静态分析结果和可选运行 Trace；
5. 根据仓库规则、历史热点和证据缺口推荐 Review 深度；
6. 保存每个声明、路径和证据的审查状态；
7. Agent 后续修改后，只让受影响的结论局部失效；
8. 所有节点都能下钻到源码，但默认不要求读源码。

第一版可以暂缓：

- 试图精确恢复所有动态调用；
- 默认渲染完整代码库全景图；
- 长期保存 Agent 的完整推理文本；
- 自动生成与实现同等详细的巨型 Spec；
- 用覆盖率百分比代替声明级证据；
- 声称某一种静态或运行数据可以证明全部正确性。

## 示例：一个面向人的 Review 包

```text
┌──────────────────────────────────────────────┐
│ 声明：重复执行不会重复释放库存                │
│ 风险：高                                      │
│ 状态：证据不足                                │
├──────────────────────────────────────────────┤
│ Intent                                       │
│   “关闭操作必须幂等”                          │
│                    │                         │
│                    ▼                         │
│ Change                                       │
│   TimeoutJob → cancel → releaseInventory     │
│                    │                         │
│                    ▼                         │
│ Evidence                                     │
│   ✓ 单次执行测试                              │
│   ✓ 顺序重复执行测试                          │
│   ✗ 并发重复执行测试                          │
│   ? 运行 Trace 仅覆盖正常路径                 │
├──────────────────────────────────────────────┤
│ [展开路径] [查看源码] [询问节点] [要求补证据] │
└──────────────────────────────────────────────┘
```

这不是一张为了展示技术能力而存在的图，而是一份帮助人决定“是否接受这次变化、还需要看多深”的保证材料。

## 结论

社区已经分别解决了结构化 Diff、稳定符号索引、代码地图、AI 评论、路径解释、历史风险、运行追踪、策略配置和增量审查，但它们大多服务于以下某一个目标：

- 给 AI 更多上下文；
- 自动发现更多问题；
- 让人看到代码结构；
- 管理代码质量与审查流程。

ChangeGraph 的差异化不应只是“把代码关系画出来”，而是把这些能力提升为一套面向人的变更保证协议：

> Intent first. Evidence throughout. Reconciliation before acceptance.

它最终需要回答的不是“代码之间有什么关系”，而是：

> 这次变化是否符合意图，风险在哪里，证据是否充分，我还需要看多深？

## 延伸阅读

- [AI 代码知识图谱的价值边界：从 Agent 加速层到人类代码地图](./ai-code-knowledge-graph-and-human-first-code-map.md)
- [Agent 代码审查的哲学：从黑盒验证到渐进式保证](./agent-code-review-progressive-assurance.md)
- [Spec、ChangeGraph 与 EvidenceGraph：Agent 开发的意图—实现—证据闭环](./spec-changegraph-evidence-reconciliation.md)

## 公开参考

- [GitHub Copilot Code Review](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/request-a-code-review/use-code-review)
- [CodeRabbit Code Review Overview](https://docs.coderabbit.ai/guides/code-review-overview)
- [CodeRabbit Changelog：Change Stack 与 Code Graph Analysis](https://docs.coderabbit.ai/changelog)
- [Greptile Overview](https://www.greptile.com/docs/introduction)
- [CodeSee Review Maps](https://docs.codesee.io/docs/user-guide)
- [CodeScene Hotspots and Change Coupling](https://codescene.com/use-cases/refactoring-targets)
- [Difftastic Manual](https://difftastic.wilfred.me.uk/introduction)
- [GumTree](https://github.com/GumTreeDiff/gumtree)
- [SCIP Indexer Documentation](https://sourcegraph.com/docs/code-navigation/writing-an-indexer)
- [Kythe Schema Overview](https://kythe.io/docs/schema-overview.html)
- [CodeQL Path Queries](https://codeql.github.com/docs/writing-codeql-queries/creating-path-queries/)
- [SARIF 2.1](https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html)
- [Gerrit Patch Sets](https://gerrit-review.googlesource.com/Documentation/concept-patch-sets.html)
- [Gerrit Review UI](https://gerrit-review.googlesource.com/Documentation/user-review-ui.html)
- [Doorstop](https://github.com/doorstop-dev/doorstop)
- [OpenSpec Concepts](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md)
- [Gherkin Reference](https://cucumber.io/docs/gherkin/reference/)
- [OpenTelemetry Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [Danger](https://danger.systems/js/)
- [OPA for CI/CD](https://www.openpolicyagent.org/docs/cicd)
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
