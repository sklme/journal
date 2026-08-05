---
title: MCP 工具网关：基础架构与核心契约
date: 2026-08-05
tags:
  - MCP
  - AI Agent
  - Tool Gateway
  - 架构设计
description: 用一个路由 Skill 和一个 MCP 工具网关实现工具按需发现、Schema 延迟加载与统一执行。
---

# MCP 工具网关：基础架构与核心契约

## 要解决的问题

一个 AI 客户端接入的 MCP Server 持续增加后，通常会遇到四类问题：

- 每个 Tool 的名称、描述和 JSON Schema 都进入模型上下文，挤占任务本身的 Token；
- 多个 MCP 提供相似能力，模型难以仅凭工具名稳定选择；
- 如果要求用户在每次任务前手动启停 MCP，就把系统复杂度转移给了用户；
- 鉴权、写操作确认、限频和审计分散在不同 MCP 中，难以形成一致策略。

因此，目标不应只是把多个 MCP 地址合并到一份配置，而应让模型只在需要时看到少量候选工具的完整定义。

## 核心结论

当底层 MCP 数量持续增长时，可以把客户端入口收敛为：

```text
一个路由 Skill + 一个 MCP 工具网关
```

客户端只注册这两个入口。路由 Skill 帮助主 Agent 理解领域、规划步骤和遵守安全规则；MCP 网关维护底层工具目录、按需返回 Schema，并统一处理鉴权、参数校验、调用转发和审计。

```text
用户需求
   │
   ▼
AI 客户端 + Router Skill
   │
   ▼
MCP Gateway
   ├── Tool Registry
   ├── Schema Cache
   ├── Auth / Policy
   ├── Audit / Observability
   └── MCP Client Pool
          ├── 调用关系 MCP
          ├── 容量监控 MCP
          ├── 日志查询 MCP
          ├── 性能分析 MCP
          └── 变更管理 MCP
```

这套架构把稳定的领域知识和动态的工具事实分开：Skill 负责告诉 Agent “怎样判断和编排”，Registry 与网关负责提供“现在有哪些工具、参数是什么、能否执行”。

## 基础组件

### Router Skill

Router Skill 是主 Agent 的领域说明书，负责：

- 将“上游、下游、调用失败”等意图映射到调用关系领域；
- 将“CPU、内存、容量”等意图映射到资源监控领域；
- 将“错误日志、指定节点、关键词”等意图映射到日志领域；
- 定义多步骤诊断顺序；
- 要求写操作前展示方案并取得用户确认；
- 说明结果为空、无权限或限频时应该怎样处理。

Skill 不应复制所有底层 Tool 的完整 Schema，否则只是把上下文膨胀从 MCP 配置转移到了 Skill。

### Tool Registry

工具注册中心保存每个底层 Tool 的可检索元数据：

```json
{
  "tool_ref": "call-graph.query-upstream",
  "server_ref": "call-graph-mcp",
  "name": "QueryUpstream",
  "description": "查询指定服务的上游调用来源",
  "domains": ["call-graph", "observability"],
  "intents": ["上游", "谁调用我", "调用来源"],
  "risk": "read",
  "schema_version": "2026-08-05",
  "auth_mode": "user-delegated"
}
```

注册中心应使用稳定的 `tool_ref`，不要让模型直接依赖可能变化的底层地址。除了检索字段，还应记录 Owner、健康状态、版本、风险级别、身份模式、限频和弃用状态。

### Schema Cache

网关可以缓存底层 MCP 的 `list_tools` 结果，并记录版本、更新时间和失效策略。只有检索命中的少量工具需要把完整 Schema 返回给模型。

当底层 Schema 更新时，缓存必须按版本失效；执行接口也应要求携带 `schema_version`，防止 Agent 根据旧参数定义发起调用。

### Auth 与 Policy

网关负责建立统一策略层，但不应持有可以绕过所有业务权限的万能身份。推荐继续传递最终用户身份，让底层系统完成资源级授权。

策略至少包含：

- 工具风险级别：`read`、`write`、`destructive`；
- 写操作是否需要用户确认；
- 参数和返回值敏感字段处理；
- 单次调用和单任务预算；
- 超时、限频和可重试错误范围；
- 幂等键与重复提交保护。

### Audit 与 Observability

每次检索和执行都应留下结构化记录，包括查询意图、候选工具、最终选择、Schema 版本、参数来源、用户身份、底层耗时、错误类型和结果摘要。

模型 Token、网关检索、Schema 获取和底层调用应分别计时。只有拆开观测，才能判断延迟来自模型、网关还是具体工具。

### MCP Client Pool

网关在服务端维护到底层 MCP 的连接池，处理连接复用、认证刷新、健康检查和协议差异。AI 客户端无需知道真实 MCP 地址，也不需要在会话中动态注册新连接。

## 推荐的统一接口

基础网关可以先暴露三个固定 Tool：

| Tool | 作用 |
| --- | --- |
| `search_tools` | 根据任务、领域和风险要求检索候选工具 |
| `describe_tool` | 返回指定工具的完整 Schema、约束和使用示例 |
| `execute_tool` | 校验 `tool_ref + arguments` 后代理调用底层 MCP |

一个典型流程是：

```text
主 Agent 理解用户需求
       ↓
search_tools(query, domain, risk)
       ↓
返回 3～5 个候选工具和简要说明
       ↓
describe_tool(tool_ref)
       ↓
主 Agent 补齐参数并决定是否需要确认
       ↓
execute_tool(tool_ref, arguments)
       ↓
网关校验、转发并返回标准化结果
```

如果 Schema 很小且候选数量可控，`search_tools` 可以直接内联第一候选的完整 Schema，减少一次往返。对近期使用过且版本未变的工具，客户端还可以复用缓存。

## 两种网关路线

基础设施搭好以后，网关可以沿两条路线演进。

### Agent 型网关

网关接收自然语言目标，自己规划并连续调用多个底层工具，再返回最终结论。它本质上是主 Agent 之下的第二个 Agent。

优点是可以封装复杂领域流程；代价是形成嵌套规划，增加延迟、成本、安全和可观测性难题。详见[Agent 型 MCP 网关：作为第二 Agent 代理规划与执行](./mcp-gateway-agent-proxy.md)。

### Broker 型网关

网关只负责检索、Schema 获取、参数校验和调用转发。所有任务规划仍由客户端主 Agent 完成。

这种方式边界更清晰、调试更直接，适合作为默认架构。详见[Broker 型 MCP 网关：检索、校验与转发](./mcp-gateway-tool-broker.md)。

## 最小可行版本

第一阶段不需要立即引入复杂模型：

1. 手工维护工具目录和领域标签；
2. 使用关键词、别名和 BM25 完成搜索；
3. 为命中工具返回真实 JSON Schema；
4. 使用统一的 `execute_tool` 代理执行；
5. 先只接入只读 MCP；
6. 加入结构化调用日志和错误分类；
7. 验证检索准确率后，再考虑向量检索或轻量重排。

## 验收指标

建议至少观测：

- 候选工具 Top 1、Top 3 命中率；
- 单次请求加载的 Tool Schema 数量与 Token；
- 搜索、Schema 获取和底层调用的分段延迟；
- 权限失败、参数校验失败和限频比例；
- 写操作确认覆盖率；
- 相比直接注册全部 MCP 的错误工具调用率。

## 适用边界

如果只有少量稳定 Tool，客户端直接注册通常更简单。只有当工具数量、客户端数量或治理要求已经造成明显成本时，工具网关才值得引入。

网关也不能替代底层 MCP 的最终授权和业务校验。它负责统一入口与策略，底层系统仍要对具体资源做权限判断。

## 常见错误

### 网关只返回底层 MCP 地址

如果客户端还要根据地址动态注册 MCP，就没有真正实现“客户端只配置一个 MCP”，并且重新引入了凭证和兼容性问题。网关应该代理执行。

### Router Skill 保存全部 Tool Schema

这会让 Skill 自身变得巨大，而且底层 Schema 更新后容易失效。Skill 只保存领域知识和流程约束，工具事实由注册中心提供。

### 网关使用平台万能账号

集中式万能凭证会扩大权限边界。应优先使用用户委托身份，并让底层系统继续完成最终授权。

### 一开始就让网关自主规划

先建立稳定的工具目录、Schema、鉴权和执行代理，再决定是否真的需要第二 Agent。否则搜索、执行和智能规划的问题会纠缠在一起。

## 系列文章

- [Agent 型 MCP 网关：作为第二 Agent 代理规划与执行](./mcp-gateway-agent-proxy.md)
- [Broker 型 MCP 网关：检索、校验与转发](./mcp-gateway-tool-broker.md)
