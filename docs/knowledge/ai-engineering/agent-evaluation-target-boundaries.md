---
title: Agent 评测对象的四层边界：模型、Harness、系统与产品
date: 2026-08-31
tags:
  - Agent Evaluation
  - Agent Architecture
  - AI Engineering
description: 区分模型、Agent Harness、完整系统和产品结果，建立能够解释分数变化的 Evaluation Map 与受控实验边界
---

# Agent 评测对象的四层边界：模型、Harness、系统与产品

## 要解决的问题

很多 Agent 对比最终都会落到一句话：“新模型比旧模型高 8 分。”但这个结论可能混合了完全不同的变化：

- 模型本身变了；
- System Prompt 或上下文组织变了；
- 工具定义、权限或错误重试变了；
- Agent 循环、超时和停止条件变了；
- 环境数据、依赖和网络状态变了；
- 产品交互、人工审批或用户分布变了。

如果不知道实验真正替换了哪一层，分数变化就无法解释，也无法稳定复现。Agent 评测的第一步不是选择指标，而是声明被测对象。

## 四层 Evaluation Map

可以把 Agent 产品拆成四层：

~~~text
L1 Model
   推理、生成、工具选择等基础能力
        ↓
L2 Agent Harness
   Prompt、上下文、工具、循环、记忆、权限、重试
        ↓
L3 Agent System
   Harness + 模型 + 业务服务 + 数据 + 运行环境
        ↓
L4 Product Outcome
   用户任务、组织流程、人工协作、成本与风险
~~~

| 层次 | 典型问题 | 主要控制变量 | 主要证据 |
| --- | --- | --- | --- |
| Model | 哪个模型更适合这类能力？ | 固定 Prompt、工具、Harness、环境 | 能力任务成功率、错误类型、成本 |
| Agent Harness | 哪种提示、工具或循环更好？ | 固定模型、任务集和环境 | Outcome、Trace、调用行为 |
| Agent System | 端到端版本是否更可靠？ | 固定任务分布和发布协议 | 状态验证、集成测试、稳定性 |
| Product Outcome | 是否真正改善用户或业务结果？ | 真实流量、流程和风险边界 | 完成率、人工介入、留存、损失 |

这四层不是四套互斥评测，而是四种不同的因果问题。越向下，实验越接近真实价值，也越容易受到外部因素干扰。

## 第一层：模型能力

模型评测想回答的是：“在其余条件相同的情况下，哪个模型更能完成目标任务？”

一次可信的模型对比应固定：

- 相同的 System Prompt 与上下文模板；
- 相同工具名称、Schema、描述和返回值；
- 相同 Agent 循环、重试、超时和停止条件；
- 相同权限和预算；
- 相同任务集、环境快照和 Grader；
- 足够多的独立 Trial。

此时改变的主要变量才是模型及其推理配置。若为了适配新模型同时重写 Prompt、添加工具并放宽超时，实验测量的是新系统组合，而不是纯模型差异。

[AgentBench](https://proceedings.iclr.cc/paper_files/paper/2024/hash/e9df36b21ff4ee211a8b71ee8b7e9f57-Abstract-Conference.html)一类研究基准更接近这一层：它在预先定义的交互环境和任务上比较不同 LLM Agent 的能力。但公开基准上的领先并不自动等于在具体产品分布上更好。

## 第二层：Agent Harness

Harness 是把模型变成 Agent 的运行脚手架，通常包含：

- System Prompt 和动态指令；
- 上下文裁剪、摘要和记忆；
- 工具发现、Schema 与结果格式；
- 规划、反思、重试和错误恢复；
- 最大轮数、超时和停止条件；
- 权限、审批与 Guardrail；
- 模型路由和子 Agent 编排。

[Anthropic 的定义](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)明确指出，实际被评估的 Agent 是模型与 Harness 的组合。这意味着“模型分数”在很多产品实验中其实是“某模型在某套 Harness 中的系统分数”。

Harness 评测适合回答更具体的问题：

- 给工具补充示例是否减少了参数错误？
- 并行调用是否降低延迟，又是否增加重复副作用？
- 新的上下文压缩是否节省 Token，但损害长程任务？
- 引入审批后，高风险动作是否下降，完成率损失多少？
- 重试策略是否提升成功率，又是否放大成本和尾延迟？

这些问题都应一次只改变少量因素，并保留 Trace 解释行为差异。

## 第三层：完整 Agent System

完整系统把模型和 Harness 放进真实技术环境中。此时评测对象还包括：

- 搜索、数据库、代码执行器和第三方 API；
- 依赖版本、网络、缓存、文件系统和计算资源；
- 身份、权限、密钥与审批服务；
- 并发、队列、限流和故障恢复；
- 状态持久化和跨会话记忆。

这层最重要的不是“语言输出像不像参考答案”，而是端到端 Outcome：

- 目标状态是否形成；
- 系统不变量是否保持；
- 是否产生额外副作用；
- 故障时是否安全停止或恢复；
- 同一版本能否在受控环境中复现。

[OpenAI 的 Agent Eval 指南](https://developers.openai.com/api/docs/guides/agent-evals)建议结合 Trace grading、数据集和重复 Eval Run，检查工具选择、交接、指令遵循和工作流变化。Trace 在这里主要用于定位系统行为，最终事实仍应由测试或环境状态验证。

## 第四层：产品结果

系统评测通过，不代表产品一定有价值。例如：

- Agent 完成率高，但用户需要大量检查，不愿采用；
- 自动化节省了操作时间，却增加了高风险错误；
- 平均响应更快，但复杂任务更容易放弃；
- 离线任务集表现上升，真实用户问题已发生漂移；
- 技术成功率提升，整体流程时间却被审批环节抵消。

产品层需要把用户、人工协作和组织流程纳入评测。常见指标包括：

~~~text
用户目标完成率
端到端任务时间
人工介入率与返工率
用户修正或撤销率
单位成功任务成本
风险事件与损失
采用率、复用率或留存
~~~

这些指标通常不能由离线 Benchmark 单独给出。[NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)强调在具体语境中 Map、Measure 和 Manage 风险，并结合定量、定性及混合测量方法。产品结果本质上也是一个社会技术系统问题。

## 用三个问题确定实验边界

每次 Eval 在运行前都应写清三件事：

### 1. Unit under evaluation

究竟替换什么？

~~~yaml
unit_under_evaluation:
  type: model
  candidates:
    - model_a
    - model_b
~~~

也可以是 Prompt、工具描述、Harness 版本、完整 Release Candidate 或产品流程。

### 2. Controlled variables

什么必须保持不变？

~~~yaml
controlled:
  prompt_version: prompt-v7
  toolset_version: tools-v3
  harness_version: harness-v5
  dataset_version: support-core-v2
  environment_snapshot: env-2026-08
  grader_version: grader-v4
  trial_protocol: 5-independent-runs
~~~

若某个变量无法固定，应把它记录为已知混杂因素，而不是在报告里省略。

### 3. Measured outcomes

哪些结果决定胜负？

~~~yaml
measures:
  primary:
    - task_success_rate
    - hard_constraint_violation_rate
  secondary:
    - quality_rubric
    - p95_latency
    - cost_per_success
    - pass_at_k
  diagnostics:
    - tool_selection_error
    - retry_count
    - context_overflow
~~~

Primary 指标回答实验结论，Secondary 展示权衡，Diagnostic 解释原因。不要让数十个过程指标共同竞争“主结论”。

## 一个例子：文章生成 Agent 的三个不同实验

同一个系统可以提出三种完全不同的问题。

### 实验 A：比较模型

固定 Prompt、检索工具、写作流程、资料集和 Grader，只替换模型。结论可以写成：

> 在当前 Harness 与任务集上，模型 B 的任务成功率更高，但单位成功成本也更高。

这里不能直接推广为“模型 B 在所有 Agent 上更强”。

### 实验 B：比较 Harness

固定模型，比较“先列证据表再写作”和“直接写作”两种工作流。结论关注引用支持率、遗漏率、Token 和延迟。这里测量的是编排策略，而非模型能力。

### 实验 C：比较产品版本

把新系统放入受控流量，观察用户是否减少修改、是否更愿意保存文章、是否出现隐私或误引用事件。这里即使内部模型没有变化，产品结果也可能因界面、审批和反馈机制而改变。

三个实验可以共享 Case 与部分 Grader，但不能共享同一句因果结论。

## Run Manifest：让结果可以被解释

每个 Trial 都应保存一份最小运行清单：

~~~yaml
run:
  id: run-...
  task_id: case-...
  trial_index: 1

agent:
  model: ...
  model_parameters: ...
  prompt_version: ...
  harness_version: ...
  toolset_version: ...
  permission_profile: ...

evaluation:
  dataset_version: ...
  grader_version: ...
  evaluator_model: ...

environment:
  snapshot: ...
  dependency_lock: ...
  resource_profile: ...

result:
  outcome_ref: ...
  trace_ref: ...
  started_at: ...
  duration_ms: ...
~~~

Run Manifest 不需要保存所有原始内容，但必须能关联到不可变版本或快照。否则几周后看到一次分数变化，通常已经无法还原当时真正运行了什么。

## 不要过早压成一个总分

四层指标之间并不天然可加：

- 模型能力高，不代表 Harness 能正确发挥；
- 系统成功率高，不代表用户体验更好；
- 用户完成率高，不代表风险可以接受；
- 成本更低，不代表尾部失败可接受。

因此，报告应先保留层次和维度，再根据具体决策设置 Gate。一个常见结构是：

~~~text
硬门槛
  安全 / 权限 / 数据完整性 / 关键回归

主指标
  任务成功率或产品目标完成率

权衡指标
  质量 / 延迟 / 成本 / 人工介入

诊断指标
  失败阶段 / 工具错误 / 重试 / 上下文问题
~~~

只有当业务确实需要排序时，才在明确权重和门槛后构造综合分。

## Evaluation Map 模板

团队可以在每个项目开始时填写这张图：

| 问题 | 当前答案 |
| --- | --- |
| 用户真正要完成什么任务？ |  |
| 当前评测处于哪一层？ | Model / Harness / System / Product |
| Unit under evaluation 是什么？ |  |
| 哪些变量必须固定？ |  |
| 哪些变量无法固定？ |  |
| 最终 Outcome 存在哪里？ |  |
| 哪些指标是硬门槛？ |  |
| 哪个指标决定主要结论？ |  |
| 哪些 Trace 信号只用于诊断？ |  |
| 结论允许推广到什么范围？ |  |

它的价值不在于文档形式，而在于迫使实验先回答“我们在比较什么”。

## 常见误区

### 用公开 Benchmark 代替产品评测

公开 Benchmark 可以提供能力先验，但任务分布、工具、环境和风险边界与真实产品不同。它适合筛选候选，不足以直接作发布决策。

### 同时改变模型、Prompt 和工具

这种实验可以判断“整个新版本是否更好”，但不能定位提升来源。报告应明确它是系统版本对比。

### 把 Trace 指标当作目标

更少工具调用不一定更好，更多思考步骤也不一定更差。过程信号只有在和 Outcome、约束或成本建立关系后才有意义。

### 忽略 Evaluator 版本

Grader、Judge Prompt 或测试用例一旦变化，历史分数可能不可直接比较。评测器也是实验代码，必须版本化。

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — 模型与 Harness 的组合、Eval Harness、Outcome 和 Trace 的定义。
- [OpenAI：Agent evals](https://developers.openai.com/api/docs/guides/agent-evals) — Trace grading、数据集与重复 Eval Run 的产品化实践。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 不同复杂度系统的评测设计与持续评测原则。
- [AgentBench: Evaluating LLMs as Agents](https://proceedings.iclr.cc/paper_files/paper/2024/hash/e9df36b21ff4ee211a8b71ee8b7e9f57-Abstract-Conference.html) — 交互环境中的模型 Agent 能力比较。
- [NIST AI Risk Management Framework Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — 在具体语境中治理、映射、测量和管理 AI 风险。
