---
title: AI 工程
description: Agent、Skills、控制面与自动化协作
---

# AI 工程

这里记录 Agent 系统、Skills、控制面和自动化协作中的概念、架构与实践。

## LLM 缓存与 Agent 推理

从 Transformer 内部 KV Cache 出发，理解跨请求前缀缓存、不同模型提供商的产品方案，以及 Agent Harness 如何影响实际命中率：

- [LLM 缓存机制：原理、流派与工程实践](./llm-caching-mechanisms-and-practices.md)
- [主流 LLM 的 Prompt Cache 方案与机制对比](./llm-provider-prompt-caching-comparison.md)
- [DeepSeek Agent Harness 与前缀缓存优化](./deepseek-agent-harness-prefix-cache-optimization.md)

## Agent 评测工程

围绕质量定义、Trace、任务集、Grader、受控实验和生产反馈，建立从“感觉变好”到可验证优化的完整知识路线：

- [Agent 评测工程知识体系：从可观测性到质量基础设施](./agent-evaluation-engineering-knowledge-roadmap.md)
- [为什么 Agent 评测比搭建 Agent 更难](./why-agent-evaluation-is-hard.md)
- [Agent 评测对象的四层边界：模型、Harness、系统与产品](./agent-evaluation-target-boundaries.md)
- [没有标准答案，如何用 Evaluation Contract 定义 Agent 成功](./agent-evaluation-contract.md)
- [Trace、Eval、Experiment 与 Monitoring：Agent 质量系统的四个层次](./agent-trace-eval-experiment-monitoring-boundaries.md)
- [如何设计 Agent Trace Tree：从模型调用到最终状态](./agent-trace-tree-design.md)
- [如何让 Agent 评测实验可复现](./reproducible-agent-evaluation-experiments.md)
- [为什么个人和团队需要自己的 Agent Eval Dataset](./why-build-your-own-agent-eval-dataset.md)
- [如何把真实工作转化成 Agent Eval Case](./turn-real-work-into-agent-eval-cases.md)
- [一个健康的 Agent 评测集如何分层](./healthy-agent-eval-dataset-layers.md)

## MCP 工程化

围绕 MCP 的配置生命周期、运行时工具发现、代理执行和领域 Agent 封装，建议按以下顺序阅读：

- [MCP 配置管理与同步：不引入运行时网关的控制面方案](./mcp-configuration-management-and-sync.md)
- [个人开发者如何管理 Codex MCP：何时需要 ToolHive](./codex-mcp-management-for-individual-developers.md)
- [MCP 工具网关：基础架构与核心契约](./mcp-gateway-foundation.md)
- [Broker 型 MCP 网关：检索、校验与转发](./mcp-gateway-tool-broker.md)
- [Agent 型 MCP 网关：作为第二 Agent 代理规划与执行](./mcp-gateway-agent-proxy.md)
- [MCP 管理、Tool Broker 与领域 Agent 的业界实践](./mcp-management-broker-and-agent-industry-practices.md)

## Agent 原生 API 管理

从传统请求编辑器的价值重构出发，依次建立探索到回归的工作流、事实与执行架构、安全 Tool 契约，以及面向人的审查控制面：

- [Agent 时代的 API 管理工具：从请求编辑器到能力基础设施](./agent-native-api-management-from-client-to-infrastructure.md)
- [Agent 原生 API 测试：从临时探索到稳定回归](./agent-native-api-testing-exploration-to-regression.md)
- [Agent 原生 API 测试架构：事实来源、Runner 与多入口](./agent-native-api-source-of-truth-and-execution-architecture.md)
- [Agent 原生 API Tool 设计：从任意 HTTP 到安全插件](./agent-native-api-tools-and-plugin-design.md)
- [Agent 原生 API 工具的 Human UI：从操作台到审查控制面](./agent-native-api-human-control-surface.md)

## 多 Agent 工程协作

- [多 Agent 工程协作：角色之外的认知独立性](./multi-agent-cognitive-independence.md)
- [从多角色协作到 Agent Runtime：工程化设计指南](./agent-runtime-engineering-guide.md)

## AI 辅助代码理解

- [AI 代码知识图谱的价值边界：从 Agent 加速层到人类代码地图](./ai-code-knowledge-graph-and-human-first-code-map.md)
- [Agent 代码审查的哲学：从黑盒验证到渐进式保证](./agent-code-review-progressive-assurance.md)
- [Spec、ChangeGraph 与 EvidenceGraph：Agent 开发的意图—实现—证据闭环](./spec-changegraph-evidence-reconciliation.md)
- [ChangeGraph 的社区实践与竞品分析：从代码地图到变更保证系统](./changegraph-community-practices-and-competitive-landscape.md)
- [ChangeGraph 设计哲学：面向人类的 Agent 变更审查系统](./changegraph-human-centered-review-design-philosophy.md)

## Agent Skills 管理

- [npx skills 的安装与更新原理：远端解析、目录替换与软链接](./npx-skills-installation-and-update-model.md)
- [Agent Skills 分发与生命周期管理](./agent-skills-distribution-and-lifecycle-management.md)

## Agent 平台与控制面

- [Multica：Agent 管理层、控制面与适用边界](./multica-agent-control-plane.md)

## AI 视频与多模态工作流

- [MoneyPrinterTurbo 架构拆解：从自动视频拼装到智能剪辑 Agent](./moneyprinterturbo-architecture-and-intelligent-video-editing.md)
