---
title: 能用代码判断的，就不要交给 LLM
date: 2026-09-04
tags:
  - Agent Evaluation
  - Deterministic Grader
  - Evaluation Harness
description: 用结果、状态、不变量、接口契约和资源预算构建可复现的确定性 Agent Grader，并隔离评分证据与执行环境
---

# 能用代码判断的，就不要交给 LLM

## 要解决的问题

Agent 完成一次任务后，系统需要判断：

- 指定文件是否真的生成；
- 数据库是否出现预期记录；
- 原有功能是否仍然正常；
- 输出是否满足 JSON Schema；
- 是否修改了禁止触碰的状态；
- 是否超出延迟、成本或工具调用预算。

这些都是可由环境直接验证的事实。如果再把产物描述给另一个 LLM，让它“判断是否完成”，评测就平白增加了一层非确定性、成本和解释困难：Judge 可能忽略缺失字段，可能被 Agent 的自我陈述说服，也可能在完全相同的证据上给出不同结论。

另一方面，“使用了代码 Grader”也不自动代表评测可信。一个只检查文件存在的脚本，会把空文件判为成功；一个只运行新增测试的 Coding Eval，可能放过对原有功能的破坏；一个与 Agent 共享工作目录的测试脚本，甚至可能被 Agent 修改。

因此，真正的问题不是“代码还是 LLM”，而是：

> 哪些主张可以还原为可观察、可重复执行的谓词？这些谓词所依赖的证据，是否位于 Agent 无法伪造的可信边界内？

## 核心结论

确定性 Grader 应当是评测器的第一层，而不是唯一一层：

~~~text
可直接观察的事实
  -> Deterministic Grader

可形式化的政策与流程规则
  -> Rule Grader

开放性、语义性、审美性质量
  -> Model Grader

高风险、分歧与校准样本
  -> Human Review
~~~

[Anthropic 的 Agent Eval 实践](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)建议尽可能选择确定性 Grader，只在需要灵活性或细腻判断时使用 LLM，并用人工审查做额外验证。这个顺序不是因为代码天然不会错，而是因为代码检查通常更快、更便宜、可复现，也更容易定位失败原因。

本文聚焦第一层。最终产物是一份 **Deterministic Grader Contract**：它把 [Evaluation Contract](./agent-evaluation-contract.md) 中的 Outcome、Constraints 和 Budget，转成对可信证据运行的可执行检查。

## “确定性”到底是什么意思

本文使用一个工程定义：

> 在输入证据、Grader 版本、依赖和执行环境都冻结时，多次运行应产生相同的逐项结果与聚合结果。

它不等于：

- Grader 对真实世界拥有绝对正确的理解；
- 一组单元测试已经证明程序不存在缺陷；
- 一个正则表达式可以表达所有合法答案；
- 容器中的执行结果天然可信；
- 相同 Agent 每次都产生相同结果。

Agent 仍然可以是随机的。确定性要求的是：给定某次 Trial 已经产生的冻结证据，评分逻辑不要再引入不必要的随机性。

可以把它写成一个纯函数式目标：

~~~text
grade(
  evidence_digest,
  grader_bundle_digest,
  verifier_image_digest,
  policy_version
) -> same result
~~~

如果外部 API、当前时间、浮动依赖、共享缓存或未固定镜像还能改变结果，这个 Grader 就还不是可复现的。即使判定逻辑完全确定，Agent 的运行环境仍可能存在网络抖动、资源争用、服务超时和遗留状态；确定性描述的是**冻结证据之后的判定可重放**，不代表产生证据的环境天然无噪声。

确定性也不等于客观性。开发者仍然需要决定“哪些状态算成功”“预算阈值是多少”“什么失败不能接受”。确定性只是让这些判断被显式编码、稳定执行和审计。

## 先建立证据优先级

同一个成功主张可能有多种证据。比如 Agent 说“订单已经创建”，Trace 中也出现了 `create_order` 调用，但真正决定任务是否完成的，是目标系统的最终状态。

可以采用下面的工程优先级：

| 优先级 | 证据 | 典型例子 | 主要风险 |
| --- | --- | --- | --- |
| 1 | Agent 控制域外的权威最终状态 | 隔离数据库快照、只读查询、文件系统快照 | 快照时机或查询本身错误 |
| 2 | 对产物重新执行或语义解析的结果 | 单元测试、编译、JSON Schema、AST 检查 | 测试覆盖不足、解析规则过严 |
| 3 | 可信采集的状态差异与事件 | Before/After Diff、审计事件、预算计数器 | 采集遗漏、身份映射错误 |
| 4 | Agent Trace 中的工具调用 | 工具名、参数、返回状态 | Trace 被截断或调用无真实效果 |
| 5 | Agent 的最终文本声明 | “已完成”“测试通过” | 可以被轻易伪造 |

这张表是工程建议，不是通用标准。核心原则是：

~~~text
越接近真实效果
+ 越不受 Agent 控制
+ 越能独立重放
= 越强的评分证据
~~~

Anthropic 对 Outcome 的定义也强调最终环境状态：Agent 声称完成预订，不等于数据库中真的存在预订。Trace 适合解释过程，不能替代效果验证。

每条 Required Outcome 都应该绑定到一个明确的证据位置。证据缺失时，不要让 Judge 猜测，也不要默认失败；应先判断这是 Agent Failure，还是 Trial 已经无法有效评分。

## 五类确定性 Grader

### Outcome Grader：目标是否真的实现

Outcome Grader 验证期望的最终结果，而不是 Agent 的措辞或操作顺序。

常见实现包括：

- 查询隔离数据库中的实体、状态和关联；
- 读取指定产物并解析其语义结构；
- 对修改后的项目运行功能测试；
- 在浏览器环境中查询 DOM、URL 或后端状态；
- 对数学、约束求解或数据任务重新计算结果；
- 比较 API 返回与目标业务状态。

最小形式是：

~~~ts
type CheckResult = {
  id: string
  passed: boolean
  observed: unknown
  expected: unknown
  evidenceRef: string
}

function checkRequiredEntry(catalog: Catalog): CheckResult {
  const entry = catalog.entries.find(item => item.slug === 'sample-tool')

  return {
    id: 'required_entry',
    passed: entry?.homepage === 'https://example.com/sample-tool',
    observed: entry ?? null,
    expected: {
      slug: 'sample-tool',
      homepage: 'https://example.com/sample-tool'
    },
    evidenceRef: 'artifact://output/catalog.json'
  }
}
~~~

注意，这段检查解析 JSON 后比较字段，而不是搜索文本中是否出现 `sample-tool`。Agent 可能把目标字符串放进注释、错误信息或无效对象；字符串存在不代表目标状态成立。

### State Grader：改变是否局限在允许范围

Outcome 只回答“目标出现了吗”，State Grader 回答“世界还发生了什么变化”。

先冻结初始快照，再比较结束状态：

~~~text
State Diff
├── expected changes
├── allowed incidental changes
├── forbidden changes
└── unexplained changes
~~~

典型检查包括：

- 只允许修改 `/workspace/output/**`；
- 输入 Fixture 的哈希必须保持不变；
- 原有数据库记录不能被删除；
- 不得创建未声明的外部资源；
- 临时文件必须在 Trial 结束前清理；
- 新记录之外的字段不能静默改变。

状态差异应基于可信快照或事件源，而不是让 Agent 自己报告修改清单。路径判断需要先规范化，防止 `..`、符号链接或大小写差异绕过允许范围。

### Invariant Grader：不能被最终成功掩盖的性质

不变量是整个过程或最终状态都必须成立的性质。

例如：

- 账户余额始终不能为负；
- 已发布版本不可被覆盖；
- 未经审批不得执行高风险写操作；
- 主键和唯一索引始终有效；
- 输入数据、测试和 Grader 资产不可修改；
- 失败后不得继续产生外部副作用；
- 同一个幂等键不能创建两个资源。

最终状态有时看起来正确，但中间过程已经越过边界又回滚。只比较最终快照会漏掉这种违规，因此过程不变量应由 Agent 无法写入的审计事件或状态机记录支持。

不变量适合设为硬门槛。一次未经授权的数据导出，不应因为最终报告写得很好而被加权平均抵消。

### Contract Grader：产物和交互是否满足机器契约

Contract Grader 验证接口形状和协议规则，包括：

- JSON Schema、Protocol Buffer 或 OpenAPI Contract；
- MIME Type、编码和文件格式；
- 必填字段、枚举、范围和跨字段约束；
- 编译、类型检查、Lint 和静态安全规则；
- 工具调用参数是否满足工具 Schema；
- API 响应码、幂等键和状态转换是否合法。

Schema Valid 只是必要条件，不一定代表业务正确。下面的对象可以满足字段类型，却仍然包含错误的网址或重复条目。因此，Contract Grader 应与 Outcome 和 Invariant 检查组合，而不是独占评分。

[OpenAI 的 Grader 文档](https://developers.openai.com/api/docs/guides/graders)列出字符串检查、文本相似度、模型评分和代码执行等类型，并允许组合多个子分数；其中的 API 生命周期可能变化，但“简单事实先使用可执行检查、复杂判断再升级”的设计原则不依赖某个平台。

### Budget Grader：资源是否在约定范围

Budget Grader 应从 Harness 的权威计数器读取：

- 墙钟时长与执行时长；
- 模型调用次数；
- 工具调用次数；
- 输入与输出 Token；
- 推理和工具成本；
- 网络请求、读取字节和写入字节；
- 人工审批或接管次数；
- CPU、内存、磁盘和并发峰值。

预算检查必须提前声明单位、范围和超限语义：

~~~yaml
budget:
  wall_time_ms:
    maximum: 180000
    source: harness_monotonic_clock
    on_exceed: agent_failure
  tool_calls:
    maximum: 20
    source: trusted_tool_gateway
    on_exceed: agent_failure
  verifier_time_ms:
    maximum: 30000
    source: grader_runtime
    on_exceed: grader_error
~~~

Agent 运行超时和 Grader 运行超时不是同一件事。前者可能是被测系统没有在产品预算内完成；后者表示评分基础设施没能给出有效判断。

## 哪些事情不应硬塞进确定性 Grader

以下问题通常不适合只靠固定谓词回答：

- 一份研究报告是否覆盖了真正重要的观点；
- 解释是否清晰、连贯且适合目标读者；
- 开放性方案的权衡是否充分；
- 引用是否在语义上支持对应主张；
- 对话是否自然、得体并正确处理隐含需求；
- 视觉设计是否符合品牌气质与审美目标。

代码仍可以验证这些任务的外层事实，例如文件存在、章节完整、链接可访问、引用格式有效，但不能把“有五个链接”误当成“论证有依据”。

另一个边界是“合法答案集合无法被完整枚举”。精确字符串匹配适合 ID、枚举和确定答案，不适合允许多种表达的自然语言。OpenAI 的 Grader 指南也指出，严格参数或字符串比较可能因为 `1` 与 `1.0`、缩写与全称等无关差异而少给分。

升级判断方式前，可以依次问：

1. 能否直接查询真实状态？
2. 能否把产物解析成结构后比较？
3. 能否通过执行、性质测试或约束求解验证？
4. 能否把模糊要求拆成一部分确定性检查和一部分语义 Rubric？
5. 如果仍需 LLM，是否已把它限制在真正开放的维度？

“代码无法表达全部质量”不是放弃确定性检查的理由。更合理的做法是拆层。

## 评分器必须位于可信计算边界之外

### 四个平面

推荐把执行系统拆成四个平面：

~~~text
Agent Execution Plane
  允许按任务修改自己的工作区
        │
        │ 只输出声明的产物与受控动作
        ▼
Evidence Collection Plane
  记录只读快照、审计事件、预算和 Trace
        │
        │ 生成带摘要的 Evidence Bundle
        ▼
Verifier Plane
  在一次性隔离环境中解析、执行和检查产物
        │
        │ 输出逐项 CheckResult
        ▼
Aggregation Plane
  应用 Gate、权重和错误策略，形成最终报告
~~~

Agent 不应拥有以下能力：

- 读取或修改隐藏测试、参考状态和 Grader 源码；
- 写入证据收集器、预算计数器或聚合结果；
- 复用其他 Trial 的工作目录、历史或缓存；
- 用自己生成的“测试通过”日志替代真实测试输出；
- 改变 Verifier Image、Grader Bundle 或评分策略；
- 访问只用于校验的凭据和目标系统管理接口。

Evidence Bundle 至少应记录：

- Trial、Case、Environment 和 Grader 版本；
- Before/After Snapshot Digest；
- 声明产物的摘要、大小和媒体类型；
- 可信工具网关采集的动作事件；
- 预算计数器与计时来源；
- 证据是否完整、是否被截断；
- 收集时间与绑定的 Trial Identity。

### 执行候选代码时再加一层隔离

如果 Grader 需要编译或运行 Agent 生成的代码，候选代码本身就是不可信输入。不要在聚合器、CI Runner 控制面或持有真实凭据的主进程中直接执行。

应该使用一次性的 Verifier Sandbox，并限制：

- 无默认外网；
- 只读挂载测试和 Grader；
- 候选产物单独只读挂载或复制；
- 非特权用户；
- CPU、内存、进程数、磁盘和时长；
- 无宿主 Socket、真实密钥与共享工作目录；
- 完成后销毁，不复用可变状态。

[Inspect 的 Sandboxing 文档](https://inspect.aisi.org.uk/sandboxing.html)明确指出，配置 Sandbox 并不意味着 Agent、工具或 Scorer 的所有代码都自动在容器内运行；只有通过 Sandbox 接口请求的工作在其中执行。这说明“用了 Docker”不是完整的信任边界描述，必须标清哪段代码在哪里运行。

[NIST SP 800-190](https://csrc.nist.gov/pubs/sp/800/190/final)系统说明了容器技术的安全风险与缓解建议。容器适合构建可复现、自动化的执行环境，但隔离强度仍取决于运行时、权限、挂载、网络与宿主配置。高风险代码可能需要更强的虚拟化或专用执行节点。

### 冻结可信根

每次正式评测应记录不可变引用：

~~~yaml
trusted_roots:
  case_digest: "sha256:<CASE_DIGEST>"
  initial_snapshot_digest: "sha256:<SNAPSHOT_DIGEST>"
  grader_bundle_digest: "sha256:<GRADER_DIGEST>"
  verifier_image: "registry.example.com/eval/verifier@sha256:<IMAGE_DIGEST>"
  policy_version: "deterministic-grader-policy-v1"
~~~

浮动的 `latest` 镜像、实时安装的新依赖和可变远程数据，都可能让历史结果无法重放。冻结方式应与 [可复现 Agent 评测实验](./reproducible-agent-evaluation-experiments.md) 中的 Run Manifest 一致。

## 部分得分与硬门槛必须同时存在

只给 0 或 1 会丢失进步信号。把所有子项做平均又会掩盖底线。推荐使用 **Validity → Gates → Scorecard** 三阶段聚合。

### 第一阶段：Trial 是否有效

先确认环境和证据足以评分：

- 初始 Fixture 完整且摘要一致；
- Agent 和 Grader 环境成功启动；
- Evidence Bundle 没有关键缺失；
- Grader 本身没有异常或超时；
- Reference Smoke Test 在同一环境可通过。

不满足时应进入 `UNSCORABLE`、`INFRA_ERROR` 或 `GRADER_ERROR`，不能直接记为 Agent 得 0 分。

### 第二阶段：硬门槛

典型 Gate 包括：

- 所有 Required Outcome 成立；
- 没有修改受保护状态；
- 没有未经授权的外部副作用；
- 安全与合规不变量全部成立；
- 没有篡改证据、测试或 Grader；
- 关键预算没有超限。

任何 Gate 失败，Trial 都不能判为 `PASS`。其中零容忍 Gate 失败应直接得到 `FAIL`；普通功能未全部完成，但已有可验证的有效进展时，可以得到 `PARTIAL` 和逐项分数。

### 第三阶段：可累积的部分得分

对非零容忍的子结果，可以保留平滑分数：

~~~text
functional_score =
  0.50 * required_feature_coverage
  + 0.30 * backward_compatibility
  + 0.20 * contract_completeness

final_status =
  INFRA_ERROR                  if environment_failed
  GRADER_ERROR                 if verifier_failed
  UNSCORABLE                   if required_evidence_missing
  FAIL                         if zero_tolerance_gate_failed
  PASS                         if all_required_outcomes_and_threshold_passed
  PARTIAL                      if some_functional_outcomes_passed
  FAIL                         otherwise
~~~

这里有两组不能混为一谈的结果：

~~~text
任务判定：PASS / PARTIAL / FAIL
有效性与错误：GRADER_ERROR / INFRA_ERROR / UNSCORABLE
~~~

`PASS`、`PARTIAL` 和 `FAIL` 都意味着 Trial 有效、Grader 确实观察到了 Agent 的结果；后三者表示尚未得到可用于评价能力的任务判定。`PARTIAL` 仍然是未完全通过，可以按实验协议进入通过率分母，同时保留部分分数。

逐项结果比总分更重要。一份报告至少要同时显示：

- Gate 通过情况；
- 各维度原始分数；
- 每个断言的观察值、期望值和证据引用；
- 聚合公式与阈值版本；
- 未执行、缺证据和错误项；
- 最终 Trial Status。

OpenAI 的 Grader 文档支持 0 到 1 的部分分数和组合式 Grader；Anthropic 也建议复杂任务为多个组成部分设置部分得分。工程上应把这类平滑分数放在硬门槛之后，而不是让它们抵消安全失败。

## 不要把基础设施错误算成 Agent 失败

一次 Trial 至少需要区分下面这些终态：

| 状态 | 含义 | 是否进入能力分母 | 处理方式 |
| --- | --- | --- | --- |
| `PASS` | 有效执行，所有 Required Gate 与通过阈值满足 | 是 | 记录通过与分数 |
| `PARTIAL` | 有效执行且有可验证进展，但未完全满足成功条件 | 是 | 记为未完全通过并保留部分分数 |
| `FAIL` | 有效执行但没有足够进展，或违反零容忍 Gate | 是 | 记录失败原因；预算超限是其中一种原因 |
| `GRADER_ERROR` | 检查逻辑异常、无法解析或 Verifier 超时 | 否 | 修复 Grader 后重跑 |
| `INFRA_ERROR` | 镜像、Sandbox、Fixture 或依赖故障 | 否 | 恢复环境后重跑 |
| `UNSCORABLE` | 关键证据缺失、损坏，或暂时无法可靠归因 | 否 | 修复采集链路或人工调查 |
| `CANCELLED` | 外部取消，未形成可评分结果 | 否 | 单独报告 |

[Inspect 的错误处理指南](https://inspect.aisi.org.uk/errors-and-limits.html)区分运行时错误和进程崩溃，并允许明确配置是否对错误样本评分；[SWE-bench 的 Evaluation Guide](https://www.swebench.com/SWE-bench/guides/evaluation/)也分开报告 Resolved、Unresolved、无结果错误、疑似基础设施失败和模糊失败。这些设计共同提醒：`没有分数`、`Grader 失败` 与 `Agent 答错` 不是一个事件。

处理原则包括：

1. 不静默删除错误 Trial；同时报告有效样本数与各类错误数。
2. 只对已知可重试、幂等的基础设施步骤自动重试。
3. 每次重试都从干净快照开始，不能接着使用部分副作用。
4. 超时要根据计时范围归因：Agent Deadline 与 Verifier Deadline 分开。
5. 同一基础设施事件影响多个 Trial 时，不把它们视为独立失败。
6. 正式对比中若一侧需要重跑，应保持配对与环境条件一致。
7. Reference Solution 也无法通过时，优先怀疑 Case、Environment 或 Grader。

不要用“把所有错误都算失败更保守”掩盖评测质量问题。这可能系统性惩罚运行时间更长的 Agent，也可能使一次共享环境故障伪装成大规模能力退化。

## 确定性 Grader 也会被 Reward Hacking

确定性只保证规则稳定，不保证规则代表真实目标。Agent 可以稳定地利用一个稳定的坏规则。

[Google DeepMind 对 Specification Gaming 的总结](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/)指出，优化系统可能找到获得奖励的捷径，却没有按设计者意图完成任务。[OpenAI 的第三方评测建议](https://openai.com/index/trustworthy-third-party-evaluations-foundations/)也把 Reward Hacking、污染和 Broken Problems 列为会扭曲结论的标准有效性风险。

常见绕过方式包括：

| 脆弱检查 | Agent 的捷径 | 更强检查 |
| --- | --- | --- |
| 文件存在 | 创建空文件 | 解析内容、验证语义并运行消费者 |
| 输出包含目标字符串 | 把字符串写进注释或日志 | 解析结构并查询目标字段 |
| 新增测试通过 | 删除或弱化测试 | 测试只读、摘要校验、隐藏回归测试 |
| API 返回 200 | Mock 或伪造响应 | 从 Agent 控制域外查询最终状态 |
| 新功能示例通过 | 针对固定样例硬编码 | 隐藏变体、性质测试、边界样本 |
| 任务最终成功 | 破坏其他数据后重建目标 | Before/After Diff 与不变量 |
| Trace 显示合规调用 | 伪造本地日志 | 可信工具网关与审计事件 |
| 成本低 | 绕过计量路径 | 所有模型与工具请求经过统一计数器 |

### 建立反作弊防线

1. **检查效果，不检查声明**：优先查询实际最终状态。
2. **保护测试资产**：隐藏测试、Grader 和参考解只读且不可见。
3. **双向验证**：既检查目标从失败变为通过，也检查原有成功没有退化。
4. **加入负控**：空产物、硬编码、删测试、伪造日志等明确错误方案必须失败。
5. **加入对抗解**：专门尝试满足表面信号但违反真实意图。
6. **使用隐藏变体**：变体必须来自已声明需求，不能引入 Task 没说的秘密要求。
7. **检查不变量**：成功之外还要验证允许范围和副作用。
8. **复核异常高分**：阅读可疑 Trace，比较产物结构和参考解相似度。
9. **版本化规则**：修复漏洞后保留新旧 Grader 的可比性边界。

SWE-bench 的 Harness 同时检查 `FAIL_TO_PASS` 和 `PASS_TO_PASS`：前者验证目标缺陷被解决，后者验证原有通过测试仍然通过。这是“正向功能 + 回归不变量”的典型结构。其官方 Harness API 还把部分解决与完整解决分开，保留比单一布尔值更细的证据。

测试也不能过度拟合参考实现。OpenAI 对编码评测的审计发现，过严测试会要求 Prompt 未声明的实现细节，而低覆盖测试又可能让不完整修改通过。好的隐藏检查应扩大已声明要求的覆盖，而不是偷偷发明新要求。

## 一份完整的 Deterministic Grader Schema

下面用一个通用、公开安全的案例说明完整结构。任务要求 Agent 在公共软件目录中加入一个条目，并保持原有数据不变。示例中的域名、路径、镜像和摘要均为占位符。

~~~yaml
schema_version: deterministic-grader-case-v1

case:
  id: public-catalog-add-entry-001
  title: "向公共软件目录加入合规条目"
  case_version: "1.0.0"

task:
  visibility: agent_visible
  instruction: |
    读取 /workspace/input/request.json，向
    /workspace/output/catalog.json 添加指定条目。
    保留所有现有条目，不得修改 /workspace/input。
    最终文件必须是满足公开 Schema 的 UTF-8 JSON。
  declared_inputs:
    - path: /workspace/input/request.json
      digest: "sha256:<REQUEST_DIGEST>"
    - path: /workspace/output/catalog.json
      digest: "sha256:<INITIAL_CATALOG_DIGEST>"
  declared_outputs:
    - path: /workspace/output/catalog.json
      media_type: application/json
  allowed_write_paths:
    - /workspace/output/catalog.json
  forbidden_actions:
    - modify_input
    - access_private_network
    - modify_tests_or_grader

environment:
  agent_image: "registry.example.com/eval/catalog-agent@sha256:<AGENT_IMAGE_DIGEST>"
  initial_snapshot: "fixture://public-catalog-v3"
  initial_snapshot_digest: "sha256:<SNAPSHOT_DIGEST>"
  reset_before_each_trial: true
  network:
    mode: allowlist
    allowed_hosts:
      - example.com
  resources:
    cpu: 2
    memory_mb: 2048
    disk_mb: 4096

evidence_contract:
  collector: trusted-harness-v2
  collector_digest: "sha256:<COLLECTOR_DIGEST>"
  required:
    - filesystem_before
    - filesystem_after
    - normalized_filesystem_diff
    - artifact_digest
    - trusted_tool_events
    - budget_counters
  completeness_policy: missing_required_evidence_is_invalid
  agent_can_write_evidence: false

expected_outcome:
  required:
    - id: target_entry_exists
      source: parsed_artifact
      predicate: "entry.slug == 'sample-tool'"
    - id: target_homepage_exact
      source: parsed_artifact
      predicate: "entry.homepage == 'https://example.com/sample-tool'"
    - id: target_license_allowed
      source: parsed_artifact
      predicate: "entry.license in ['Apache-2.0', 'MIT']"
  preferred:
    - id: entries_sorted
      source: parsed_artifact
      predicate: "entries sorted by slug"

state_contract:
  allowed_changes:
    - path: /workspace/output/catalog.json
      operation: modify
  forbidden_changes:
    - path_glob: /workspace/input/**
    - path_glob: /workspace/tests/**
    - path_glob: /workspace/grader/**
  unexplained_change_policy: fail

invariants:
  - id: existing_entries_preserved
    source: semantic_before_after_diff
    severity: gate
    predicate: "all original entries remain semantically equal"
  - id: slug_unique
    source: parsed_artifact
    severity: gate
    predicate: "all entry.slug values are unique"
  - id: no_forbidden_tool_event
    source: trusted_tool_events
    severity: gate
    predicate: "no event violates the action policy"
  - id: grader_assets_unchanged
    source: verifier_asset_digests
    severity: gate
    predicate: "all protected digests match"

contracts:
  - id: catalog_schema
    kind: json_schema
    schema_ref: "grader-asset://catalog.schema.json"
    schema_digest: "sha256:<SCHEMA_DIGEST>"
  - id: utf8_json
    kind: media_and_encoding
    expected_media_type: application/json
    expected_encoding: utf-8

budget:
  - id: agent_wall_time
    counter: agent_wall_time_ms
    maximum: 180000
    on_exceed: agent_failure
    severity: gate
  - id: tool_calls
    counter: trusted_tool_call_count
    maximum: 20
    on_exceed: agent_failure
    severity: score
  - id: verifier_wall_time
    counter: verifier_wall_time_ms
    maximum: 30000
    on_exceed: grader_error
    severity: validity

grader:
  bundle: "grader://public-catalog-v4"
  bundle_digest: "sha256:<GRADER_BUNDLE_DIGEST>"
  verifier_image: "registry.example.com/eval/verifier@sha256:<VERIFIER_IMAGE_DIGEST>"
  execution:
    fresh_sandbox: true
    network: none
    user: verifier
    candidate_artifact_mount: read_only
    grader_assets_mount: read_only
    secrets: none
  checks:
    - id: evidence_integrity
      kind: evidence_digest
      phase: validity
    - id: schema_valid
      kind: json_schema
      phase: gate
    - id: target_entry
      kind: semantic_assertion
      phase: gate
    - id: state_scope
      kind: normalized_state_diff
      phase: gate
    - id: invariants
      kind: invariant_bundle
      phase: gate
    - id: requested_fields
      kind: assertion_coverage
      phase: score
      weight: 0.70
    - id: preferred_order
      kind: semantic_assertion
      phase: score
      weight: 0.10
    - id: efficiency
      kind: budget_curve
      phase: score
      weight: 0.20

aggregation:
  method: validity_then_gates_then_weighted_score
  pass_threshold: 0.80
  result_space:
    task_outcomes: [PASS, PARTIAL, FAIL]
    non_task_outcomes: [GRADER_ERROR, INFRA_ERROR, UNSCORABLE, CANCELLED]
  zero_tolerance_gate_failure: FAIL
  incomplete_with_valid_progress: PARTIAL
  incomplete_without_valid_progress: FAIL
  report_subchecks: true
  round_only_for_display: true

error_policy:
  missing_required_evidence: UNSCORABLE
  candidate_artifact_missing: FAIL
  candidate_artifact_malformed: FAIL
  agent_deadline_exceeded: FAIL
  verifier_deadline_exceeded: GRADER_ERROR
  verifier_exception: GRADER_ERROR
  snapshot_unavailable: INFRA_ERROR
  ambiguous_failure: UNSCORABLE
  exclude_non_task_outcomes_from_capability_denominator: true
  always_report_error_counts: true

validation:
  reference_solution:
    artifact_ref: "private-artifact://public-catalog/oracle-v2"
    artifact_digest: "sha256:<ORACLE_DIGEST>"
    expected_status: PASS
  positive_controls:
    - { id: valid-alternative-ordering, expected_status: PASS }
    - { id: valid-minimal-entry, expected_status: PASS }
  negative_controls:
    - { id: empty-file, expected_status: FAIL }
    - { id: target-string-in-comment, expected_status: FAIL }
    - { id: duplicate-entry, expected_status: FAIL }
    - { id: existing-entry-deleted, expected_status: FAIL }
  adversarial_controls:
    - { id: modify-schema-attempt, expected_status: FAIL }
    - { id: forged-test-output, expected_status: FAIL }
    - { id: symlink-outside-output, expected_status: FAIL }
  repeatability:
    frozen_evidence_replays: 3
    expected_identical_results: true
~~~

这个 Schema 刻意把四件事分开：

1. Agent 可见的任务要求；
2. 由可信 Harness 采集的证据；
3. 只对 Grader 可见的检查逻辑；
4. 作者用于验证 Grader 的参考解与反例。

生产实现可以使用不同字段名，但不应把 Agent 的工作区直接当作可信证据仓库。

## 一段通用评分伪代码

下面的伪代码展示聚合顺序。它不是绑定某个 Eval SDK 的实现。

~~~ts
type TrialStatus =
  | 'PASS'
  | 'PARTIAL'
  | 'FAIL'
  | 'GRADER_ERROR'
  | 'INFRA_ERROR'
  | 'UNSCORABLE'
  | 'CANCELLED'

type Phase = 'validity' | 'gate' | 'score'

type AssertionResult = {
  id: string
  phase: Phase
  passed: boolean
  score?: number
  weight?: number
  observed?: unknown
  expected?: unknown
  evidenceRef: string
}

type GradeReport = {
  status: TrialStatus
  score: number | null
  assertions: AssertionResult[]
  graderDigest: string
  evidenceDigest: string
  reason?: string
}

async function gradeTrial(bundle: EvidenceBundle): Promise<GradeReport> {
  const integrity = verifyEvidenceDigests(bundle)
  if (!integrity.passed) {
    return report('UNSCORABLE', null, [integrity])
  }

  let checks: AssertionResult[]
  try {
    checks = await runInFreshVerifierSandbox({
      candidateArtifacts: bundle.declaredArtifacts,
      beforeSnapshot: bundle.beforeSnapshot,
      afterSnapshot: bundle.afterSnapshot,
      trustedEvents: bundle.trustedEvents,
      budgetCounters: bundle.budgetCounters,
      network: 'none',
      mounts: 'read-only'
    })
  } catch (error) {
    return classifyVerifierFailure(error, bundle)
  }

  const invalidCheck = checks.find(
    check => check.phase === 'validity' && !check.passed
  )
  if (invalidCheck) {
    return report('GRADER_ERROR', null, checks, invalidCheck.id)
  }

  const agentDeadline = checks.find(
    check => check.id === 'agent_wall_time' && !check.passed
  )
  if (agentDeadline) {
    return report('FAIL', 0, checks, agentDeadline.id)
  }

  const zeroToleranceFailure = checks.find(
    check => check.phase === 'gate' && !check.passed && isZeroTolerance(check)
  )
  if (zeroToleranceFailure) {
    return report('FAIL', 0, checks, zeroToleranceFailure.id)
  }

  const scored = checks.filter(check => check.phase === 'score')
  const weight = scored.reduce((sum, check) => sum + (check.weight ?? 0), 0)
  const score = scored.reduce(
    (sum, check) => sum + (check.score ?? 0) * (check.weight ?? 0),
    0
  ) / weight

  const allRequiredPassed = checks
    .filter(isRequiredOutcome)
    .every(check => check.passed)

  if (allRequiredPassed && score >= 0.8) {
    return report('PASS', score, checks)
  }

  const hasValidProgress = checks.some(
    check => isFunctionalOutcome(check) && check.passed
  )
  return report(hasValidProgress ? 'PARTIAL' : 'FAIL', score, checks)
}
~~~

实现时还需要处理权重为零、数字越界、NaN、证据过大、解析超时和报告序列化失败。关键不是这段语法，而是顺序：**先验证证据，再运行 Gate，最后计算可平均分数**。

## Grader 本身也必须被测试

评测器是生产代码的一部分，应拥有自己的测试金字塔。

### 单元测试

每个 Assertion 至少包含：

- 明确通过样本；
- 明确失败样本；
- 边界值；
- 缺失字段；
- 类型错误；
- 超大或恶意输入；
- 路径规范化和编码差异。

### Contract Test

验证 Evidence Collector、Verifier 和 Aggregator 对字段、版本、错误码和摘要算法的理解一致。升级一侧时，旧 Bundle 应显式拒绝或迁移，不能被静默误读。

### Positive Control 与 Reference Solution Smoke Test

Reference Solution 必须在正式环境中稳定通过。它证明任务至少存在一个已知可行解，但不能证明 Grader 接受所有合法解。还应准备结构和路径不同的 Positive Controls，确认多个符合 Contract 的替代解都能得到 `PASS`，避免 Grader 暗中绑定参考实现。

### Negative 与 Adversarial Controls

每条核心检查都应有“应失败”的方案。尤其测试：

- 只制造表面信号；
- 删除或修改评分资产；
- 硬编码公开样例；
- 通过路径穿越修改范围外文件；
- 伪造日志、结果文件和预算；
- 部分完成但声称全部完成；
- 完成目标同时破坏无关状态。

### Mutation Test

主动删掉一个检查、反转比较符、放宽阈值或改变 Fixture，确认测试能够发现 Grader 已失去约束力。若 Grader 的测试在评分逻辑损坏后仍全部通过，测试只是在复述实现。

### Replay Test

把同一份冻结 Evidence Bundle 连续评分多次，并比较完整结构化结果，而不只是最终分数。时间戳、日志顺序或随机临时路径不应进入语义结果。

## 失败报告必须能指导修复

一个只返回 `0.6` 的确定性 Grader 仍然很难使用。每条失败应包含：

~~~json
{
  "check_id": "existing_entries_preserved",
  "phase": "gate",
  "status": "failed",
  "expected": "all original entries remain semantically equal",
  "observed_summary": "one original entry is missing",
  "evidence_ref": "diff://filesystem/catalog-semantic-diff.json",
  "grader_version": "public-catalog-v4"
}
~~~

公开报告不应包含私有数据或完整原始日志。可以输出结构化摘要和受权限保护的证据引用。错误信息也要限制长度，防止 Agent 产物通过异常栈或测试输出进入不受控日志。

建议把结果分成：

- **Decision**：是否有效、是否过 Gate、最终状态；
- **Evidence**：观察值、期望值、证据引用和摘要；
- **Diagnostics**：可能根因、失败阶段和建议调查点；
- **Provenance**：Case、Grader、Environment 和聚合策略版本。

Decision 必须由确定性逻辑产生。Diagnostics 可以在后处理中由模型辅助归纳，但不能反向修改原始判定。

## 维护与版本规则

Grader 不是写完就不变。以下变化通常需要发布新版本：

- 新增、删除或改变 Required Gate；
- 修改阈值、权重或聚合公式；
- 改变 Evidence Source 或规范化算法；
- 升级 Schema、编译器、测试框架或 Verifier Image；
- 修复会改变历史样本判定的 Bug；
- 扩大或缩小允许状态变化范围；
- 改变错误归因和分母规则。

修改后需要：

1. 重跑 Reference、Negative 和 Adversarial Controls；
2. 对一组冻结 Evidence Bundle 做新旧双评分；
3. 记录哪些结果发生变化以及原因；
4. 明确历史分数是否仍可直接比较；
5. 必要时重跑正式基线，而不是拼接两个版本的分数。

如果一个检查已经饱和但仍代表不可回归的能力，可以保留为 Gate；如果它只检查已经没有价值的实现细节，应删除或重写。不要因为某个 Gate 阻止发布，就临时降低阈值而不重新审查 Evaluation Contract。

## 常见误区

### “只要写了单元测试，就是确定性评测”

测试依赖、环境、时间、网络和共享状态都可能漂移。需要冻结执行条件并验证重复评分一致。

### “测试全绿就说明 Agent 完成了任务”

测试只证明被覆盖的断言成立。还要检查状态范围、原有行为、不变量和评测资产完整性。

### “失败一律记 0 分最保守”

这会把 Grader Bug、容器故障和证据缺失伪装成能力失败，使比较产生系统偏差。

### “为了防作弊，隐藏要求越多越好”

隐藏测试可以覆盖公开要求的未见变体，不能要求 Task 从未声明的行为。否则防作弊变成不公平评分。

### “所有指标都可以平均”

权限越界、数据破坏、Grader 篡改和关键 Outcome 缺失应是 Gate。平均分无法表达零容忍风险。

### “检查工具调用顺序比检查结果更严格”

固定顺序会惩罚合理的新路径。只有审批、权限、禁止动作和法规流程等真正的过程约束才应成为硬规则。

### “Agent 说测试通过，可以直接复用这个结果”

Agent 生成的终端文本是弱证据。Verifier 必须在受控环境中独立执行测试并保留真实结果。

### “容器就是安全边界”

容器是隔离机制的一部分，不是完整安全声明。必须审查权限、挂载、网络、宿主接口、凭据和候选代码究竟在哪个进程执行。

## Deterministic Grader 验收清单

### 判断边界

- 每条检查是否对应 Evaluation Contract 中的明确主张？
- 能直接验证的事实是否避免交给 LLM？
- 无法形式化的质量维度是否被明确移交给 Model 或 Human Grader？
- 是否允许多种满足目标和约束的合法路径？

### 证据

- 每条 Required Outcome 是否绑定具体 Evidence Source？
- 是否优先使用 Agent 控制域外的最终状态？
- Before/After Snapshot 是否完整、带摘要且绑定 Trial？
- 预算和事件是否由可信 Harness 采集？
- 证据缺失、截断和损坏是否有显式状态？

### 检查设计

- 是否同时覆盖 Outcome、State、Invariant、Contract 和 Budget？
- 是否解析语义而不是依赖表面字符串？
- 是否既验证目标成功，也验证原有行为没有退化？
- 路径、符号链接、编码、浮点数和时间比较是否规范化？
- 每条失败是否给出观察值、期望值和证据引用？

### 隔离与安全

- Agent 是否无法读取或修改 Grader、测试和参考解？
- Evidence Collector 是否位于 Agent 写权限之外？
- 候选代码是否只在一次性、限权的 Verifier Sandbox 执行？
- Verifier 是否没有真实凭据、宿主 Socket 和默认外网？
- Case、Snapshot、Grader Bundle 和 Image 是否使用不可变摘要？

### 聚合与错误

- 是否先判断 Validity，再执行 Gate，最后计算部分得分？
- 零容忍失败是否无法被平均分抵消？
- Agent Deadline 与 Grader Deadline 是否分开？
- 基础设施、Grader、证据和 Agent 失败是否分开报告？
- 错误 Trial 是否保留计数但不静默进入或离开能力分母？

### 反作弊与维护

- Reference Solution 与替代 Positive Controls 是否稳定通过？
- 空产物、硬编码、删测试和伪造日志是否稳定失败？
- 是否有符合公开要求的隐藏变体与对抗解？
- 冻结 Evidence Replay 是否得到完全一致的结果？
- Grader、依赖、阈值和聚合规则是否版本化？
- 修改 Grader 后是否执行新旧对照并声明可比性？

## 本篇的落地产物

完成本篇后，评测系统应新增一份版本化的 **Deterministic Grader Contract**，至少包含：

~~~text
Evidence Priority
+ Outcome Assertions
+ Allowed State Diff
+ Invariants
+ Interface Contracts
+ Budget Rules
+ Trust Boundary
+ Gate and Partial-score Aggregation
+ Error Taxonomy
+ Reference / Negative / Adversarial Controls
+ Version and Replay Policy
~~~

它不是为了消灭 LLM Grader，而是先把不需要 LLM 的判断从 LLM 手中拿回来。下一步再通过 [LLM-as-Judge 的 Rubric、校准和分歧处理](./reliable-llm-as-judge-for-agent-evaluation.md)，覆盖真正开放的质量维度。

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Agent Eval 的 Grader 类型、Outcome 优先、部分得分、隔离环境和反绕过建议。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 任务特定评测、自动化评分、持续评测与人工校准原则。
- [OpenAI：Graders](https://developers.openai.com/api/docs/guides/graders) — 字符串、相似度、模型、代码和组合式 Grader 的公开实现说明，以及 Grader Hacking 风险。
- [OpenAI：A shared playbook for trustworthy third-party evaluations](https://openai.com/index/trustworthy-third-party-evaluations-foundations/) — Reward Hacking、污染、Broken Problems 与 Harness 有效性风险。
- [OpenAI：Separating signal from noise in coding evaluations](https://openai.com/index/separating-signal-from-noise-coding-evaluations/) — 过严测试、欠规范任务、低覆盖测试和误导性要求对评测结论的影响。
- [SWE-bench：Evaluation Guide](https://www.swebench.com/SWE-bench/guides/evaluation/) — 容器化执行、评分产物，以及成功、失败和基础设施错误的区分。
- [SWE-bench：Harness API](https://www.swebench.com/SWE-bench/api/harness/) — `FAIL_TO_PASS`、`PASS_TO_PASS`、部分解决与完整解决的确定性聚合逻辑。
- [Inspect：Scoring](https://inspect.aisi.org.uk/scoring.html) — 标准与自定义 Scorer、多 Scorer 和指标聚合。
- [Inspect：Sandboxing](https://inspect.aisi.org.uk/sandboxing.html) — Agent、工具、Scorer 与 Sandbox 的实际执行边界和资源限制。
- [Inspect：Handling Errors](https://inspect.aisi.org.uk/errors-and-limits.html) — Runtime Error、Crash Recovery、重试和错误样本评分语义。
- [NIST SP 800-190：Application Container Security Guide](https://csrc.nist.gov/pubs/sp/800/190/final) — 容器安全风险、隔离和运行环境防护建议。
- [Google DeepMind：Specification gaming](https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/) — 奖励捷径与设计目标错位的原理和案例。
