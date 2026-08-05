---
title: Broker 型 MCP 网关：检索、校验与转发
date: 2026-08-05
tags:
  - MCP
  - AI Agent
  - Tool Broker
  - 架构设计
description: 让主 Agent 保留任务规划权，由 Broker 按需检索工具、返回 Schema、校验参数并代理执行。
---

# Broker 型 MCP 网关：检索、校验与转发

## 要解决的问题

当客户端只希望配置一个 MCP 时，网关不一定需要成为第二 Agent。更小、更稳定的方案，是让主 Agent 继续理解任务和决定下一步，网关只解决工具发现、Schema 延迟加载与可靠执行。

这种模式的关键问题是：怎样让一个通用执行入口仍然可检索、可校验、可审计，同时避免网关重新解释目标或替主 Agent 猜测参数。

## 核心结论

Broker 型网关更适合作为默认方案：

```text
主 Agent 负责想清楚做什么
Tool Broker 负责找到工具并可靠执行
```

网关不接收一个模糊目标后自行规划多步任务，也不决定下一步调用什么。它只执行四类确定性工作：

1. 从工具注册中心检索候选工具；
2. 返回选中工具的真实 Schema 和约束；
3. 校验主 Agent 已经决定好的参数；
4. 代理调用底层 MCP 并标准化结果。

```text
用户
  ↓
客户端主 Agent + Router Skill
  ↓ search_tools
Tool Broker MCP
  ↓ 候选工具与 Schema
客户端主 Agent 选择、补参、确认
  ↓ execute_tool(tool_ref, arguments)
Tool Broker MCP
  ↓
底层 MCP
```

## 固定 Tool 设计

Broker 对客户端只暴露少量稳定 Tool。

### `search_tools`

输入：

```json
{
  "query": "查询服务的上游调用来源",
  "domain": "observability",
  "risk": "read",
  "top_k": 3
}
```

输出：

```json
{
  "candidates": [
    {
      "tool_ref": "call-graph.query-upstream",
      "description": "查询指定服务的上游调用来源",
      "score": 0.96,
      "risk": "read",
      "required_fields": ["service_name", "start_time", "end_time"]
    }
  ]
}
```

搜索阶段只返回候选摘要，避免一次加载太多完整 Schema。返回结果还应说明命中理由、Schema 版本和工具健康状态，帮助主 Agent 判断候选是否可靠。

### `describe_tool`

输入稳定的 `tool_ref`，返回：

- 完整 JSON Schema；
- 参数语义和格式限制；
- 风险级别；
- 权限和确认要求；
- 限频、时间范围和返回量约束；
- Schema 版本；
- 常见错误及处理方式。

### `execute_tool`

只接受已经确定的工具与参数：

```json
{
  "tool_ref": "call-graph.query-upstream",
  "schema_version": "2026-08-05",
  "arguments": {
    "service_name": "Service A",
    "start_time": "2026-08-05 10:00:00",
    "end_time": "2026-08-05 10:30:00"
  }
}
```

网关不在这里重新解释自然语言，也不替主 Agent 修改参数。它只完成 Schema 校验、策略校验、身份透传和底层调用。

如果参数缺失，应该返回结构化错误，让主 Agent 向用户补充，而不是由 Broker 猜测：

```json
{
  "status": "invalid_arguments",
  "missing_fields": ["end_time"],
  "schema_version": "2026-08-05",
  "retryable": true
}
```

### 可选的 `get_result`

对于长耗时或大结果工具，可以让 `execute_tool` 返回结果引用，再通过 `get_result` 分页读取。Broker 仍不规划任务，只负责持久化和读取已经确定的工具调用结果。

## 检索能力是否需要大模型

Broker 需要语义检索能力，但不需要成为生成式 Agent。推荐分层实现。

### 第一层：确定性标签和关键词

```text
上游、谁调用我、调用来源 → query-upstream
下游、调用谁、目标服务   → query-downstream
CPU、内存、容量          → query-capacity
日志、ERROR、指定节点    → query-logs
```

这层延迟低、结果稳定，适合高频明确意图。

### 第二层：混合检索

对工具名称、描述、领域、别名、输入字段和使用案例建立文本与向量索引，再合并关键词和向量分数。

工具描述应写清“适用范围”和“不适用范围”。如果两个 Tool 都能查询时间序列，仅描述“查询指标”很难被可靠区分。

### 第三层：可选轻量重排

只有候选分数接近时，才使用小模型对 Top K 候选排序。重排器只回答“哪个工具更匹配”，不执行工具，也不规划后续步骤。

这种小范围语义判断属于检索组件，而不是第二 Agent。它没有自主循环、任务记忆或执行权限。

## 主 Agent 如何完成多步骤任务

例如用户提出“分析 Service A 为什么超时”，主 Agent 可以在 Router Skill 指引下迭代调用 Broker：

```text
搜索并执行调用关系工具
      ↓ 观察下游失败集中度
搜索并执行容量工具
      ↓ 判断是否存在资源瓶颈
搜索并执行日志工具
      ↓ 验证错误和时间是否吻合
必要时搜索性能分析工具
      ↓
主 Agent 汇总证据和不确定性
```

每一步是否继续，取决于刚得到的结果和完整对话上下文。Broker 不需要保存任务思维链，也不需要知道整个诊断计划。

Router Skill 可以提供领域顺序和分支条件，但不应把工具 `tool_ref` 写死。具体工具由 Registry 检索，避免工具升级后 Skill 与实际能力脱节。

## 优势

### 上下文可控

模型只看到固定的 Broker Tool，以及当前任务命中的少量底层 Schema。

### 职责单一

工具选错时可以分别排查：

- Router Skill 的领域规则是否正确；
- 检索索引是否召回正确候选；
- 主 Agent 是否选择了错误候选；
- Schema 是否过时；
- 底层 MCP 是否执行失败。

### 易于审计

每次真实执行都有明确的 `tool_ref + schema_version + arguments`，不会隐藏在第二 Agent 的内部循环中。

### 客户端兼容性较好

客户端不需要支持会话中动态注册 MCP，只需要调用固定的 Broker Tool。

### 安全边界清楚

主 Agent 负责向用户展示和确认写操作，Broker 再次检查确认凭据和工具风险，形成双层保护。

### 可以渐进增强

最初可以使用人工标签和关键词；工具增多后再增加 BM25、向量检索、重排和 Schema 缓存。增强检索不需要改变客户端的稳定接口。

## 局限

### 主 Agent 承担更多编排工作

复杂任务需要主 Agent 多次搜索、读 Schema 和调用工具，无法像领域 Agent 一样一次提交后等待最终结论。

### 通用执行接口缺少静态类型体验

客户端看到的 `execute_tool.arguments` 通常是通用 JSON 对象，不能完全依靠 MCP 客户端在调用前进行静态参数提示。必须由 Broker 在服务端严格校验。

### 多一次或两次往返

完整流程可能包含搜索、描述和执行。可以通过缓存、在搜索结果中内联第一候选 Schema，以及复用最近使用工具降低延迟。

### 结果标准化需要谨慎

Broker 可以统一错误外壳，但不应强行抹平所有领域结果。建议同时保留：

```json
{
  "status": "success",
  "tool_ref": "call-graph.query-upstream",
  "summary": "发现 3 个主要上游来源",
  "data": {},
  "raw_ref": "optional-result-reference"
}
```

标准字段用于通用处理，`data` 保留领域语义，`raw_ref` 用于按需读取大结果。

## 写操作设计

Broker 应把工具风险作为注册信息，而不是依赖模型从描述中判断。

推荐流程：

```text
search_tools 返回 risk=write/destructive
       ↓
主 Agent 展示完整参数和影响范围
       ↓
用户明确确认
       ↓
客户端生成或携带 confirmation reference
       ↓
Broker 校验确认状态、用户身份和 Schema 版本
       ↓
execute_tool
```

高风险操作还应支持幂等键、影响范围上限、执行后读取验证和不可恢复操作拦截。

确认引用需要绑定用户、工具、参数摘要、过期时间和影响范围。只传一个通用的 `confirmed: true` 无法证明用户确认的是当前这次操作。

## 最小可行版本

### 第一阶段：只读 Broker

- 接入少量高频只读 MCP；
- 手工维护领域标签和别名；
- 实现 `search_tools`、`describe_tool` 与 `execute_tool`；
- 执行前实时或缓存获取 Schema；
- 记录检索候选和最终选择；
- 建立离线意图评测集。

### 第二阶段：提升召回与效率

- 加入 BM25 与向量混合检索；
- Schema 版本缓存和失效通知；
- 在高置信候选中直接内联 Schema；
- 支持并行执行多个明确的只读查询；
- 对大结果使用摘要、分页或结果引用。

### 第三阶段：受控写操作

- 接入用户身份委托；
- 定义统一确认协议；
- 加入幂等、审批和审计；
- 只开放经过评测的写工具；
- 保留每个底层系统的最终权限校验。

## 与 Agent 型网关的选择

| 判断项 | Broker 型网关 | Agent 型网关 |
| --- | --- | --- |
| 任务规划者 | 客户端主 Agent | 网关内第二 Agent |
| 工具调用透明度 | 高 | 较低 |
| 单工具查询成本 | 低 | 较高 |
| 复杂领域流程封装 | 由 Skill 编排 | 网关内部封装 |
| 写操作逐步确认 | 容易 | 较难 |
| 调试和审计 | 边界清楚 | 需要完整 Agent Trace |
| 适合作为默认入口 | 是 | 否，按领域引入 |

推荐先用 Broker 型网关解决工具发现和上下文膨胀问题。只有真实数据证明某些多工具流程长期重复、边界稳定，再把这些特定流程升级为 Agent 型能力。

## 常见错误

### 搜索结果只返回工具名称

名称不足以支持可靠选择。候选摘要至少需要包含描述、适用范围、风险、必填字段、Schema 版本和命中理由。

### 在执行接口中继续解释自然语言

`execute_tool` 应执行确定的 `tool_ref + arguments`。如果它还能自由改写参数或换工具，Broker 的边界就变得不可审计。

### Broker 缓存 Schema 却没有版本

旧 Schema 会造成错误参数或意外默认值。搜索、描述和执行都应显式关联版本，并在失效时返回可重试错误。

### 把统一错误格式当作统一业务数据

错误状态可以标准化，领域数据不应被过度压平。保留原始领域结构，才能让主 Agent 做可靠判断。

## 系列文章

- [MCP 工具网关：基础架构与核心契约](./mcp-gateway-foundation.md)
- [Agent 型 MCP 网关：作为第二 Agent 代理规划与执行](./mcp-gateway-agent-proxy.md)
