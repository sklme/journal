---
title: 为什么 Agent 评测比搭建 Agent 更难
date: 2026-08-31
tags:
  - Agent Evaluation
  - AI Engineering
  - Testing
description: 从非确定性、多步决策、环境状态和多种正确路径出发，解释 Agent 评测为何不能退化为一次输入输出测试
---

# 为什么 Agent 评测比搭建 Agent 更难

## 要解决的问题

今天搭建一个 Agent 往往只需要选择模型、编写指令、接入几个工具，再补上一段循环控制。难点随即从“它能不能运行”转向一组更棘手的问题：

- 这次成功是稳定能力，还是一次幸运采样？
- 最终文字看起来正确，真实环境是否已经被正确修改？
- 更换模型之后得分上升，究竟是模型更强，还是 Harness、工具或环境改变了？
- Agent 采用了另一条同样有效的路径，评测器会不会把它误判为失败？
- 平均表现变好时，成本、尾延迟和高风险失败是否同时恶化？

传统软件测试通常假设执行路径由程序确定，测试者可以稳定地复现输入、执行和输出。Agent 则把模型决策、工具反馈和外部状态放进同一个闭环。评测对象不再只是一个函数，而是一个会观察、行动、再观察的系统。

## 核心判断

Agent 评测困难，不是因为自然语言无法评分，而是因为它同时具有五个特征：

~~~text
非确定性
+ 多步决策
+ 环境交互
+ 多种正确路径
+ 多维质量约束
= 需要实验工程，而不只是样例测试
~~~

[Anthropic 对 Agent Eval 的工程总结](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)把一次评测拆成 Task、Trial、Grader、Transcript、Outcome、Evaluation Harness 和 Agent Harness。这个拆分很重要：同一个任务需要多次 Trial，过程记录与最终状态需要分别观察，评测基础设施也必须和被测 Agent 分开理解。

## Agent 测试与传统输入输出测试的差异

| 维度 | 传统确定性程序 | Agent 系统 |
| --- | --- | --- |
| 相同输入 | 通常得到相同输出 | 可能产生不同计划、工具调用和结果 |
| 执行路径 | 由代码显式定义 | 由模型在运行时选择 |
| 外部状态 | 常被 Mock 或隔离 | 往往就是任务的一部分 |
| 正确答案 | 常有精确预期值 | 可能存在多种有效结果 |
| 失败传播 | 通常可定位到确定步骤 | 早期误判会改变后续全部上下文 |
| 质量目标 | 正确性为主 | 正确性、成本、延迟、风险和稳定性并存 |

公开基准也反映了这种变化。[AgentBench](https://proceedings.iclr.cc/paper_files/paper/2024/hash/e9df36b21ff4ee211a8b71ee8b7e9f57-Abstract-Conference.html)把 Agent 放进八类交互环境，发现长程推理、决策和指令遵循是主要困难；[WebArena](https://proceedings.iclr.cc/paper_files/paper/2024/hash/4410c0711e9154a7a2d26f9b3816d1ef-Abstract-Conference.html)通过可复现网站环境评价真实网页任务；[SWE-bench](https://proceedings.iclr.cc/paper_files/paper/2024/hash/edac78c3e300629acfe6cbe9ca88fb84-Abstract-Conference.html)则要求系统理解真实代码库并完成能够通过测试的修改。它们都不再把最终回答文本当作唯一证据。

## 五个困难分别来自哪里

### 1. 非确定性使单次成功失去代表性

温度、采样、服务端实现和上下文细节都可能改变模型输出。即使模型与 Prompt 不变，Agent 也可能选择不同工具或以不同顺序完成任务。

因此，“跑通一次”只能证明任务有可能成功，不能证明系统具有稳定能力。至少需要记录：

- 同一任务运行多少次；
- 每次是否独立重置环境；
- 成功率和失败类型；
- 最差表现、尾延迟与成本分布；
- 是否存在偶发但不可接受的风险事件。

[τ-bench](https://arxiv.org/abs/2406.12045)使用 pass^k 描述多次交互中的一致成功能力。它提醒我们：单次通过率相同的两个 Agent，连续可靠完成任务的概率可能差异很大。

### 2. 多步决策让错误沿上下文传播

Agent 的一次早期误判会改变后续能看到的信息和可采取的动作。例如，检索时选错关键词，可能导致错误来源进入上下文；随后总结、写作和引用检查都建立在错误材料上。

最终失败未必来自最后一步。只看答案会丢失因果链，只看 Trace 又可能把“路径不同”误判成“路径错误”。合理分工是：

- Outcome 判断是否完成任务；
- Trace 解释为什么成功或失败；
- 只有安全边界、审批要求等硬约束才直接限制过程。

### 3. 环境既是输入，也是结果的一部分

对于代码、网页操作、数据处理和业务流程 Agent，真正结果往往存在于环境中：

- 文件是否写入正确目录；
- 测试是否通过；
- 数据库是否处于目标状态；
- 订单、日程或工单是否真实创建；
- 是否留下了额外副作用。

Agent 说“已经完成”不是完成证据。[Anthropic 的 Eval 指南](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)明确区分 Transcript 与 Outcome，并建议检查最终环境状态。环境本身还会制造噪声：依赖版本、缓存、遗留文件、网络和资源限制都可能改变分数。[Anthropic 关于基础设施噪声的实验](https://www.anthropic.com/engineering/infrastructure-noise)显示，资源配置变化可以显著影响 Agent 编码基准结果。

### 4. 多种正确路径会惩罚合理创新

一个研究 Agent 可以先广泛检索再筛选，也可以先建立问题树再定向查证；一个编码 Agent 可以修改实现，也可以在契约允许时调整更合适的抽象。若 Grader 强制要求复刻参考轨迹，它实际测量的是“像不像答案作者”，而不是“有没有完成任务”。

因此应优先检查：

1. 最终状态是否满足要求；
2. 必要约束是否满足；
3. 禁止动作是否发生；
4. 开放性质量是否达到 Rubric；
5. 成本和延迟是否在预算内。

轨迹相似度更适合作为诊断信号，而不是普遍的成功定义。

### 5. 一个总分无法表达真实权衡

Agent 可能在正确率上升的同时，调用次数翻倍；也可能平均得分更高，却产生少量灾难性失败。把这些信号直接压成一个平均分，会隐藏决策真正需要的信息。

更稳妥的结果面板至少分开报告：

~~~text
任务成功率
硬约束违反率
质量维度分数
平均与尾部延迟
Token / 工具 / 金钱成本
多次 Trial 的稳定性
高风险失败案例
~~~

其中安全、权限和数据破坏等指标通常应该设置门槛，而不是允许它们被其他高分抵消。

## 一个具体例子：让 Agent 研究并保存文章

假设任务是“围绕一个技术主题查阅公开资料，写成 Markdown，并保存到知识库”。一次表面合理的运行可能出现：

- 正文流畅，但引用并不支持关键结论；
- 文件写对了，目录索引没有更新；
- 内容完整，但泄露了本地路径或内部信息；
- 所有要求都完成了，但调用工具数和耗时不可接受；
- Agent 声称校验通过，实际没有运行构建命令；
- 采用了不同的文章结构，却被基于参考文本的 Grader 判低分。

这说明“最终文本好不好”只是一个维度。真实 Outcome 还包括文件、导航、构建状态和信息安全；真实评测还要覆盖成本、稳定性与证据。

## 从 Demo 走向评测的最小闭环

第一版不需要庞大的 Benchmark 平台，但需要把下面六件事做完整：

1. 选择 10～30 个来自真实工作的任务，而不是只写理想化示例。
2. 为每个任务定义必须结果、禁止动作和最低质量门槛。
3. 让每个 Trial 从已知环境开始，并记录模型、Prompt、工具和 Harness 版本。
4. 优先用测试、状态查询和 Schema 等确定性 Grader 验证事实。
5. 对开放性质量使用清晰 Rubric，并抽样由领域专家校准。
6. 阅读失败 Trace，把真实失败转化成可长期回归的 Case。

[OpenAI 的评测最佳实践](https://developers.openai.com/api/docs/guides/evaluation-best-practices)同样强调任务特定评测、真实分布、持续评测、完整日志和自动指标与人工判断的校准。这些原则的共同指向是：Agent Eval 是一个持续实验系统，而不是上线前的一次考试。

## 常见误区

### “能稳定执行”就等于“质量稳定”

运行时没有崩溃，只说明基础设施可用，不能说明任务完成、事实正确或风险可控。

### “有 Trace”就等于“有 Eval”

Trace 记录发生了什么，Eval 还需要任务定义和判断标准。工具调用次数本身没有好坏，只有相对任务目标和预算才有意义。

### “题目越多，评测越可信”

大量含糊、重复或脱离真实分布的题目会制造虚假的统计确定性。Case 质量、环境可复现性和 Grader 有效性通常比数量更优先。

### “平均分上升，就可以发布”

发布决策还需要看回归任务、安全门槛、最差案例和成本边界。平均值不能覆盖不可逆副作用。

## 本篇的落地产物

读完本篇，至少应能画出一张评测问题清单：

~~~yaml
task_distribution:
  source: real_work

evidence:
  outcome: final_environment_state
  process: trace

repeatability:
  trials_per_case: 3
  reset_environment: true

dimensions:
  - task_success
  - constraint_violations
  - quality
  - latency
  - cost
  - reliability
  - risk
~~~

它还不是完整 Evaluation Contract，但已经把问题从“这次看起来不错”推进到“需要哪些证据才能证明它不错”。

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Agent Eval 的核心术语、Harness、Grader、环境隔离和实践建议。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 任务特定评测、日志、持续评测与 Judge 校准原则。
- [AgentBench: Evaluating LLMs as Agents](https://proceedings.iclr.cc/paper_files/paper/2024/hash/e9df36b21ff4ee211a8b71ee8b7e9f57-Abstract-Conference.html) — 多交互环境中的 Agent 能力评测。
- [WebArena: A Realistic Web Environment for Building Autonomous Agents](https://proceedings.iclr.cc/paper_files/paper/2024/hash/4410c0711e9154a7a2d26f9b3816d1ef-Abstract-Conference.html) — 可复现网页环境与功能正确性评测。
- [SWE-bench: Can Language Models Resolve Real-World GitHub Issues?](https://proceedings.iclr.cc/paper_files/paper/2024/hash/edac78c3e300629acfe6cbe9ca88fb84-Abstract-Conference.html) — 基于真实代码库和测试结果的编码任务评测。
- [τ-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains](https://arxiv.org/abs/2406.12045) — 最终数据库状态与多次 Trial 可靠性。
- [Anthropic：Infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise) — 运行资源如何成为 Agent Benchmark 的实验变量。
