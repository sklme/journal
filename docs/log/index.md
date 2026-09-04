---
title: 内容日志
description: 按月份倒序整理知识库和指南中已经收录的内容
---

# 内容日志

这里是面向人和 AI 的内容总索引。每篇知识文章或指南只保留一条记录，按首次收录月份倒序排列；普通内容修改不会重复增加记录。

## 2026-09

- `2026-09-04` · AI 工程 · [能用代码判断的，就不要交给 LLM](/knowledge/ai-engineering/deterministic-graders-for-agent-evaluation) — 用 Outcome、State、Invariant、Contract 和 Budget 构建隔离、可重放且能区分任务失败与评分错误的确定性 Grader。
- `2026-09-04` · AI 工程 · [LLM-as-Judge 如何避免成为另一种玄学](/knowledge/ai-engineering/reliable-llm-as-judge-for-agent-evaluation) — 把模型裁判作为需要专家金标、偏差测试、版本治理和分歧升级的测量仪器。
- `2026-09-04` · AI 工程 · [Agent Trajectory 应该评什么](/knowledge/ai-engineering/what-to-evaluate-in-agent-trajectories) — 用可观察事件、时序约束和失败分类检查高风险动作、错误恢复、Handoff、Guardrail 与终止策略。
- `2026-09-02` · AI 工程 · [为什么个人和团队需要自己的 Agent Eval Dataset](/knowledge/ai-engineering/why-build-your-own-agent-eval-dataset) — 用目标工作分布、Dataset Charter、覆盖矩阵和小样本边界，把通用 Benchmark 补充为面向真实价值的自有评测资产。
- `2026-09-02` · AI 工程 · [如何把真实工作转化成 Agent Eval Case](/knowledge/ai-engineering/turn-real-work-into-agent-eval-cases) — 将真实任务转换为版本化 Eval Case，明确可见输入、初始环境、成功契约、隐藏评分证据和可解性验证。
- `2026-09-02` · AI 工程 · [一个健康的 Agent 评测集如何分层](/knowledge/ai-engineering/healthy-agent-eval-dataset-layers) — 用测试目的、数据切分和数据来源三条正交轴组织评测集，并建立案例生命周期、版本与健康度治理。
- `2026-09-01` · AI 工程 · [Trace、Eval、Experiment 与 Monitoring：Agent 质量系统的四个层次](/knowledge/ai-engineering/agent-trace-eval-experiment-monitoring-boundaries) — 区分事实记录、质量判断、受控比较和生产反馈，建立 Agent 质量系统的证据链与数据边界。
- `2026-09-01` · AI 工程 · [如何设计 Agent Trace Tree：从模型调用到最终状态](/knowledge/ai-engineering/agent-trace-tree-design) — 设计覆盖模型、工具、Handoff、Guardrail、状态变化和产物证据的版本化 Trace Schema。
- `2026-09-01` · AI 工程 · [如何让 Agent 评测实验可复现](/knowledge/ai-engineering/reproducible-agent-evaluation-experiments) — 用 Run Manifest、环境快照、Trial 隔离和失败分类实现可重跑、可解释的 Agent 评测实验。

## 2026-08

- `2026-08-31` · AI 工程 · [从多角色协作到 Agent Runtime：工程化设计指南](/knowledge/ai-engineering/agent-runtime-engineering-guide) — 用控制面、执行面、能力面、证据面和治理横切层设计可调度、可验证、可渐进演进的多 Agent 系统。
- `2026-08-31` · AI 工程 · [Agent 评测工程知识体系：从可观测性到质量基础设施](/knowledge/ai-engineering/agent-evaluation-engineering-knowledge-roadmap) — 以质量定义、Trace、任务集、Grader、受控实验和生产反馈为主线，规划可渐进落地的 Agent 评测工程知识体系。
- `2026-08-31` · AI 工程 · [为什么 Agent 评测比搭建 Agent 更难](/knowledge/ai-engineering/why-agent-evaluation-is-hard) — 从非确定性、多步决策、环境状态和多种正确路径出发，解释 Agent 评测为何需要实验工程。
- `2026-08-31` · AI 工程 · [Agent 评测对象的四层边界：模型、Harness、系统与产品](/knowledge/ai-engineering/agent-evaluation-target-boundaries) — 区分四层评测对象，建立能够解释分数变化的 Evaluation Map、控制变量和运行清单。
- `2026-08-31` · AI 工程 · [没有标准答案，如何用 Evaluation Contract 定义 Agent 成功](/knowledge/ai-engineering/agent-evaluation-contract) — 用结果、约束、质量、预算、可靠性和风险定义允许多种正确路径的可执行成功契约。
- `2026-08-26` · AI 工程 · [Agent 时代的 API 管理工具：从请求编辑器到能力基础设施](/knowledge/ai-engineering/agent-native-api-management-from-client-to-infrastructure) — 分析 Agent 如何拆解传统 API 客户端的价值，并给出从请求编辑器演进为执行与治理基础设施的产品方向。
- `2026-08-26` · AI 工程 · [Agent 原生 API 测试：从临时探索到稳定回归](/knowledge/ai-engineering/agent-native-api-testing-exploration-to-regression) — 建立临时探索、可复用命令与自动化回归之间的晋升路径，让 Agent 生成的请求转化为稳定测试资产。
- `2026-08-26` · AI 工程 · [Agent 原生 API 测试架构：事实来源、Runner 与多入口](/knowledge/ai-engineering/agent-native-api-source-of-truth-and-execution-architecture) — 划分接口契约、测试场景、环境和执行结果的权威来源，并用共享 Runner 支撑 Agent、CLI、UI 与 CI。
- `2026-08-26` · AI 工程 · [Agent 原生 API Tool 设计：从任意 HTTP 到安全插件](/knowledge/ai-engineering/agent-native-api-tools-and-plugin-design) — 设计适合 Agent 的 API 插件、工具发现与执行契约，在灵活性、上下文成本和写操作安全之间取得平衡。
- `2026-08-26` · AI 工程 · [Agent 原生 API 工具的 Human UI：从操作台到审查控制面](/knowledge/ai-engineering/agent-native-api-human-control-surface) — 重新定义 API 工具中的人工界面，使其服务于发现、预览、审批、证据与历史，而不是成为第二份请求事实来源。
- `2026-08-25` · AI 工程 · [npx skills 的安装与更新原理：远端解析、目录替换与软链接](/knowledge/ai-engineering/npx-skills-installation-and-update-model) — 解释 Skills CLI 如何发现、复制和链接 Skill，以及为什么 update 本质上仍是目录替换式重新安装。
- `2026-08-24` · AI 工程 · [ChangeGraph 设计哲学：面向人类的 Agent 变更审查系统](/knowledge/ai-engineering/changegraph-human-centered-review-design-philosophy) — 定义 ChangeGraph 的服务对象、审查单位、事实边界、分层原则、非目标与产品决策准则。
- `2026-08-24` · AI 工程 · [ChangeGraph 的社区实践与竞品分析：从代码地图到变更保证系统](/knowledge/ai-engineering/changegraph-community-practices-and-competitive-landscape) — 对比 AI 代码审查、可视化代码地图与代码分析基础设施，提炼面向人的变更保证系统可以复用的能力与差异化方向。
- `2026-08-24` · AI 工程 · [Spec、ChangeGraph 与 EvidenceGraph：Agent 开发的意图—实现—证据闭环](/knowledge/ai-engineering/spec-changegraph-evidence-reconciliation) — 将 Spec 抽象为可演化的意图层，并以三图结构持续发现实现漂移、证据缺口和范围越界。
- `2026-08-24` · AI 工程 · [Agent 代码审查的哲学：从黑盒验证到渐进式保证](/knowledge/ai-engineering/agent-code-review-progressive-assurance) — 将黑盒验证、ChangeGraph 语义审查和源码审查统一为声明—证据驱动的风险自适应保证体系。
- `2026-08-24` · AI 工程 · [AI 代码知识图谱的价值边界：从 Agent 加速层到人类代码地图](/knowledge/ai-engineering/ai-code-knowledge-graph-and-human-first-code-map) — 分析代码图的正确性与同步边界，并设计包含语义变更图、渐进式审核和路径敏感度配置的 ChangeGraph Review 系统。
- `2026-08-20` · AI 工程 · [MoneyPrinterTurbo 架构拆解：从自动视频拼装到智能剪辑 Agent](/knowledge/ai-engineering/moneyprinterturbo-architecture-and-intelligent-video-editing) — 拆解自动视频流水线、LLM 成本与局限，并给出多模态智能剪辑的渐进式改造方案。
- `2026-08-19` · AI 工程 · [多 Agent 工程协作：角色之外的认知独立性](/knowledge/ai-engineering/multi-agent-cognitive-independence) — 从目标、上下文、工具与权限的差异出发，设计能相互制约并稳定收敛的多 Agent 工程流程。
- `2026-08-17` · 工程实践 · [macOS 上使用 Docker CLI 连接 Podman](/knowledge/engineering/docker-cli-with-podman-on-macos) — 理解 Docker CLI、context、Unix socket 与 Podman 兼容 API 的关系，并在 macOS 上安全切换容器后端。
- `2026-08-12` · AI 工程 · [个人开发者如何管理 Codex MCP：何时需要 ToolHive](/knowledge/ai-engineering/codex-mcp-management-for-individual-developers) — 从配置分组、会话隔离和运行安全三个维度判断是否需要 ToolHive，并给出 Codex Desktop 的轻量配置方案。
- `2026-08-12` · AI 工程 · [LLM 缓存机制：原理、流派与工程实践](/knowledge/ai-engineering/llm-caching-mechanisms-and-practices) — 从注意力中的 Q、K、V 出发，梳理单次生成、跨请求、推理服务和应用层缓存的原理、边界与实践。
- `2026-08-12` · AI 工程 · [主流 LLM 的 Prompt Cache 方案与机制对比](/knowledge/ai-engineering/llm-provider-prompt-caching-comparison) — 对比 DeepSeek、OpenAI、Claude、Gemini 与自托管框架的前缀缓存规则、控制方式和生命周期。
- `2026-08-12` · AI 工程 · [DeepSeek Agent Harness 与前缀缓存优化](/knowledge/ai-engineering/deepseek-agent-harness-prefix-cache-optimization) — 解释 Agent Harness 如何影响 DeepSeek 前缀缓存，并拆解 Pi、Reasonix、DeepPi 与 pi-deepseek-cache 的方案。
- `2026-08-05` · AI 工程 · [MCP 管理、Tool Broker 与领域 Agent 的业界实践](/knowledge/ai-engineering/mcp-management-broker-and-agent-industry-practices) — 对照主流 Gateway、延迟加载 Tool Search 和 Agent-as-Tool，提炼配置管理、运行时 Broker 与领域 Agent 的边界。
- `2026-08-05` · AI 工程 · [MCP 配置管理与同步：不引入运行时网关的控制面方案](/knowledge/ai-engineering/mcp-configuration-management-and-sync) — 在保持 Agent 直连 MCP 的前提下，用统一清单、Profile、Agent Adapter 和 SecretRef 管理并同步配置。
- `2026-08-05` · AI 工程 · [MCP 工具网关：基础架构与核心契约](/knowledge/ai-engineering/mcp-gateway-foundation) — 用一个路由 Skill 和一个 MCP 工具网关实现工具按需发现、Schema 延迟加载与统一执行。
- `2026-08-05` · AI 工程 · [Agent 型 MCP 网关：作为第二 Agent 代理规划与执行](/knowledge/ai-engineering/mcp-gateway-agent-proxy) — 分析第二 Agent 自主规划与多工具执行的收益、代价和安全边界。
- `2026-08-05` · AI 工程 · [Broker 型 MCP 网关：检索、校验与转发](/knowledge/ai-engineering/mcp-gateway-tool-broker) — 由主 Agent 保留规划权，Broker 负责按需检索工具、校验参数并代理执行。
- `2026-08-04` · AI 工程 · [Agent Skills 分发与生命周期管理](/knowledge/ai-engineering/agent-skills-distribution-and-lifecycle-management) — 从安装器走向 Registry、版本、作用域、审批和本地资产管理的通用方案。
- `2026-08-04` · AI 工程 · [Multica：Agent 管理层、控制面与适用边界](/knowledge/ai-engineering/multica-agent-control-plane) — 区分 Agent 控制面、任务内子 Agent 和 workspace Skills，判断什么时候值得引入 Multica。

## 2026-07

- `2026-07-23` · 工程实践 · [使用 VitePress 搭建个人知识站](/knowledge/engineering/building-a-vitepress-knowledge-site) — 使用 TypeScript、VitePress 和自动检查构建可维护的个人技术知识站。
