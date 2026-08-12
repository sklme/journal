---
title: 内容日志
description: 按月份倒序整理知识库和指南中已经收录的内容
---

# 内容日志

这里是面向人和 AI 的内容总索引。每篇知识文章或指南只保留一条记录，按首次收录月份倒序排列；普通内容修改不会重复增加记录。

## 2026-08

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
