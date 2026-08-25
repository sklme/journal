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

## MCP 工程化

围绕 MCP 的配置生命周期、运行时工具发现、代理执行和领域 Agent 封装，建议按以下顺序阅读：

- [MCP 配置管理与同步：不引入运行时网关的控制面方案](./mcp-configuration-management-and-sync.md)
- [个人开发者如何管理 Codex MCP：何时需要 ToolHive](./codex-mcp-management-for-individual-developers.md)
- [MCP 工具网关：基础架构与核心契约](./mcp-gateway-foundation.md)
- [Broker 型 MCP 网关：检索、校验与转发](./mcp-gateway-tool-broker.md)
- [Agent 型 MCP 网关：作为第二 Agent 代理规划与执行](./mcp-gateway-agent-proxy.md)
- [MCP 管理、Tool Broker 与领域 Agent 的业界实践](./mcp-management-broker-and-agent-industry-practices.md)

## 多 Agent 工程协作

- [多 Agent 工程协作：角色之外的认知独立性](./multi-agent-cognitive-independence.md)

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
