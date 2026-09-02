---
title: 一个健康的 Agent 评测集如何分层
date: 2026-09-02
tags:
  - Agent Evaluation
  - Eval Dataset
  - Data Governance
description: 用用途、数据切分与来源生命周期三条轴组织 Agent 评测集，并建立去重、防泄漏、抽样、版本和流转规则
---

# 一个健康的 Agent 评测集如何分层

## 要解决的问题

评测集刚建立时，往往只是一个不断追加 Case 的目录：

- 产品经理放入常见用户任务；
- 工程师放入刚修复的 Bug；
- 研究人员放入当前模型做不到的难题；
- 安全团队放入越权与攻击样本；
- 线上监控又不断带回新的失败。

这些 Case 都有价值，但它们回答的问题不同。全部混在一起计算一个平均通过率，会产生几个反直觉现象：

- 新增难题后，Agent 没变，分数却突然下降；
- 大量简单任务掩盖了低频但严重的安全失败；
- 团队已经针对固定 Case 调试许多轮，却仍把结果称为未知任务上的能力；
- 同一事故的十个改写被当成十种能力，失败机制被重复计权；
- Holdout 被日常调试看到后，依然被当作独立的最终检验；
- 线上只挑投诉和异常，却声称样本代表整体生产质量；
- Agent 能在网络或环境里找到公开 Benchmark 的答案，得分实际测量了检索。

健康的评测集不只是“题目足够多”，而是每个 Case 为什么存在、谁看过、从哪里来、代表多少真实流量、何时进入和退出，都能够被解释。

## 核心结论

不要把 Core、Capability、Regression、Stress、Safety、Holdout 和 Online 塞进同一个互斥枚举。它们至少混合了三种不同语义：

~~~text
用途轴
  Core / Capability / Regression / Stress / Safety

数据切分轴
  Dev / Test / Holdout

来源与生命周期轴
  Spec / Production / Incident / Expert / Red-team / Synthetic
  Candidate / Qualified / Active / Graduated / Quarantined / Retired
~~~

同一个 Case 可以同时是：

~~~yaml
purpose: safety
split: holdout
source: production
state: active
~~~

也可以是：

~~~yaml
purpose: regression
split: dev
source: incident
state: active
~~~

这套多轴模型是本文给出的工程建议，不是行业标准。名称、比例和门槛可以按团队调整，但用途、可见性与来源生命周期不应被压成一列。

## 为什么必须使用多条轴

评测数据至少承担四种职责：

1. 帮助开发者发现和定位问题；
2. 证明候选版本没有破坏已有能力；
3. 探索能力边界与未知风险；
4. 估计 Agent 在真实任务分布上的表现。

这些职责对数据的要求彼此冲突。Dev 需要可见、反馈快；Holdout 需要少看、少查询。Regression 应接近全通过；Capability 如果也接近全通过，就失去了区分方案的价值。线上随机样本适合估计常态，但极低频高危事件必须主动过采样。

[Anthropic 的 Agent Eval 实践](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)明确区分 Capability 与 Regression：前者包含当前仍然困难的任务，后者应接近全通过；能力任务稳定掌握后，可以毕业到持续运行的回归集。

因此，评测集的结构要直接表达“这条证据支持什么判断”，而不是只表达“文件放在哪个目录”。

## 第一条轴：Case 的用途

### Core：代表正常价值

Core 回答：

> Agent 能否稳定完成目标用户最常见、最重要的正常任务？

Core 不是“最简单的题”，也不是纯粹按请求频率排序。它应综合真实频率、用户价值、失败影响、主要场景覆盖和可重复评分能力。

例如，研究 Agent 的 Core 可以覆盖：针对明确问题检索公开资料、区分一手来源、将引用对应到结论、在预算内形成报告，以及对未知内容保留意见。

| 规则 | 要求 |
| --- | --- |
| 进入 | 属于当前产品承诺，映射到真实结果，任务与成功标准清楚，Grader 已验证，已记录任务族和线上权重 |
| 保持 | 定期与最新生产分布比较，检查饱和、漂移和 Grader 有效性 |
| 退出 | 需求废弃后 Retired；重复、泄漏、不可解或评分错误时 Quarantined；语义变化时创建新版本 |

Core 的目标是代表价值，不是永久不变。一个已经偏离线上分布的稳定 Core，只会稳定地产生错误信心。

### Capability：为能力增长保留坡度

Capability 回答：

> 当前 Agent 的能力边界在哪里，哪种改动能让它继续前进？

它可以来自计划中的新工作流、更长的任务链、更复杂的工具协调、真实失败的一般化版本或专家设计的 Challenge。难度必须来自目标能力，而不是含糊任务、坏环境或错误 Grader。

[BIG-bench](https://arxiv.org/abs/2206.04615)刻意收集被认为超出当时模型能力的任务，用于探测和外推能力边界。难题的价值不是拉低总分，而是为进步保留测量空间。

| 规则 | 要求 |
| --- | --- |
| 进入 | 对应明确的未来能力假设；专家能完成；基线未饱和；工具、预算和 Elicitation 协议已声明 |
| 毕业 | 多个版本、多次 Trial 持续达到预设可靠性，人工抽查无漏洞、无泄漏且 Grader 公平 |
| 去向 | 产品常态能力进入 Core；已稳定掌握的脆弱点进入 Regression |
| 退出 | 长期不再计划支持则 Retired；不可解或评分异常则 Quarantined；饱和后提高难度或替换 |

“持续多久”和“多高算稳定”应按风险与样本量决定。连续三个发布周期达到预设门槛可以作为工程复审触发器，但不是通用标准。

### Regression：防止已经修复的问题复发

Regression 回答：

> Agent 是否仍然能处理过去已经解决的问题？

来源包括生产事故、用户报告、开发缺陷、Capability 毕业项，以及 Prompt、工具、权限或 Harness 升级造成的倒退。

原始事件不能直接复制进评测集，应先转换：

~~~text
原始事件
  -> 去除隐私与无关上下文
  -> 最小化并复现失败机制
  -> 写明预期结果与禁止动作
  -> 验证修复前失败、修复后通过
  -> 加入 Regression
~~~

| 规则 | 要求 |
| --- | --- |
| 进入 | 失败已确认，可从已知状态复现，能区分修复前后，检查真实结果而非模仿修复实现 |
| 保持 | 目标通过率接近预期高可靠性；失败直接进入发布调查，不用平均分抵消 |
| 退出 | 需求废弃、外部依赖永久消失、同根因 Case 合并，或由更强 Case 完整替代 |
| 禁止 | 不得因为 Case 经常失败、影响发布就删除 |

Regression 会自然膨胀。应按失败机制和任务族合并代表样本，而不是永久保留同一事故的所有轻微改写。

### Stress：观察系统如何退化

Stress 回答：

> 当负载、上下文、依赖或资源接近边界时，Agent 是否仍然可控？

Stress 不等于更难的 Capability。Capability 考察复杂目标能否完成；Stress 显式改变运行条件，例如：

- 超长上下文、深层任务链或临近最大轮次；
- 工具超时、限流、部分失败和异常返回；
- 慢网络、有限 CPU、内存或磁盘；
- 依赖返回过期、矛盾或不完整数据；
- 多 Agent 并发修改同一状态；
- 冷缓存、严格成本预算、中途取消与恢复。

[NIST Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)建议通过对抗角色扮演、红队和 Chaos Testing 发现异常或未预料的失败模式。对 Agent 来说，工具和环境是系统的一部分，压力变量必须进入 Run Manifest。

| 规则 | 要求 |
| --- | --- |
| 进入 | 明确压力变量及其部署依据；有正常对照；预先定义安全退化、重试、升级和清理行为 |
| 指标 | 任务成功、副作用、状态一致性、人工升级、超时、尾部延迟、成本与恢复 |
| 退出 | 条件不可能发生、模拟失真、已成为日常常态，或实际属于恶意攻击 |
| 迁移 | 日常常态进入 Core 或 Regression；安全攻击进入 Safety |

### Safety：守住不能被平均的底线

Safety 回答：

> 面对误用、攻击、高风险动作和权限边界时，系统是否保持可接受风险？

它可以覆盖越权写入或删除、Prompt Injection、敏感数据泄露、跨用户访问、绕过审批、危险工具组合、伪造执行结果，以及超出能力边界时能否安全失败。

[NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)要求定期评价安全、隐私、安全韧性和部署场景表现，并持续跟踪新出现的风险。

| 规则 | 要求 |
| --- | --- |
| 进入 | 映射到资产、威胁、影响或政策；声明攻击者能力与 Agent 权限；有硬失败和严重度 |
| 对照 | 同时放入合法相邻请求，避免把“全部拒绝”误判为安全 |
| 评分 | 严重风险作为 Gate；开放判断由领域专家校准；拒答与失守分开报告 |
| 退出 | 威胁、权限或政策正式改变，或被更强样本替代；泄漏和失真先 Quarantined |

一次严重越权不能被大量正常任务的高分抵消。零次观察到违规也不等于风险为零；小样本下真实违规率的置信上界仍可能很高。

## Challenge 不必成为独立用途层

Challenge 更适合作为生成方式和难度标签：

~~~yaml
purpose: capability
generation_mode: human_model_adversarial
difficulty: frontier
~~~

[Dynabench](https://dynabench.org/paper.pdf)让人类围绕当前模型动态寻找失败，再把新数据用于训练与评测。这能持续暴露弱点，但样本天然偏向“能击败当前模型”的区域，不代表正常线上分布。

Challenge 可以丰富 Capability、Stress 或 Safety。它回答的是“已知边界上的表现”，不能未经加权就回答“整体用户成功率”。

## 第二条轴：数据切分与可见性

### Dev：用于高频迭代

Dev 用于写 Prompt 和工具说明、调试 Harness 与 Grader、查看逐 Case Trace、做失败归因和验证修复。开发者可以查看任务、参考证据和详细评分。

代价是：Dev 上的提升只证明系统对已知开发问题的适配，不能单独证明未知任务泛化。所有用途都可以有 Dev，包括 Safety Dev 和 Stress Dev。

### Test：用于稳定比较

Test 用于 CI、夜间回归、候选成对比较、发布 Gate 和长期 Slice 趋势。它可以对团队可见，也可以只暴露有限细节。

关键不是绝对保密，而是不能一边反复根据 Test 调整系统，一边把它当成从未看过的数据。

[Google 的数据切分指南](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets)指出，反复根据同一 Test 结果修改系统，会让 Test 逐渐磨损；应使用 Validation 数据迭代，再用 Test 做最终确认，并在磨损后用新数据刷新。

每次 Test 查询、返回粒度和由结果触发的修改都应记录。长期被逐题调试的 Test 已经是事实上的 Dev。

### Holdout：限制访问的最终检查

Holdout 回答：

> 在尽量不受当前开发决策影响的新任务上，结论是否仍成立？

Holdout 不是第六种用途。它应镜像 Core、Capability、Stress 和 Safety 等用途，避免最终检验只剩一类容易保密的题。

推荐控制：

- Case、答案和 Grader 细节最小授权；
- Agent 无法通过浏览、仓库历史、缓存或环境文件找到答案；
- 日常开发不运行；
- 候选、阈值和实验协议冻结后才运行；
- 默认只返回聚合结果或预先批准的 Slice；
- 记录每次访问、运行目的、返回信息和剩余查询预算；
- 一旦逐题结果影响开发，就降低其独立性等级。

OpenAI 在 [GPT-4 Technical Report](https://cdn.openai.com/papers/gpt-4.pdf)的考试评测中使用成对的 nonholdout 与 holdout：方法在 nonholdout 上迭代，holdout 原则上只运行一次得到最终分数。

[自适应数据分析研究](https://arxiv.org/abs/1411.2664)说明，后续分析不断依据同一 Holdout 的历史结果产生时，传统统计保证会被削弱。实践中不一定要实现差分隐私式 Reusable Holdout，但必须承认查询不是免费的。

### 切分协议

不要先写死一个比例，再试图把所有 Case 填满。更可靠的顺序是：

1. 定义要估计的目标总体和关键 Slice；
2. 按任务族而不是单条 Case 分组；
3. 计算每个关键 Slice 所需样本量；
4. 将完整任务族分配到 Dev、Test 或 Holdout；
5. 检查各 Split 的覆盖、难度、来源和时间分布；
6. 冻结 Test 与 Holdout Manifest；
7. 记录后续每次查询与迁移。

对第一版小型评测集，约 60% Dev、25% Test、15% Holdout 可以作为容量规划起点，但不是统计定律。若高风险 Slice 在 Holdout 只有两条 Case，比例正确也没有足够精度。

## 第三条轴：来源与生命周期

### 来源必须显式记录

| 来源 | 主要价值 | 主要偏差 |
| --- | --- | --- |
| product_spec | 对齐产品承诺 | 可能遗漏真实使用方式 |
| manual_check | 快速沉淀开发经验 | 依赖少数人的习惯 |
| production_random | 估计真实分布 | 低频风险覆盖不足 |
| user_feedback | 发现未知问题 | 自选择并偏向严重失败 |
| incident | 防止重要事故复发 | 易重复计权同一机制 |
| domain_expert | 覆盖专业标准 | 成本高，可能脱离日常频率 |
| red_team | 暴露对抗弱点 | 不代表自然流量 |
| synthetic | 扩展组合与边界 | 可能模式单一或复制答案 |
| public_benchmark | 获得外部参照 | 污染、饱和与 Harness 不匹配 |

来源不是质量标签。生产样本可能含糊，专家题也可能不真实，合成题可能有效，公开 Benchmark 也可能已经污染。

### Online 是候选流，不是正式用途层

Online 应被实现为持续候选队列：

~~~text
线上事件
  -> 合法性与隐私过滤
  -> 随机 / 风险 / 异常三类采样
  -> 去标识化与最小化
  -> Candidate Pool
  -> 去重、标注、复现和 Grader 验证
  -> Core / Regression / Stress / Safety
  -> Dev / Test / Holdout
~~~

[Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)指出，完整理解 Agent 需要组合自动 Eval、生产监控、用户反馈、A/B 测试、人工 Trace 复审和系统性人评；用户反馈稀疏且自选择，生产信号真实但嘈杂。

Online 至少保留三条通道：

1. 可计算选择概率的随机样本，用于估计总体；
2. 风险与稀有 Slice 的过采样，用于发现低频高损失问题；
3. 事故、投诉和异常触发样本，用于发现新失败机制。

三条通道未经校正不能直接混成一个通过率。

### 状态机

~~~text
Candidate
  -> Qualified
  -> Active
       -> Graduated
       -> Quarantined
       -> Retired
  -> Archived
~~~

| 状态 | 含义与规则 |
| --- | --- |
| Candidate | 刚收集或生成，尚未证明可解、无歧义、可评分，不进入正式分数 |
| Qualified | 来源授权、去标识化、专家可解、Grader 正反例、去重泄漏和环境重置均已通过 |
| Active | 已进入某个用途和 Split，有 Owner、Review SLA 与当前版本 |
| Graduated | Capability 稳定掌握后迁移到 Core 或 Regression，保留迁移依据 |
| Quarantined | 泄漏、重复、Flaky、Grader 错误、不可解、过期或授权不明，暂不计分 |
| Retired | 当前决策不再使用，记录原因、替代项和对历史趋势的影响 |
| Archived | 保存不可变历史证据，不再参与当前执行 |

Regression 不因“妨碍发布”退出；Safety 不因“太难”退出；Holdout 暴露后应降级或替换。所有退出都要保留 Tombstone，而不是让历史 Case 无声消失。

## 先按任务族切分，再按 Case 切分

随机打散单条 Case 往往不够。以下内容即使文本不同，也可能属于同一任务族：

- 同一事故的多种改写；
- 同一文档换几个问题；
- 同一代码库相邻 Issue；
- 同一网页流程替换实体；
- 同一模板或合成批次；
- 同一安全攻击的轻微 Prompt 变体。

若姐妹样本跨越 Dev 与 Holdout，开发者可能已经学会模板，Holdout 只是在测同族插值。

推荐记录：

~~~yaml
family:
  family_id: family-tool-timeout-recovery
  source_event_id: incident-017
  template_id: timeout-recovery-v2
  generator_batch_id: null
  entity_cluster_id: null
  temporal_bucket: 2026-Q3
~~~

切分约束：

~~~text
同一 family_id 只能进入一个 Split
同一 source_event_id 默认只能进入一个 Split
同一 generator_batch_id 不得跨 Dev 与 Holdout
~~~

[GroupKFold](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupKFold.html)体现了同一原则：以不重叠 Group 切分，而不是假设每一行彼此独立。

## 去重与泄漏检查

去重至少分四层：

| 层级 | 检查方式 | 需要防止的问题 |
| --- | --- | --- |
| 精确重复 | 规范化输入、Fixture、答案和 Grader 后计算摘要 | 相同 Case 跨 Split |
| 局部重复 | 长公共子串、Token Shingle、MinHash | 只改少量上下文的复制 |
| 语义重复 | 嵌入召回，再由规则或人工判断 | 改写、翻译、同模板 |
| 因果重复 | 按失败机制与根因聚类 | 一个根因被多场景重复计权 |

精确跨 Split 重复应为零。保留同根因的多个场景可以提高覆盖，但报告应同时给出 Case 级和失败机制级结果。

[Deduplicating Training Data Makes Language Models Better](https://aclanthology.org/2022.acl-long.577/)发现常用语言数据集中存在近重复和长重复片段，训练与验证重叠会降低评测准确性；精确子串与近似文档匹配具有互补价值。

仅用 N-gram 不足以发现改写污染。[关于 Rephrased Samples 的研究](https://arxiv.org/abs/2311.04850)表明，简单改写和翻译可以绕过字符串匹配，却仍显著抬高 Benchmark 表现。

### Benchmark Overfitting 的防护

Benchmark Overfitting 不只发生在模型训练。开发者看到逐题结果后修改 Prompt、工具、规则和 Harness，也是在对数据做自适应优化。

- 分开 Dev、Test 与 Holdout，并按任务族切分；
- 最小暴露 Holdout，设查询预算；
- 在运行 Holdout 前冻结候选和决策规则；
- 不返回不必要的逐 Case 细节；
- 记录每次由 Test 或 Holdout 结果触发的改动；
- 用新时间窗口或原创私有任务轮换；
- 扫描网络、Fixture、Git 历史、缓存和环境中的答案；
- 公开 Benchmark 与私有业务 Eval 分开报告；
- Benchmark 饱和或污染后停止把它当主证据。

OpenAI 对 [SWE-bench Verified 污染的分析](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/)发现，前沿模型能够复现部分原始修复或题目特定信息，接触过问题的模型也更容易通过欠充分指定的测试。公开问题和答案会进入训练数据，因此需要额外污染检查和原创私有任务。

可联网 Agent 还面临运行时污染：

- 屏蔽直接托管答案和题解的站点；
- 从环境和 Git 历史中移除 Gold Artifact；
- 记录浏览轨迹，标记检索到题目特定答案的 Trial；
- 为能力推理与开放检索分别建立协议；
- 必要时比较 Browsing 与 No-browsing 条件。

若目标本来就是“借助公开资料完成任务”，访问相关知识不是作弊；访问该评测题的隐藏答案才是。污染判断必须回到评测 Claim。

## 线上抽样：代表性与风险覆盖分开

### 先定义目标总体

~~~yaml
target_population:
  unit: completed_user_task
  product_scope: supported_workflows
  time_window: rolling_28_days
  locales: [zh-CN, en-US]
  exclusions:
    - internal_test_traffic
    - confirmed_automation_spam
~~~

没有 Target Population，就无法判断样本是否有代表性。

常用 Strata 包括任务类型、用户目标、输入长度、工具组合、权限等级、语言地区、新老用户、结果状态、风险严重度和时间窗口。

[NIST 的抽样方案指南](https://itl.nist.gov/div898/handbook/ppc/section3/ppc332.htm)强调，分层与随机化可减少系统性抽样误差并提高估计精度。

### 在层内随机，并记录选择概率

1. 冻结采样框和时间窗口；
2. 给每条记录计算 Stratum；
3. 在 Stratum 内使用可复现随机种子；
4. 记录每条样本的入选概率；
5. 对缺证据、无响应和过滤项记录原因；
6. 估计总体时应用相应权重。

“挑一些看起来有代表性的例子”没有可审计的选择概率，往往只反映审阅者记得什么。

### 过采样后必须加权

假设高风险任务只占流量的 1%，为了观察风险，在 Eval 中占到 20%。这有利于发现问题，却不能直接用样本中的 20% 估计总体。

~~~yaml
sampling:
  channel: risk_oversample
  stratum: high_risk_write
  population_count: 1000
  sampled_count: 100
  inclusion_probability: 0.1
  analysis_weight: 10
~~~

总体指标可按选择概率的倒数加权：

~~~text
weighted_rate
  = sum(weight_i * outcome_i) / sum(weight_i)

weight_i
  = 1 / inclusion_probability_i
~~~

同时报告：

- 加权总体估计：回答真实流量平均表现；
- 未加权 Slice：回答重要风险区域的表现；
- Safety Gate：回答是否触碰不能平均的底线。

## 样本量不能由固定比例决定

样本量取决于指标、可接受误差、置信水平、最小可检测变化、预期成功率、Agent 与 Grader 随机性、任务族相关性，以及每个关键 Slice 是否需要独立结论。

对简单二项通过率，粗略估计公式为：

~~~text
n ≈ z² * p * (1 - p) / e²
~~~

在 95% 置信水平、最保守的 p = 0.5 下：

- 误差约 ±10 个百分点，需要约 97 个独立样本；
- 误差约 ±5 个百分点，需要约 385 个独立样本。

这只适用于简单随机、近似独立的样本，不是 Agent Eval 的通用最低数。[NIST 的样本量说明](https://www.itl.nist.gov/div898/handbook/ppc/section3/ppc333.htm)要求从目标精度、总体变异、成本和风险出发；若分层，需要分别检查各 Stratum。

Agent 同任务族内的 Case 往往相关，同一 Case 的多次 Trial 也不是新的独立任务：

- 不把五次 Trial 当成五个独立业务场景；
- 置信区间和 Bootstrap 优先按任务族聚类；
- 比较候选时在同一批 Case 上成对运行；
- 多 Trial 同时报告 Case 覆盖和 Trial 可靠性；
- 小样本通过率使用 Wilson 或精确二项区间。

[NIST 的二项置信区间指南](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm)提醒，小样本或极少失败时，普通对称正态近似可能不准确。

例如，30 个 Safety Trial 中没有违规，并不证明违规率为零；简单 95% 单侧上界仍约为 10%。低频严重风险需要更大样本、定向红队和机制性保障。

## 难度分布需要持续管理

~~~text
easy      多数可靠候选稳定通过
medium    候选之间有明显区分
hard      当前偶尔通过
frontier  当前几乎不能完成
~~~

难度必须绑定 Agent、Harness、预算和时间，因为模型升级后它会变化。

- Core 以真实频率和价值为主；
- Capability 保留 Medium、Hard 和 Frontier 的坡度；
- Regression 主要位于高可靠区；
- Stress 与 Safety 按压力和风险覆盖；
- Holdout 镜像关键难度 Slice；
- Online 发现现有难度模型之外的新区域。

[HELM](https://arxiv.org/abs/2211.09110)通过场景分类和多指标评测强调：广覆盖仍要承认遗漏，准确率也不能替代鲁棒性、公平、风险和效率。分层的目标是暴露差异，不是制造另一个总分。

## 版本与可比性

Dataset、Case、Fixture、Contract、Grader 和 Sampling Plan 应分别版本化：

~~~yaml
versions:
  dataset: 3.2.0
  case: 2.1.0
  fixture: 4.0.0
  contract: 2.0.0
  grader_bundle: 5.3.1
  sampling_plan: 2.1.0
~~~

可采用以下工程约定：

- Major：任务含义、切分、Grader 或聚合改变，分数不再直接可比；
- Minor：新增 Qualified Case 或 Slice，同时保留旧固定面板；
- Patch：只修正文档和不影响评分的元数据。

这不是通用 Semantic Versioning 标准，而是让团队明确“何时不可比”。一个错别字如果改变任务含义，就不是 Patch。

[OpenAI Evals 的构建文档](https://github.com/openai/evals/blob/main/docs/build-eval.md)建议修改 Eval 时提升版本，使相同 Eval 名称运行相同模型时仍有可复现语义。

[Google Data Cards](https://research.google/pubs/data-cards-purposeful-and-transparent-dataset-documentation-for-responsible-ai/)把来源、采集与标注、预期用途、评测方法和影响性能的决策视为跨生命周期的核心事实。数据文档应与数据一起维护。

不要原地覆盖历史。若 Grader Bug 影响旧结论，应隔离受影响 Case，发布新版本，声明哪些结果失效，并在可行时重跑基线。

## Dataset Manifest 模板

~~~yaml
schema_version: eval-dataset-manifest-v1

dataset:
  id: research-agent-eval
  version: 3.2.0
  parent_version: 3.1.0
  created_at: 2026-09-02T00:00:00Z
  frozen_at: 2026-09-02T08:00:00Z
  owner: eval-platform
  status: active

claim:
  target_system: research-agent
  target_population: supported-public-research-tasks
  decision_use: [release_gate, capability_tracking]
  out_of_scope:
    - private-database-research
    - unrestricted-autonomous-publishing

taxonomy:
  purpose: [core, capability, regression, stress, safety]
  split: [dev, test, holdout]
  state:
    - candidate
    - qualified
    - active
    - graduated
    - quarantined
    - retired

split_policy:
  unit: family_id
  dev:
    detail_access: full
    use: iterative_development
  test:
    detail_access: controlled
    use: continuous_release_comparison
  holdout:
    detail_access: restricted
    use: frozen_final_check
    query_budget: 4
    result_detail: aggregate_and_approved_slices

sampling_plan:
  population_window: rolling_28_days
  strata: [task_type, locale, toolset, risk_level]
  channels:
    - production_random
    - risk_oversample
    - incident_triggered
  weight_field: analysis_weight
  random_seed_ref: artifact://sampling/seed-v3

quality_gates:
  require_owner: true
  require_provenance: true
  require_contract: true
  require_human_solvable: true
  require_grader_positive_negative_tests: true
  exact_cross_split_duplicates: 0
  unknown_usage_authority: 0

leakage_controls:
  exact_hash: enabled
  substring_match: enabled
  near_duplicate_search: enabled
  semantic_review: enabled
  public_answer_search: controlled
  environment_answer_scan: enabled
  last_audited_at: 2026-09-02T07:00:00Z

reporting:
  primary_metrics:
    - population_weighted_task_success
    - case_macro_success
    - multi_trial_reliability
  required_slices: [purpose, task_type, risk_level, locale]
  gates: [critical_regressions, severe_safety_violations]
  uncertainty:
    interval: wilson_or_cluster_bootstrap
    confidence_level: 0.95

cases:
  - id: case-source-verification-017
    version: 2.1.0
    purpose: core
    split: test
    state: active
    source: production_random
    family_id: family-source-verification
    contract_version: 2.0.0
    grader_bundle_version: 5.3.1
    analysis_weight: 8.4
    risk_level: medium
    last_reviewed_at: 2026-09-01
    next_review_at: 2026-12-01
~~~

Manifest 不包含真实用户内容、凭证或受限答案。敏感 Artifact 应放在独立受控系统，以引用和内容摘要关联。

## 健康度面板

| 维度 | 建议指标 |
| --- | --- |
| 覆盖 | 任务族覆盖、生产加权覆盖、关键 Slice 覆盖、Unknown 比例、来源集中度 |
| 难度 | Core 区分度、Capability 坡度、Regression 可靠性、饱和比例、人类基线差距 |
| 数据质量 | 精确与语义重复、跨 Split 冲突、不可解、歧义、Grader 误判、Flaky 排除 |
| 独立性 | Holdout 查询预算、逐题暴露、公开答案命中、Test 自适应查询、数据新鲜度 |
| 统计 | 置信区间宽度、Slice 有效样本量、最大任务族权重、多 Trial 方差、人机一致性 |
| 生命周期 | Candidate 转化时间、Quarantined 停留、逾期复审、Capability 毕业和替代完整性 |

少数条件可以作为绝对不变量：

~~~text
精确跨 Split 重复 = 0
未授权 Holdout 访问 = 0
来源或授权未知的 Active Case = 0
严重 Safety Gate 违规 = 0
~~~

其余阈值应绑定产品风险、样本量和成本，不要照搬别人的百分比。

## 建议运行节奏

| 时机 | 运行内容 |
| --- | --- |
| 每个 Pull Request | Core Smoke、相关 Regression、关键 Safety 不变量、Schema 与泄漏静态检查 |
| 每夜或定期 | 完整 Core 与 Regression、主要 Capability、常规 Stress、多 Trial 与人审抽样 |
| 发布候选 | 冻结协议后成对跑 Test，完整 Safety Gate，相关 Stress，满足条件后运行 Holdout |
| 每周或每月 | Online 三通道抽样、资格评审、权重更新、Holdout 暴露审计、饱和与污染轮换 |

高成本层可以低频运行，但关键 Safety 和 Regression 不能因成本高而消失。可以建立 Fast 与 Full 两档，同时保持 Contract 语义一致。

## Case 进入检查表

- Case 要回答哪一个明确问题？
- purpose、split、source、state 是否分别记录？
- 是否属于已有任务族或失败机制？
- 目标用户、部署场景和评测 Claim 是否明确？
- 两位领域审阅者能否独立判断成功？
- 可信人类或参考 Agent 能否完成？
- Outcome、Constraints、Quality、Budget、Reliability 和 Risk 是否有 Contract？
- Grader 是否通过正例、反例、边界与绕过样本？
- Trial 环境能否从干净状态重置？
- 是否检查精确、局部、语义和因果重复？
- 同任务族是否跨越 Dev、Test 与 Holdout？
- Agent 能否从网络、Fixture、Git 历史或缓存找到答案？
- 来源、许可、同意和隐私处理是否明确？
- 线上样本的选择概率和权重是否可追溯？
- Case、Fixture、Contract 与 Grader 是否独立版本化？
- Owner、复审日期和退出条件是否明确？

## 退出与迁移检查表

- 是毕业、隔离、替换、废弃还是只改元数据？
- 变化是否破坏历史分数可比性？
- 是否需要提升 Dataset Major 版本？
- 是否保留旧 Case 与旧 Grader 的不可变快照？
- Capability 应进入 Core 还是 Regression？
- 重复 Case 合并后是否仍保留场景覆盖？
- Holdout 是否因暴露而降级或替换？
- Quarantined 是否从所有主分母排除？
- 退出是否经过相应产品或风险 Owner 批准？
- 是否记录替代项、退出原因和受影响报告？

## 常见误区

| 误区 | 后果 | 修正 |
| --- | --- | --- |
| Holdout 是一种任务类型 | Safety 与 Holdout 被迫二选一 | 将用途与 Split 分开 |
| Online 原样进入正式集 | 隐私、偏差、无真值、不可复现 | 先进入 Candidate 流 |
| 各类数量相等就是平衡 | 不代表真实流量或风险 | 明确总体、概率和权重 |
| 新增难题后继续比较旧总分 | Aggregate 失去可比性 | 提升版本，保留共同面板 |
| 只做字符串去重 | 改写、同模板和同根因泄漏 | 增加语义与因果聚类 |
| 零次 Safety 失败就是零风险 | 忽略不确定性和威胁覆盖 | 报告区间并做定向红队 |
| 为稳定趋势永不更新数据 | 固定但过期 | 同时维护固定与当前面板 |
| Regression 只增不减 | 重复计权、成本膨胀 | 合并代表项并正式 Retire |

## 适用边界

本文适合长期维护自身 Agent Eval Dataset 的团队，尤其适用于工具调用、外部状态修改、模型或 Harness 比较、生产反馈和高风险 Gate 场景。

它不能替代法律合规审查、专业安全红队、严格临床或金融研究设计、统计专家复核、生产监控、A/B 测试、用户研究，以及对 Grader 本身的独立验证。

Eval Dataset 只能支持其设计 Claim。离线 Mock 成功不能自动外推为生产成功；私有 Holdout 高分也不能证明所有未知风险均已覆盖。

## 最终判断

一个健康的 Agent 评测集应能回答五个问题：

~~~text
为什么测？
  Core / Capability / Regression / Stress / Safety

谁看过？
  Dev / Test / Holdout

从哪里来？
  Spec / Production / Incident / Expert / Red-team / Synthetic

怎样流转？
  Candidate / Qualified / Active / Graduated / Quarantined / Retired

分数代表谁？
  Target Population / Inclusion Probability / Weight / Uncertainty
~~~

Core 代表正常价值，Capability 保留进步空间，Regression 守住已修复问题，Stress 检查退化，Safety 守住底线；Dev 支持迭代，Test 支持稳定比较，Holdout 检查未知泛化，Online 持续把真实世界的新问题送入候选流。

当这些轴、版本、权重和流转规则都可审计时，Eval Dataset 才从一堆题目变成可以长期维护的质量资产。

## 公开参考资料

- [Anthropic：Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — Capability、Regression、Trial、生产监控、用户反馈和长期维护。
- [OpenAI：GPT-4 Technical Report](https://cdn.openai.com/papers/gpt-4.pdf) — nonholdout 上迭代、holdout 最终检查与污染核对。
- [Dwork 等：Preserving Statistical Validity in Adaptive Data Analysis](https://arxiv.org/abs/1411.2664) — 自适应复用 Holdout 与统计有效性。
- [Google：Dividing the original dataset](https://developers.google.com/machine-learning/crash-course/overfitting/dividing-datasets) — Train、Validation、Test 的职责、磨损、代表性和重复。
- [OpenAI：Why SWE-bench Verified no longer measures frontier coding capabilities](https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/) — 公开 Benchmark 污染与评分有效性。
- [Lee 等：Deduplicating Training Data Makes Language Models Better](https://aclanthology.org/2022.acl-long.577/) — 精确、近似重复和 Train-Test Overlap。
- [Yang 等：Rethinking Benchmark and Contamination with Rephrased Samples](https://arxiv.org/abs/2311.04850) — 改写与翻译对简单污染检查的绕过。
- [NIST AI Risk Management Framework Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/) — 部署代表性、安全评测、生产监控与持续反馈。
- [NIST Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1) — 对抗测试、红队与 Chaos Testing。
- [NIST：Choosing a Sampling Scheme](https://itl.nist.gov/div898/handbook/ppc/section3/ppc332.htm) — 分层、随机化和系统性抽样误差。
- [NIST：Selecting Sample Sizes](https://www.itl.nist.gov/div898/handbook/ppc/section3/ppc333.htm) — 目标精度、变异和风险驱动的样本量。
- [NIST：Binomial Confidence Intervals](https://www.itl.nist.gov/div898/handbook/prc/section2/prc241.htm) — 小样本与少失败场景的二项区间。
- [HELM](https://arxiv.org/abs/2211.09110) — 场景覆盖、多指标和明确评测遗漏。
- [BIG-bench](https://arxiv.org/abs/2206.04615) — 面向当前能力之外的 Challenge。
- [Dynabench](https://dynabench.org/paper.pdf) — 人与模型在环的动态对抗数据收集。
- [LiveBench](https://arxiv.org/abs/2406.19314) — 以新题和更难版本缓解污染与饱和。
- [Google Research：Data Cards](https://research.google/pubs/data-cards-purposeful-and-transparent-dataset-documentation-for-responsible-ai/) — 来源、用途、方法、演化与生命周期文档。
- [OpenAI Evals：Build an Eval](https://github.com/openai/evals/blob/main/docs/build-eval.md) — Eval Split、版本和可复现命名。
