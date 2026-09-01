---
title: 如何让 Agent 评测实验可复现
date: 2026-09-01
tags:
  - Agent Evaluation
  - Reproducibility
  - Experimentation
description: 用 Run Manifest、环境快照、Trial 隔离和基础设施失败分类，让 Agent 评测结果可以重跑、解释与公平比较
---

# 如何让 Agent 评测实验可复现

## 要解决的问题

同一套 Agent、同一组任务和同一条命令，今天与明天可能得到不同结果。原因不只来自模型采样，还可能来自：

- 模型服务实际路由或版本变化；
- Prompt、Harness、工具描述和权限变化；
- 依赖、容器镜像和操作系统变化；
- CPU、内存、磁盘、并发与超时变化；
- 网络、搜索结果和第三方 API 状态变化；
- 缓存、遗留文件、数据库和前一次 Trial 的副作用；
- Grader、Judge 模型或 Rubric 变化；
- 重试、排除和失败统计规则变化。

如果这些条件没有被记录，团队只能看到分数变化，却无法判断它来自 Agent 能力、实验环境还是评测器。

## 核心结论

Agent Eval 的“可复现”不应被理解为每次生成完全相同的文字。对于非确定性系统，更实用的目标是：

~~~text
Reproducible Agent Eval
  = 可恢复的实验条件
  + 相互独立的 Trial
  + 可审计的执行证据
  + 稳定的结果分布
  + 明确的失败分类
~~~

也就是说：

- 能够知道当时究竟运行了什么；
- 能够从相同初始状态重新执行；
- 能够把 Agent 失败与基础设施失败分开；
- 多次运行的统计差异处于可解释范围；
- 环境或 Grader 变化时，历史结果不会被错误比较。

[Anthropic 的 Agent Eval 指南](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)要求每个 Trial 从干净、隔离的环境开始，避免遗留文件、缓存、资源耗尽和跨 Trial 共享状态制造相关失败或虚假提升。

## 可复现性的四个级别

不要把“设置了随机种子”当作完整可复现性。可以把目标分成四层：

| 级别 | 目标 | 适合场景 |
| --- | --- | --- |
| R0 可审计 | 能还原配置、环境和证据 | 所有 Eval |
| R1 可重放 | 能从相同快照重新运行单个 Case | 失败调试 |
| R2 可比较 | 候选在相同协议下重复运行 | 模型与 Harness 实验 |
| R3 统计稳定 | 重跑后结论与区间基本一致 | 发布与长期趋势 |

对于远程模型和实时外部服务，字节级完全重放通常不可实现。此时至少要达到 R0、R2 和 R3，并明确哪些外部变量无法冻结。

## Agent 实验的变量地图

每次 Trial 至少受六层变量影响：

~~~text
Task
  数据、输入、初始状态、时间条件

Agent
  模型、Prompt、Harness、工具、权限、记忆

Evaluation
  Contract、Grader、Judge、聚合与排除规则

Environment
  镜像、依赖、资源、文件、数据库、缓存

External
  网络、第三方 API、搜索索引、模型服务

Execution
  并发、超时、重试、随机种子、调度顺序
~~~

只固定模型名称而忽略其余五层，无法形成公平实验。

## Run Manifest：每次 Trial 的实验身份证

Run Manifest 应在 Trial 开始前生成，并在结束后补充实际值与证据引用。下面是一份可复用模板：

~~~yaml
schema_version: run-manifest-v1

identity:
  run_id: run-20260901-001
  experiment_id: exp-tool-description-v2
  candidate_id: candidate-b
  task_id: case-research-017
  trial_index: 3
  created_at: 2026-09-01T02:00:00Z

task:
  dataset_id: research-core
  dataset_version: dataset-v4
  case_version: case-v3
  input_ref: artifact://cases/research-017/input
  fixture_ref: artifact://fixtures/research-017
  expected_contract_version: contract-v2

agent:
  agent_version: agent-v6
  harness_version: harness-v8
  prompt_version: prompt-v12
  prompt_sha256: ...
  toolset_version: tools-v7
  tool_schema_sha256: ...
  permission_profile: profile-public-read
  memory_snapshot_ref: artifact://memory/empty-v1

model:
  provider: provider-a
  requested_model: model-a
  resolved_model: model-a-2026-08
  parameters:
    temperature: 0
    top_p: 1
    max_output_tokens: 8000
    seed: 42
  provider_fingerprint: unavailable

evaluation:
  grader_bundle_version: graders-v5
  deterministic_tests_sha256: ...
  judge_model: judge-a-2026-08
  judge_prompt_version: judge-prompt-v3
  aggregation_version: aggregation-v2
  exclusion_policy_version: exclusion-v1

environment:
  image: example/agent-eval
  image_digest: sha256:...
  os: linux-amd64
  dependency_lock_sha256: ...
  cpu_limit: 4
  memory_limit_mb: 8192
  disk_limit_mb: 20480
  timezone: UTC
  locale: C.UTF-8
  clock_mode: fixed
  network_policy: allowlisted
  cache_policy: cold

execution:
  timeout_seconds: 600
  max_agent_turns: 40
  max_model_calls: 20
  max_tool_calls: 60
  retry_policy: no-harness-retry
  parallelism: 1
  environment_reset: before_each_trial

evidence:
  trace_ref: artifact://traces/run-20260901-001
  outcome_ref: artifact://outcomes/run-20260901-001
  grade_ref: artifact://grades/run-20260901-001
  environment_after_ref: artifact://snapshots/run-20260901-001
~~~

Manifest 中的版本应尽量指向不可变内容：

- Git commit；
- OCI image digest；
- 文件 SHA-256；
- Dataset、Contract 和 Grader 的显式版本；
- 供应商提供的模型快照或 Fingerprint；
- 无法固定时明确写 unavailable，而不是省略。

## 声明值与实际值都要记录

配置文件声明使用 model-a，不代表远程服务实际执行的版本一定可知。环境声明 4 核，也不代表运行时没有被其他任务抢占。

推荐记录：

~~~yaml
model:
  requested: model-a
  resolved: model-a-2026-08
  provider_fingerprint: ...

resources:
  declared:
    cpu: 4
    memory_mb: 8192
  observed:
    cpu_throttled_ms: 0
    peak_memory_mb: 6120
    disk_free_mb_at_start: 15000
~~~

当声明值和实际值不一致时，产生 configuration_drift 或 infrastructure_warning，而不是静默运行。

## 每个 Trial 都必须从已知状态开始

推荐的执行协议：

~~~text
1. 创建一次性隔离环境
2. 校验镜像与依赖 Digest
3. 加载 Case Fixture
4. 设置时钟、区域、权限和网络策略
5. 清空或加载指定缓存
6. 执行环境健康检查
7. 运行一个 Trial
8. 冻结最终状态与 Trace
9. 在 Agent 环境外执行 Grader
10. 销毁环境并确认清理完成
~~~

“一个 Trial 一个环境”是最容易推理的默认值。为了节省启动成本复用环境时，必须证明重置过程能够恢复等价状态。

### 为什么 Grader 最好在 Agent 环境外运行

如果 Agent 能读取测试文件、修改 Grader 或观察其他 Trial 的产物，评测可能被污染。外部 Grader 可以：

- 使用只读 Outcome Snapshot；
- 拥有独立权限；
- 防止 Agent 修改成功标准；
- 让 Grader 失败与 Agent 失败分开记录；
- 支持对历史 Outcome 重新评分。

## 环境重置契约

可以为每类环境定义 reset contract：

~~~yaml
reset_contract:
  version: reset-v3
  before_each_trial:
    filesystem:
      strategy: recreate_from_snapshot
      snapshot_digest: sha256:...
    database:
      strategy: restore_fixture
      fixture_version: fixture-v4
    cache:
      strategy: cold
    clock:
      strategy: fixed
      instant: 2026-09-01T00:00:00Z
    network:
      strategy: allowlist
      fixtures_version: network-v2
    credentials:
      strategy: ephemeral_test_identity
  after_each_trial:
    - collect_outcome
    - revoke_test_identity
    - destroy_environment
    - verify_no_resources_left
~~~

Reset 过程本身也需要测试。可以让一个校验程序在 Agent 启动前计算环境 Fingerprint：

~~~yaml
environment_fingerprint:
  files_sha256: ...
  database_fixture_sha256: ...
  dependency_lock_sha256: ...
  tool_schema_sha256: ...
  clock: ...
  network_fixture_version: ...
~~~

同一 Case 的 Trial 若起始 Fingerprint 不一致，应被标记为不可直接比较。

## 缓存是实验变量，不是纯优化

Agent 系统可能同时存在：

- 模型供应商 Prompt Cache；
- 检索缓存；
- HTTP 缓存；
- 工具结果缓存；
- 包管理器和构建缓存；
- Agent 记忆；
- 操作系统文件缓存。

缓存会影响延迟、成本，甚至改变可见信息。实验必须声明：

~~~yaml
cache_policy:
  model_prompt_cache: record_only
  retrieval_cache: cold
  http_cache: disabled
  build_cache: warm_from_snapshot
  agent_memory: empty
~~~

如果产品真实运行依赖热缓存，应建立单独的 warm-cache Suite，而不是在同一报告中混合冷启动和热启动 Trial。

## 资源配置必须固定并观测

[Anthropic 对 Agent 编码评测的实验](https://www.anthropic.com/engineering/infrastructure-noise)发现，Terminal-Bench 2.0 在最低与最高资源配置之间可相差 6 个百分点。原因是 Agent 会安装依赖、运行测试、启动进程并在多轮中迭代；运行环境已经成为解题能力的一部分。

至少固定：

- CPU 配额及其执行方式；
- 内存与 Swap；
- 磁盘空间和 I/O；
- GPU 类型与数量，如果使用；
- 单 Case 超时与全局超时；
- 进程和文件描述符上限；
- 同机并发数量；
- 网络带宽与连接限制。

还要记录观测值，例如 CPU Throttling、OOM、磁盘不足和容器启动失败。声明相同的 4 核，在不同限流实现下仍可能不等价。

## 并发会改变实验

并发运行可以缩短 Eval 时间，却可能引入：

- 模型服务限流；
- 共享 CPU、内存和磁盘争抢；
- 第三方 API 配额竞争；
- 缓存互相预热；
- 时间相关任务顺序变化；
- 环境资源耗尽导致相关失败。

因此 Experiment Protocol 应固定 parallelism。若为了效率必须扩缩容，应验证不同并发级别下基线得分与基础设施失败率没有系统性变化。

Trial 的随机顺序也很重要。按候选 A 全部跑完再跑 B，容易把时间、服务波动和缓存差异与候选绑定。可以对 Case 和候选交错或随机化，同时记录调度顺序。

## 网络与外部服务如何处理

### 能冻结的，使用版本化 Fixture

当任务重点是 Agent 的规划、工具选择和输出质量时，可以使用：

- 固定 API 响应；
- 可回放 HTTP Fixture；
- 本地搜索索引；
- 版本化网页快照；
- 合成数据库。

Fixture 应保留真实 Schema、错误类型和延迟分布，而不是只返回理想结果。

### 不能冻结的，显式记录快照

对于必须访问实时网页或真实服务的任务，至少记录：

- 请求时间；
- URL 与内容摘要；
- 响应状态和关键 Header 摘要；
- 外部服务版本；
- 区域和网络策略；
- 失败是否可重试。

这类 Eval 更接近集成监控，不应与完全受控的能力 Eval 混合排名。

### 建立两套 Suite

~~~text
Controlled Suite
  验证 Agent 能力与回归
  外部信息尽量快照化

Live Integration Suite
  验证真实服务兼容性
  单独报告外部依赖失败
~~~

## 时间是隐藏输入

“获取今天的价格”“查询最近新闻”“创建下周会议”都依赖当前时间、时区和日历规则。若不固定时钟，同一 Case 的正确 Outcome 会变化。

推荐 Task 显式声明：

~~~yaml
temporal_context:
  now: 2026-09-01T09:00:00+08:00
  timezone: Asia/Shanghai
  locale: zh-CN
  holiday_calendar_version: calendar-v2
~~~

如果任务就是测试实时信息能力，则保留真实时钟，但必须动态生成成功标准，并把不同时间窗口分开比较。

## 模型随机性如何处理

设置 temperature=0 或 seed 并不能保证远程模型完全确定，因为：

- 服务端实现和权重可能更新；
- 并行计算存在数值差异；
- 工具和检索结果会变化；
- Agent 后续路径会放大早期微小差异；
- Seed 可能只是尽力而为。

合理做法是：

1. 记录所有可用采样参数与服务端 Fingerprint；
2. 每个 Case 运行多个独立 Trial；
3. 报告成功率、方差和失败分布；
4. 区分 pass@k 与 pass^k；
5. 用同一 Trial Protocol 比较候选；
6. 不把一次重跑成功覆盖原始失败。

Seed 的主要价值是增强调试与近似重放，不是把 Agent 变成确定性函数。

## Grader 也是实验变量

结果变化可能来自 Agent，也可能来自：

- 测试用例新增或删除；
- Rubric 文案变化；
- Judge 模型变化；
- Judge Prompt 变化；
- 聚合权重变化；
- Pass 阈值变化；
- 基础设施失败排除规则变化。

因此每个 Eval Result 都要记录：

~~~yaml
grading:
  contract_version: contract-v2
  grader_bundle_version: graders-v5
  judge_model: judge-a-2026-08
  judge_prompt_sha256: ...
  aggregation_version: aggregation-v2
  exclusion_policy_version: exclusion-v1
~~~

Grader 变化后有两种选择：

- 用新 Grader 重评所有可重评的历史 Outcome；
- 建立新的结果序列，明确新旧分数不可直接比较。

不要把不同 Grader 版本的分数拼成一条趋势线。

## 基础设施失败必须单独分类

[SWE-bench 的 Evaluation Guide](https://www.swebench.com/SWE-bench/guides/evaluation/)使用容器化 Docker 环境提高跨平台一致性，并在结果中区分：

- 已被正常评分的 resolved 与 unresolved；
- 无法产生结果的 instance error；
- 可能的基础设施失败；
- 环境或补丁都可能导致的模糊失败；
- 未停止容器和未清理镜像等残留资源。

Agent Eval 至少应有以下终态：

~~~yaml
trial_status:
  - graded_success
  - graded_failure
  - agent_error
  - grader_error
  - infrastructure_error
  - invalid_task
  - cancelled
  - excluded_with_reason
~~~

禁止把 infrastructure_error 自动算成 Agent 失败，也禁止静默排除。报告中应同时展示：

- 计划 Trial 数；
- 实际启动数；
- 正常评分数；
- 各类未评分数；
- 排除原因；
- 是否重跑以及重跑规则。

## 参考解与环境健康检查

在评测候选 Agent 前，先运行两类检查：

### Environment Smoke Test

- 文件和数据库可读写；
- 依赖可用；
- 工具 Schema 与实现一致；
- 网络 Fixture 可访问；
- 时钟与权限正确；
- Grader 能执行。

### Reference Solution

使用已知可通过的参考实现完成 Task，再运行所有 Grader。它证明：

- Task 可解；
- Fixture 正确；
- Grader 与任务说明一致；
- 环境资源足够；
- 成功标准没有隐藏条件。

如果参考解失败，应先修复 Eval，而不是解释为模型能力不足。

## 如何验证环境重置真的有效

可以设计一组 Harness 自测：

1. 在 Trial A 写入哨兵文件，Trial B 开始前必须不存在；
2. 在数据库创建记录，下一 Trial 必须恢复 Fixture；
3. 让工具缓存一个错误结果，冷缓存 Trial 不得命中；
4. 人为触发 OOM，下一 Trial 的资源状态必须正常；
5. 并行运行多个 Trial，确认身份和工作目录隔离；
6. 让 Agent 尝试读取 Grader 文件，权限应拒绝；
7. 重复运行参考解，结果应保持稳定；
8. 中途取消 Trial，清理流程仍应执行。

这些测试属于 Evaluation Harness 的回归套件。

## 一份实验执行协议

~~~yaml
protocol:
  version: experiment-protocol-v3

  scheduling:
    randomize_case_order: true
    interleave_candidates: true
    parallelism: 4

  trials:
    per_case: 5
    independent_environment: true
    retry_agent_failure: false
    retry_infrastructure_failure: once
    keep_original_attempt: true

  exclusions:
    allowed:
      - invalid_task
      - confirmed_infrastructure_error
    require_reason: true
    freeze_before_analysis: true

  grading:
    outside_agent_environment: true
    blind_candidate_identity: true

  reporting:
    include_case_level_results: true
    include_failure_taxonomy: true
    include_cost_and_latency: true
    include_confidence_interval: true
~~~

排除规则必须在看见候选结果前冻结。否则团队可能无意识地删除不利于偏好候选的失败。

## 可复现性验收标准

一个成熟的 Eval 系统应能通过以下检查：

### Configuration replay

给定 run_id，可以恢复 Manifest、Dataset、Contract、Grader、环境镜像和工具版本。

### Trial independence

任何 Trial 都不能读取前一 Trial 的文件、缓存、数据库修改、记忆或身份状态。

### Baseline stability

相同候选在相同协议下重跑，主要指标的区间应重叠，失败类型分布没有无法解释的系统性漂移。

### Failure attribution

每个未通过 Trial 都能归入 Agent、Task、Grader、Infrastructure 或 Unknown，并保留证据。

### Environment parity

Eval Agent 与生产 Agent 的 Harness、工具和权限语义足够接近；如果使用 Mock，文档明确它没有覆盖什么。

### Historical comparability

任何趋势点都能说明 Dataset、Grader 和环境是否与前一个点相同；不相同时标记断点。

## 常见误区

### “温度设为 0，所以可复现”

这只控制一个采样参数，无法固定模型服务、工具、环境和外部数据。

### “使用 Docker，所以环境一致”

容器镜像只是起点。CPU、内存、网络、挂载、缓存、并发、内核和外部服务仍会变化。

### “失败了就自动重跑”

重跑会改变指标含义。必须保留原始尝试，并只按预先定义的规则重试基础设施失败。

### “多跑几次就能消除环境问题”

若多个 Trial 共享同一资源瓶颈，它们不是独立样本。数量增加不会修复相关噪声。

### “只保存最终分数”

没有 Manifest、Trace、Outcome 和失败分类，分数无法重放、审计或解释。

### “真实网络更接近生产，所以更可信”

真实网络提高外部有效性，也降低可重复性。应把受控能力评测与 Live Integration 分开报告。

## 一页式可复现性检查表

- 是否为每次 Trial 生成版本化 Run Manifest？
- 模型、Prompt、Harness、工具、权限是否都能回到不可变内容？
- Dataset、Contract、Grader、Judge 与聚合规则是否版本化？
- 每个 Trial 是否从经过 Fingerprint 校验的干净环境开始？
- 文件、数据库、缓存、记忆、身份和时钟是否重置？
- CPU、内存、磁盘、并发和超时是否固定并观测？
- 网络与外部服务是 Fixture、快照还是实时依赖？
- 是否区分冷缓存与热缓存 Suite？
- 是否记录请求模型与实际解析模型？
- Agent、Grader 与基础设施失败是否分别统计？
- 重试与排除规则是否在实验前冻结？
- 参考解和环境 Smoke Test 是否在候选运行前通过？
- 重跑基线时，结论和失败分布是否保持稳定？
- 历史趋势是否标记 Dataset、Grader 或环境断点？

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Trial 隔离、稳定环境、重复运行与 Trace 审查。
- [Anthropic：Quantifying infrastructure noise in agentic coding evals](https://www.anthropic.com/engineering/infrastructure-noise) — CPU、内存和资源执行方式如何改变 Agent 基准结果。
- [SWE-bench：Evaluation Guide](https://www.swebench.com/SWE-bench/guides/evaluation/) — 容器化评测、缓存控制、清理和基础设施失败分类。
- [WebArena: A Realistic Web Environment for Building Autonomous Agents](https://proceedings.iclr.cc/paper_files/paper/2024/hash/4410c0711e9154a7a2d26f9b3816d1ef-Abstract-Conference.html) — 真实且可复现的网页环境与功能正确性评测。
- [W3C Trace Context](https://www.w3.org/TR/trace-context/) — 跨服务传播运行因果上下文的标准。
