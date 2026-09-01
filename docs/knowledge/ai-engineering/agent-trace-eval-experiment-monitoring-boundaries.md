---
title: Trace、Eval、Experiment 与 Monitoring：Agent 质量系统的四个层次
date: 2026-09-01
tags:
  - Agent Observability
  - Agent Evaluation
  - Experimentation
description: 区分 Agent Trace、评测、受控实验与生产监控的职责、数据产物和决策边界，避免用过程指标代替质量判断
---

# Trace、Eval、Experiment 与 Monitoring：Agent 质量系统的四个层次

## 要解决的问题

Agent 团队很容易把四类工作混在一起：

- 接入了模型和工具调用日志，就说已经有了 Eval；
- 给 Trace 打了一个分数，就认为已经证明新版本更好；
- 离线评测上升，就认为生产质量必然上升；
- 生产告警正常，就认为 Agent 没有发生行为回归。

这些说法都跳过了关键边界。Trace、Eval、Experiment 与 Monitoring 可以使用同一批运行数据，却回答四个不同问题：

~~~text
Trace       发生了什么？
Eval        这次做得好不好？
Experiment  哪个受控配置更好？
Monitoring  真实流量正在发生什么变化？
~~~

如果四者没有分层，系统会收集大量数据，却仍然无法解释一次修改是否值得发布。

## 核心结论

四层不是四个互相替代的产品模块，而是一条逐步增加语义的证据链：

~~~text
Run
  ↓ 记录事实
Trace
  ↓ 应用任务契约和 Grader
Eval Result
  ↓ 按实验协议聚合候选配置
Experiment Report
  ↓ 发布并观察真实任务分布
Monitoring Signal
  ↓ 抽取新失败
Regression Case
~~~

其中：

- Trace 是事实层，不负责定义成功；
- Eval 是判断层，不自动提供因果结论；
- Experiment 是比较层，必须控制变量；
- Monitoring 是生产反馈层，面对的任务分布会持续变化。

[Anthropic 的 Agent Eval 定义](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)把 Trial 的 Transcript 或 Trace 与最终 Outcome 分开，并把 Task、Grader 和 Evaluation Harness 作为独立组成部分。[OpenAI 的 Agent Eval 指南](https://developers.openai.com/api/docs/guides/agent-evals)也建议先用 Trace 定位工作流问题，再在需要可重复比较时转向 Dataset 和 Eval Run。

## 第一层：Trace 负责还原事实

Trace 是一次 Agent Run 的结构化执行记录。它通常包括：

- 模型调用及其父子关系；
- 工具选择、参数、结果和错误；
- Handoff、Guardrail、审批与人工介入；
- 状态读取、状态修改和产物引用；
- 开始、结束、延迟、Token、缓存和成本；
- Agent、Prompt、工具集、权限与 Harness 版本。

[OpenAI Agents SDK 的 Tracing](https://openai.github.io/openai-agents-python/tracing/)把一次端到端 Workflow 表示为 Trace，并用带开始时间、结束时间、Trace ID 与 Parent ID 的 Span 记录 Agent、Generation、Function、Guardrail 和 Handoff 等操作。

Trace 能回答：

- Agent 为什么选择了某个工具？
- 哪一步开始偏离任务目标？
- 超时发生在模型、工具还是环境？
- 是否出现无效循环或重复调用？
- 风险动作之前是否经过审批？

Trace 本身不能回答：

- 最终任务是否成功；
- 文章是否准确、代码是否正确；
- 某个调用次数是多还是少；
- 新版本是否显著优于旧版本；
- 生产用户是否真正获得了价值。

“工具调用了 8 次”只是事实。只有任务预算规定最多 5 次，或实验显示 8 次导致成本失控时，它才成为质量判断。

## 第二层：Eval 负责执行判断

Eval 把 Evaluation Contract 应用到某次 Trial 的 Trace 与 Outcome 上：

~~~text
Eval Result
  = Grader(Trace, Outcome, Contract)
~~~

它至少应关联：

- task_id：正在评价哪个任务；
- trial_id：这是该任务的第几次独立尝试；
- trace_id：过程证据在哪里；
- outcome_ref：最终环境状态在哪里；
- contract_version：成功标准是什么；
- grader_version：由哪版逻辑判断；
- scorecard：各维度结果和失败原因。

Eval 能回答：

- 必须结果是否形成；
- 禁止动作是否发生；
- 质量 Rubric 是否达标；
- 延迟和成本是否越界；
- 这次失败属于 Agent、Grader 还是基础设施问题。

同一条 Trace 可以被不同 Grader 反复评价。例如，新增引用正确性 Grader 时，不一定要重新运行 Agent；只要原始证据足够，可以对历史 Trace 和 Outcome 重新打分。

这也是为什么 Trace Schema 与 Eval Schema 应分开版本化：事实不应随着评分标准改变而被重写。

## 第三层：Experiment 负责受控比较

Experiment 不是一批 Eval Result 的简单平均。它必须声明：

~~~yaml
experiment:
  question: 新的工具描述是否提升任务成功率
  unit_under_evaluation: toolset_version
  candidates:
    - tools-v3
    - tools-v4
  controlled:
    model: model-a
    prompt: prompt-v7
    harness: harness-v5
    dataset: core-v2
    environment: env-v6
    grader: grader-v4
  trial_protocol:
    trials_per_case: 5
    reset_before_each_trial: true
  primary_metric: task_success_rate
  gates:
    hard_constraint_violations: 0
~~~

Experiment 能回答：

- 候选 B 是否比候选 A 更好；
- 提升是否覆盖大多数任务类别，还是由少数 Case 拉动；
- 成功率、质量、成本和延迟之间有什么权衡；
- 差异是否大于运行噪声；
- 结论允许推广到什么范围。

它不能只凭某条“看起来更聪明”的 Trace 得出结论，也不能把不同 Dataset、环境和 Grader 下的历史分数直接排列。

Experiment 的核心产物不是排行榜，而是一份带控制变量和适用边界的报告。

## 第四层：Monitoring 负责观察真实分布

Monitoring 面对的是已经发布的 Agent 与真实流量。它关注：

- 任务类型和用户输入分布是否改变；
- 成功、失败、人工介入与撤销是否异常；
- 延迟、成本、错误和资源使用是否漂移；
- 某个模型、工具或依赖是否出现区域性故障；
- 新版本是否在特定用户群或长尾任务上退化；
- 是否出现离线 Eval 没有覆盖的新失败。

Monitoring 与 Eval 的主要差异是数据分布：

| 维度 | Eval | Monitoring |
| --- | --- | --- |
| 任务来源 | 版本化任务集 | 真实、持续变化的流量 |
| 环境 | 尽量受控 | 真实依赖与并发 |
| 成功标准 | 预先定义 Contract | 产品指标、风险信号与抽样评价 |
| 主要目标 | 比较与回归 | 漂移、异常和未知失败 |
| 可重复性 | 高 | 有限 |
| 输出 | Case 级得分与报告 | 时间序列、告警、抽样 Trace |

Monitoring 不等于只看 CPU、QPS 和 HTTP 错误。Agent 生产监控还应包含任务级和行为级信号，例如用户修正率、人工接管率、无效循环率、工具失败率、单位成功任务成本和高风险动作。

但生产指标也不能取代 Eval。流量结构、用户行为和外部服务会同时变化，因此一次线上指标波动通常不能直接归因于模型或 Prompt。

## 用同一次文章生成任务理解四层

假设 Agent 的任务是检索公开资料、生成 Markdown、更新导航并完成构建。

### Trace 看到的事实

~~~text
Run
├── Model：制定资料检索计划
├── Tool：搜索官方资料
├── Tool：读取文档
├── Model：生成文章
├── Tool：写入 Markdown
├── Tool：更新索引
├── Tool：执行构建
└── Final：返回完成摘要
~~~

它可以显示构建命令耗时 18 秒、工具调用 11 次，以及某次搜索发生重试。

### Eval 执行判断

- 文件存在且 Frontmatter 合法：通过；
- 分类索引和侧边栏已更新：通过；
- 构建成功：通过；
- 关键结论均有公开一手来源：部分通过；
- 没有私人路径与凭证：通过；
- 工具调用预算不超过 10 次：失败。

### Experiment 比较候选

比较“直接写作”和“先建立证据表再写作”两种 Harness：

- 后者的引用支持率上升；
- Token 增加；
- 总耗时略高；
- 硬约束违反率不变。

这才支持关于工作流设计的结论。

### Monitoring 观察上线结果

上线后可能发现：

- 用户保存文章的比例上升；
- 复杂主题的人工修改率下降；
- 某类网页经常抓取失败；
- 单位成功任务成本超出预算；
- 新出现的资料时效性失败不在离线任务集中。

这些新失败应被抽取为 Regression Case，再进入下一轮 Eval。

## 四层的数据契约

推荐为四层分别保存不可混淆的主键：

~~~yaml
run:
  run_id: run-...
  trace_id: trace-...
  task_id: case-...
  trial_index: 1

eval:
  eval_result_id: eval-...
  run_id: run-...
  contract_version: contract-v2
  grader_version: grader-v4

experiment:
  experiment_id: exp-...
  candidate_id: candidate-b
  eval_result_ids: []
  protocol_version: protocol-v3

monitoring:
  release_id: release-...
  production_trace_id: trace-...
  time_bucket: ...
  segment: ...
~~~

不要把 experiment_id 直接当作 trace_id，也不要把一次生产会话直接塞进离线 Dataset 而不经过清洗、去标识和成功标准补充。

## Trace 与 Eval 为什么必须解耦

### 评分标准会变化

团队可能后来才发现某类引用不可靠，或者新增安全约束。如果 Trace 保留了足够证据，可以重新评分历史运行并比较新旧标准。

### 事实采集和判断具有不同可信度

“工具返回 HTTP 500”是事实；“Agent 不应重试”是与任务和策略有关的判断。二者不应写在同一字段里。

### Grader 也需要被调试

当 Grader 误判时，团队需要回到原始 Outcome 和 Trace 判断是 Agent 失败还是评测器失败。若只保存最终分数，就无法审计。

### 一条 Trace 可以支持多个用途

同一运行记录可以用于：

- 调试单个失败；
- 计算成本和延迟；
- 执行多个 Grader；
- 分析工具选择；
- 构建生产失败聚类；
- 转化为回归 Case。

## Eval 与 Experiment 为什么必须解耦

Eval Result 只描述一次 Trial。Experiment 还需要：

- 候选配置；
- 控制变量；
- Task 分层；
- 重复 Trial；
- 排除规则；
- 聚合方法；
- 不确定性；
- 发布门槛。

如果只比较两次单独 Eval，很容易把采样随机性、环境变化或 Case 差异误认为版本提升。

## Eval 与 Monitoring 如何形成闭环

推荐使用双向通道：

~~~text
Offline Eval ──发布门槛──▶ Production
     ▲                         │
     │                         ▼
Regression Case ◀──失败筛选── Monitoring
~~~

从 Monitoring 回流的失败不能直接原样公开或加入 Dataset。它需要：

1. 去除用户与业务敏感信息；
2. 判断是否能稳定复现；
3. 补充初始环境和目标 Outcome；
4. 明确失败标签和风险级别；
5. 创建能够通过的参考实现或人工判定；
6. 版本化加入 Regression Suite。

## 最小系统架构

不需要一开始就建设完整平台，可以先实现五个稳定接口：

~~~text
Agent Runner
  └── emit Trace + Outcome

Eval Runner
  └── read Contract + Trace + Outcome
      └── emit Eval Result

Experiment Runner
  └── schedule Candidates × Cases × Trials
      └── emit Experiment Report

Monitoring Pipeline
  └── aggregate Production Signals
      └── emit Alerts + Failure Samples

Regression Curator
  └── convert Failure Sample into Versioned Case
~~~

存储产品可以替换，但这些数据语义不应由某个 Dashboard 决定。

## 选择信号时的判断规则

| 问题 | 应优先进入 |
| --- | --- |
| 某次工具调用了什么参数？ | Trace |
| 最终数据库状态是否正确？ | Eval Outcome Grader |
| 新 Prompt 是否优于旧 Prompt？ | Experiment |
| 过去一小时失败率是否异常？ | Monitoring |
| 某个失败为什么发生？ | Trace + Outcome |
| 是否值得发布？ | Experiment + Release Gate |
| 用户的新失败是否需要长期防回归？ | Monitoring → Regression Case |

## 常见误区

### 把可观测性平台直接当 Eval 平台

可观测性平台擅长记录和查询事件，但除非加入任务、成功契约、Grader 和实验协议，否则它仍然只提供事实。

### 用 Trace 长度评价质量

更短的 Trace 可能更高效，也可能是 Agent 过早放弃。必须结合 Outcome 与任务难度判断。

### 用一个 LLM 总结 Trace 就叫评测

模型总结可以帮助阅读，但没有结构化 Rubric、版本、校准和失败标签时，无法支持稳定回归。

### 把线上指标上涨全部归因于新模型

真实流量、产品入口、依赖和用户行为都在变化。需要 A/B、灰度或其他受控设计才能增强因果解释。

### 只保留聚合指标

没有可回到 Case、Trial、Trace 和 Outcome 的关联，平均值无法被审计，也无法转化为回归资产。

## 一页式边界检查表

- Trace 是否只记录事实，并能关联最终 Outcome？
- Eval 是否声明 Contract 与 Grader 版本？
- Experiment 是否写清被测单元和控制变量？
- 每个 Case 是否运行了足够的独立 Trial？
- Monitoring 是否同时覆盖系统、任务、成本和风险信号？
- 聚合指标是否能下钻到具体 Trace？
- 生产失败是否有去标识和回归转化流程？
- Grader 变化后是否可以重新评价历史运行？
- 发布门槛是否与生产告警阈值分开？
- 是否明确每个结论允许推广到哪里？

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Task、Trial、Trace、Outcome、Grader 与 Harness 的边界。
- [OpenAI：Evaluate agent workflows](https://developers.openai.com/api/docs/guides/agent-evals) — 从 Trace grading 走向 Dataset 与可重复 Eval Run。
- [OpenAI Agents SDK：Tracing](https://openai.github.io/openai-agents-python/tracing/) — Trace、Span、Agent、Model、Tool、Guardrail 与 Handoff 的实际结构。
- [OpenTelemetry：Traces](https://opentelemetry.io/docs/concepts/signals/traces/) — Trace、Span、Event、Link 与 Status 的通用可观测性模型。
