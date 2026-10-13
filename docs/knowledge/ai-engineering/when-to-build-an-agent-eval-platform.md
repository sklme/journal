---
title: 什么时候才值得建设 Agent Eval 平台
date: 2026-10-13
tags:
  - Agent Evaluation
  - Platform Engineering
  - Developer Experience
  - Quality Infrastructure
description: 从脚本、共享 Runner 到完整质量平台，判断 Agent Eval 何时应该平台化，以及哪些契约必须先于 UI 和基础设施
---

# 什么时候才值得建设 Agent Eval 平台

## 要解决的问题

团队一旦开始做 Agent Eval，很容易画出宏大的平台蓝图：

~~~text
Agent Registry
Capability Registry
Dataset Registry
Trace System
Evaluation Engine
Experiment Manager
Regression Gate
Production Feedback
Model / Tool Selector
~~~

这些组件最终可能都有价值，但过早建设平台常带来另一种失败：

- 花几个月做 UI，仍没有高质量 Case；
- 提供通用 Runner，却无法复现真实任务环境；
- 保存大量 Trace，却没有可信 Outcome Grader；
- Dashboard 很漂亮，但指标分母和版本不清楚；
- 抽象层阻止产品团队快速修改 Eval；
- 平台团队承担所有 Case 编写，领域专家反而退出；
- 维护成本超过自动化节省的工作。

Eval 平台不是评测能力的起点。它是稳定协议、重复负担和跨团队复用达到一定规模后的结果。

## 核心判断

> 当评测的主要瓶颈从“我们不知道测什么、怎样判定”变成“同一套已验证流程被多个团队重复、容易出错且无法治理”时，才值得平台化。

平台应放大成熟实践，而不是用基础设施掩盖未解决的方法问题。

## 从最小闭环开始

早期团队通常只需要：

~~~text
Versioned Dataset
  +
Evaluation Contract
  +
Simple Runner
  +
Deterministic / Calibrated Graders
  +
Structured Result
  +
Git + CI
~~~

20–50 个来自真实需求和失败的 Case、一个可复现脚本和一份清晰报告，往往比空的平台框架更有价值。

最小目录：

~~~text
agent-eval/
├── cases/
├── fixtures/
├── graders/
├── protocols/
├── runner.ts
├── report.ts
└── results/
~~~

只有当这套流程真正被使用，才能看清哪些部分稳定、哪些部分应该抽象。

## 先判断瓶颈属于方法还是基础设施

| 症状 | 主要问题 | 是否应该先建平台 |
| --- | --- | --- |
| 团队说不清成功是什么 | Evaluation Contract | 否 |
| Case 含糊、不可解 | Dataset 质量 | 否 |
| Judge 与专家长期不一致 | Grader 校准 | 否 |
| 环境无法稳定复现 | Harness / Fixture | 先修执行契约 |
| 每次都手工拼同样命令 | 重复 Toil | 是，适合 Runner 化 |
| 多团队各自维护重复 Dataset | 发现与版本治理 | 是 |
| 实验无法追溯模型/Prompt/工具版本 | Manifest 和 Registry | 是 |
| 发布经常漏跑关键 Suite | CI / Release Gate | 是 |
| 生产失败无法回流 | Feedback Workflow | 是 |
| 只有一个 Agent、每月跑两次 | 规模不足 | 通常否 |

平台只能降低执行、发现和治理成本，不能自动把模糊目标变成好评测。

## 一个渐进成熟模型

### Level 0：人工探索

~~~text
手工运行 Agent
人工查看输出
记录少量失败
~~~

适合产品原型。风险是结果不可复现、成功标准隐含。

升级信号：同一个任务需要反复手测，或团队开始争论“版本到底有没有变好”。

### Level 1：仓库内 Eval

~~~text
Versioned Case + Fixture
Local Runner
Deterministic Grader
Structured JSON Result
CI Smoke Suite
~~~

这是大多数团队应该尽快达到的状态。Case、Grader 与产品代码一起 Review，协议易于修改。

升级信号：运行时间增长、环境类型增多、多人重复管理依赖与报告。

### Level 2：共享执行服务

~~~text
Queue
Worker Pool
Environment Provisioner
Artifact Store
Run Manifest
Result API
~~~

平台先解决“可靠运行”，而不是先做 Dashboard。关键产物是可重跑的 Run Manifest 和不可混淆的 Artifact。

升级信号：多个团队需要同一种调度、隔离、缓存、成本和权限控制。

### Level 3：Experiment 与 Release Gate

~~~text
Dataset Registry
Agent Bundle Registry
Paired Experiment
Statistical Analysis
Scorecard
Regression Gate
Approval + Rollback
~~~

此时平台开始直接消费评测证据做发布决策。门槛、缺失策略和不确定性必须是版本化配置，而不是 Dashboard 上临时选择。

升级信号：发布频率高、改动来源多、人工判断不一致或漏检代价明显增加。

### Level 4：生产反馈与策略选择

~~~text
Production Monitoring
Incident Intake
Regression Case Promotion
Distribution Drift
Model / Tool Routing Evidence
Continuous Calibration
~~~

平台连接离线 Eval 与真实使用，但仍不能把生产数据默认复制进 Dataset。需要完整的数据治理和人工 Triage。

升级信号：生产规模足以提供稳定信号，且组织已经能治理隐私、风险和在线实验。

## 什么时候平台化的收益开始超过成本

### 信号一：重复劳动按规模线性增长

典型 Toil：

- 手工启动相同环境；
- 复制配置和凭证；
- 拼接模型、Prompt 与工具版本；
- 下载 Trace 并合并结果；
- 重复生成相同报告；
- 在发布前提醒每个团队跑 Suite；
- 人工追踪无效运行和补跑。

如果工作是重复、可预测、没有持久价值并随运行量线性增长，就适合自动化。若每次任务都需要新的领域判断，它更像专家工作，不应被错误平台化。

### 信号二：一致性错误比算法问题更常见

例如：

- 使用了错误 Dataset 版本；
- Baseline 和 Candidate 的预算不同；
- 忘记冻结工具或模型版本；
- 无效运行被不同团队用不同规则排除；
- 同名指标拥有不同分母；
- 报告无法回到原始 Evidence。

平台可以通过 Schema、Manifest、Policy-as-Code 和不可变 Artifact 消除这些错误。

### 信号三：共享能力有稳定接口

适合共享的通常是：

- Case/Fixture/Grader 包格式；
- Agent Bundle 和 Environment Contract；
- 运行调度与隔离；
- Artifact、Lineage 与权限；
- Trial Accounting；
- 统计库和报告模板；
- CI/发布 Gate 接口。

不适合过早统一的通常是：

- 每个领域的成功定义；
- 开放质量 Rubric；
- 业务风险容忍度；
- 仍快速变化的 Agent Loop；
- 未验证的通用评分 Prompt。

### 信号四：平台有明确消费者和 SLO

“以后大家会用”不是需求。至少应有：

- 两个以上真实产品团队；
- 已运行的 Case 与 Grader；
- 可量化的当前 Toil 和错误；
- 愿意迁移的 Owner；
- 明确的服务等级与支持边界。

## 平台的最小核心契约

### Agent Bundle Contract

~~~yaml
agent_bundle:
  id: research-agent-v12
  model_id: <MODEL_ID>
  prompt_digest: sha256:<PROMPT_DIGEST>
  harness_digest: sha256:<HARNESS_DIGEST>
  tool_bundle_digest: sha256:<TOOL_DIGEST>
  policy_bundle_digest: sha256:<POLICY_DIGEST>
~~~

### Case Package Contract

~~~yaml
case_package:
  id: research-source-grounding-042
  version: 3
  instruction_ref: artifact://case/instruction.md
  fixture_ref: artifact://case/fixture.tar
  contract_ref: artifact://case/contract.yaml
  grader_bundle_ref: artifact://case/graders/
  risk_level: medium
  data_classification: sanitized
~~~

### Environment Contract

~~~yaml
environment:
  image_digest: sha256:<IMAGE_DIGEST>
  cpu: 4
  memory_gib: 8
  network_policy: snapshot
  clock: frozen
  reset: before_each_trial
  external_writes: sandbox_only
~~~

### Run Manifest

~~~yaml
run:
  id: run-2026-0042
  agent_bundle: research-agent-v12
  dataset_version: research-regression-v8
  protocol_version: repeated-trial-v3
  environment_version: eval-env-v6
  trials_per_case: 5
  created_by: release-gate
  code_revision: <REVISION>
~~~

### Result Envelope

~~~yaml
trial_result:
  case_id: research-source-grounding-042
  trial_id: trial-03
  task_outcome: PASS
  non_task_status: null
  metrics:
    groundedness: {evidence: SCORABLE, value: 1}
    cost_usd: {evidence: SCORABLE, value: 0.18}
  trace_ref: artifact://restricted/run-2026-0042/trial-03
  grader_bundle_version: grader-v5
~~~

UI、队列、数据库和云厂商可以变化，这些契约才是可迁移的核心。

## 一个合理的平台架构

~~~text
Authoring Plane
├── Dataset / Case Registry
├── Grader Registry
├── Agent Bundle Registry
└── Policy and Review Workflow

Execution Plane
├── Scheduler
├── Environment Provisioner
├── Agent Adapter
├── Tool Sandbox
└── Grader Workers

Evidence Plane
├── Run Manifest Store
├── Trace / Artifact Store
├── Metric Store
└── Lineage and Audit Log

Decision Plane
├── Experiment Analysis
├── Scorecard
├── Release Gate
├── Canary Guardrail
└── Rollback Integration
~~~

这些平面可以由不同产品组合，不必从第一天就建成一个单体平台。

## 控制面与执行面要分离

控制面负责：

- 声明运行什么；
- 校验版本与权限；
- 调度和记录状态；
- 生成不可变 Manifest；
- 决定 Gate。

执行面负责：

- 创建隔离环境；
- 运行 Agent 和 Grader；
- 采集最小 Evidence；
- 上传 Artifact；
- 上报受信结果。

执行 Worker 不应自行改变 Dataset、Metric 或 Gate。控制面也不应直接拥有生产工具权限。

## Registry 不是一个“上传文件”页面

Registry 的价值在于身份、版本和兼容关系：

~~~text
Dataset v8
  requires Environment Contract >= v6
  uses Grader Bundle v5
  supports Agent Adapter v3
  approved for release-gate-v4
~~~

至少提供：

- 不可变版本；
- 内容 Digest；
- Owner 和生命周期；
- 数据分类；
- 依赖与兼容矩阵；
- Review 和 Promotion 状态；
- Lineage；
- 弃用与迁移信息。

只存一个可覆盖的 `latest` 会破坏复现性。

## 平台不应夺走领域所有权

健康的分工通常是：

| 角色 | 所有权 |
| --- | --- |
| 平台团队 | Runner、隔离、Artifact、Schema、统计库、权限 |
| 产品/领域团队 | Case、成功契约、风险和业务权重 |
| 专家/运营 | 金标、Rubric、失败 Triage |
| 安全与隐私 | 数据和风险政策、High-risk Gate |
| Release Owner | 发布决定与例外 |

平台团队可以提供模板和校验，但不应成为所有 Eval 内容的瓶颈。

## Build、Buy 还是 Hybrid

### 优先使用现成工具的部分

- 通用 Trace 接入；
- 实验 UI；
- 基础 Dataset 管理；
- LLM Judge 调用；
- Dashboard；
- Queue 和普通 Worker 调度。

### 更可能需要自建的部分

- 真实产品环境 Fixture；
- 权限与副作用沙箱；
- 可信 Outcome Grader；
- 内部 Release Gate；
- 特殊数据治理和地域要求；
- 生产 Failure → Regression Case 工作流；
- Agent Bundle 与工具策略的组织契约。

### 评估矩阵

| 维度 | Buy 倾向 | Build 倾向 |
| --- | --- | --- |
| Agent 类型 | 通用聊天/检索 | 深度状态化、专用工具 |
| 环境 | 普通 API | 私有系统、复杂 Fixture |
| 数据 | 低敏、可托管 | 高敏、地域与合规约束 |
| Grader | 标准指标 | 可信终态和业务不变量 |
| 规模 | 快速起步 | 稳定大规模与定制调度 |
| 团队 | 平台人力有限 | 有长期平台 Owner |
| 差异化 | 工具不是壁垒 | Eval 资产和发布策略是壁垒 |

多数团队最终是 Hybrid：购买通用能力，自建任务环境、Grader 和治理契约。

## 不要把供应商数据模型当成唯一事实来源

即使使用外部平台，也应保留可导出的开放内部模型：

~~~text
Internal Eval Schema
  ↓ Adapter A → Vendor A
  ↓ Adapter B → Local Runner
  ↓ Adapter C → CI
~~~

至少可以导出：

- Case 与 Contract；
- Agent Bundle Manifest；
- Trial Result；
- Grader Evidence；
- Artifact 引用；
- Scorecard 和 Gate 决议。

这能避免 Metric 定义、历史结果和发布流程被锁在单一 UI 中。

## 平台自身也需要 SLO

建议监控：

| 指标 | 说明 |
| --- | --- |
| Queue wait p95 | 从请求到获得 Worker 的时间 |
| Valid Trial completion rate | 排除 Agent Outcome 后的平台有效率 |
| Environment provisioning failure | Fixture/容器失败率 |
| Grader error rate | `GRADER_ERROR` 占比 |
| Reproduction rate | 相同 Manifest 重跑一致性 |
| Artifact completeness | Trace、Outcome、Grader Evidence 对账 |
| Cost per valid Trial | 平台资源效率 |
| Gate decision latency | 从提交到可行动结论的时间 |
| Data policy violation | 禁止字段、越权访问、保留超期 |

平台失败不能被算成 Agent 失败。自身可靠性差的平台会制造错误发布结论。

## 用经济模型评估平台投资

可以用简单模型讨论，而不是凭感觉：

~~~text
Annual Benefit
  = avoided manual toil
  + avoided duplicated infrastructure
  + reduced incident loss
  + faster safe releases
  + faster model/tool migration

Annual Cost
  = build cost
  + operation and on-call
  + migration and support
  + compute and storage
  + governance and compliance
  + opportunity cost
~~~

很多收益难以精确货币化，但至少应记录基线：

- 每次评测的人时；
- 每月运行次数；
- 因配置不一致导致的重跑；
- 发布等待时间；
- 生产回归数量与影响；
- 多团队重复建设成本。

如果没有这些基线，平台完成后也无法证明价值。

## 推荐建设顺序

### 第一步：标准化 Artifact，不做大 UI

- Case Package；
- Run Manifest；
- Trial Result；
- Grader Evidence；
- Scorecard。

### 第二步：把重复执行变成共享 Runner

- 隔离环境；
- 队列与并发；
- 超时和重试；
- Artifact 上传；
- Trial Accounting。

### 第三步：接入 Git 与 CI

- 快速 Smoke Suite；
- 夜间完整 Suite；
- 模型/Prompt/Tool 变更触发；
- 失败 Artifact 链接；
- 可重跑 Manifest。

### 第四步：增加 Experiment 与 Gate

- Baseline/Candidate 配对；
- 统计区间；
- 多维 Scorecard；
- 发布审批与例外；
- Canary 和 Rollback。

### 第五步：连接生产反馈

- Monitoring；
- Incident Intake；
- Regression Case Promotion；
- 数据漂移；
- Grader 校准与 Dataset 健康度。

每一步都应独立产生价值，而不是等待“大平台完工”。

## 反模式

### 先做 Dashboard，后定义指标

同名指标分母不同，漂亮图表只会更快传播错误结论。

### 先设计通用 DSL，后找用户

没有真实 Case 的抽象往往遗漏环境、权限、证据和错误处理。

### 平台替所有团队编写 Eval

会失去领域知识并形成排队瓶颈。平台应降低贡献门槛，而不是集中内容所有权。

### 只支持最终文本

Agent 评测需要环境状态、工具行为、Handoff、预算和副作用证据。

### 把平台错误记成 Agent 失败

这会污染指标并导致错误模型选择。必须区分 `FAIL`、`GRADER_ERROR`、`INFRA_ERROR` 和 `UNSCORABLE`。

### 每个团队都建一个“临时平台”

当重复 Runner、Schema 和 Artifact 已经稳定出现，应及时抽取共享层，同时保留领域扩展点。

### 平台建成后停止读 Trace

自动化指标不会替代人工抽查、专家校准和生产反馈。平台可能规模化错误 Grader。

## 一份平台投资决策记录

~~~yaml
decision:
  proposal: shared_agent_eval_runner
  current_state: repository_local_eval

  consumers:
    active_teams: 3
    active_agents: 5
    monthly_valid_trials: 18000

  measured_pain:
    manual_hours_per_month: 120
    configuration_error_reruns_per_month: 14
    median_release_wait_hours: 18

  stable_contracts:
    case_package: true
    run_manifest: true
    trial_result: true
    grader_bundle: true

  first_scope:
    - isolated_execution
    - artifact_lineage
    - trial_accounting
    - ci_integration
  explicitly_out_of_scope:
    - universal_quality_judge
    - production_auto_rollout
    - model_router

  success_after_90_days:
    manual_hours_reduction: 0.50
    configuration_error_reduction: 0.80
    valid_trial_completion_lcb_minimum: 0.99
    migrated_teams_minimum: 2

  review_date: 2027-01-13
~~~

限制第一阶段范围，往往比画完整终局架构更能建立可信平台。

## 本系列最终形成的质量闭环

~~~text
Evaluation Contract
  ↓
Trace + Reproducible Trial
  ↓
Dataset + Grader
  ↓
Paired Experiment
  ↓
Scorecard + Release Gate
  ↓
Shadow / Canary / Monitoring
  ↓
Production Failure
  ↓
Sanitized Regression Case
  └──────────────────────→ Dataset
~~~

平台真正可能形成壁垒的不是新的 Trace UI，而是：

- 能代表真实价值的任务环境；
- 可信 Outcome 与 Grader；
- 经治理的失败数据；
- 可解释的比较实验；
- 风险匹配的发布策略；
- 能够持续关闭反馈环的组织流程。

## 适用边界

- 小团队和低频 Eval 不必追求完整平台，仓库脚本和 CI 可能长期足够。
- 高风险系统即使运行量不大，也可能因审计、隔离和治理要求提前需要平台能力。
- Buy/Build 选择会随产品、供应商和法规变化，应定期复核。
- 平台指标不能替代产品 Outcome、用户研究和专家判断。
- 自动发布 Gate 必须有可解释证据、例外治理和可靠 Rollback。
- 本文给出决策框架，不是固定组织结构或供应商选型结论。

## 公开参考

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — 从 20–50 个真实 Case 起步、长期维护 Eval，以及简单脚本、开源框架与商业平台的选择边界。
- [OpenAI：Getting started with datasets](https://developers.openai.com/api/docs/guides/evaluation-getting-started) — Dataset、Grader、多 Variant 评测和规模化 Evals 的基础工作流。
- [OpenAI：Evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) — 任务设计、人工标签、自动评分与持续校准。
- [Google SRE：Eliminating Toil](https://sre.google/sre-book/eliminating-toil/) — 识别随规模线性增长、可自动化且没有持久价值的重复工作。
- [Google SRE：Release Engineering](https://sre.google/sre-book/release-engineering/) — 可复现、自动化、一致和可审计的发布系统原则。
- [Google SRE Workbook：Canarying Releases](https://sre.google/workbook/canarying-releases/) — 将自动评估接入小流量、限时发布与回滚流程。
- [Google SRE：Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) — 面向可行动症状、SLO 和监控系统可靠性的设计原则。
- [NIST：Artificial Intelligence Risk Management Framework 1.0](https://doi.org/10.6028/NIST.AI.100-1) — AI 风险治理、测量、部署后监控和责任分配。
