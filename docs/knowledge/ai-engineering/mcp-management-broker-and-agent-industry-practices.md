---
title: MCP 管理、Tool Broker 与领域 Agent 的业界实践
date: 2026-08-05
tags:
  - MCP
  - AI Agent
  - Tool Broker
  - 架构设计
description: 对照主流 MCP Gateway、延迟加载 Tool Search 和 Agent-as-Tool 实践，提炼配置管理、运行时 Broker 与领域 Agent 的合理边界。
---

# MCP 管理、Tool Broker 与领域 Agent 的业界实践

## 要解决的问题

当一个 Agent 需要接入越来越多 MCP Server 时，常见方案不只有“把全部 MCP 配进客户端”或者“建设一个万能智能网关”两种。真正需要区分的是三类问题：

1. 怎样管理、分组和同步 MCP 配置；
2. 怎样在运行时从大量 Tool 中按需发现和执行少量能力；
3. 怎样封装需要多步骤推理的稳定领域流程。

如果把三类问题都塞进一个由大模型驱动的 Gateway，配置生命周期、工具检索、授权代理和业务规划会相互耦合。已有产品的共同趋势，是把它们拆成控制面、确定性 Broker 和显式领域 Agent。

## 核心结论

业界已经形成三个相对独立的层次：

| 层次 | 主要职责 | 代表实践 | 是否需要生成式模型 |
| --- | --- | --- | --- |
| MCP 管理与控制面 | Catalog、分组、Profile、配置生成、凭证和策略 | ToolHive、Docker MCP Toolkit | 不需要 |
| Runtime Gateway / Tool Broker | 聚合、搜索、延迟加载 Schema、鉴权和代理执行 | Docker Dynamic MCP、AWS AgentCore、OpenAI、Anthropic、Composio | 通常不需要 |
| 领域 Agent as Tool | 理解领域目标、制定步骤、连续调用工具、生成证据和结论 | AWS Multi-Agent、Google AgentTool、OpenAI Agents as tools | 需要 |

推荐结构是：

```text
                         MCP Catalog / Registry
                          │                 │
                 管理与同步控制面      运行时 Tool Broker
                          │                 │
               生成不同客户端配置      搜索、Schema、代理执行
                          │                 │
               ┌──────────┴─────────────────┴──────────┐
               │                                       │
           客户端主 Agent                        领域 Agent Tools
           负责总体规划                   只封装稳定的复杂业务流程
```

管理与同步、Broker、领域 Agent 可以共用 Registry，但不必部署成一个服务。工具数量可控时，Agent 可以继续直连 MCP；只有工具规模或运行时治理形成真实问题时，才让调用经过 Broker。

## 确定性 MCP Gateway

### AWS Bedrock AgentCore Gateway

[Amazon Bedrock AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-using.html)把 API、Lambda、知识库和其他后端能力转换或聚合为 MCP Tool，通过统一 MCP Endpoint 提供给 Agent，并集中处理身份、授权和目标调用。

AgentCore Gateway 还支持面向 Tool 的语义搜索，[官方 Quickstart](https://aws.github.io/bedrock-agentcore-starter-toolkit/user-guide/gateway/quickstart.html)可以启用 Semantic Search。这说明企业 Gateway 可以同时承担统一入口和工具发现，但真实执行仍由确定性的目标、策略和调用链完成，不要求 Gateway 自己成为第二 Agent。

值得借鉴的部分包括：

- 一个受管 MCP Endpoint 聚合异构后端；
- Gateway Target 作为后端能力的稳定引用；
- 用户身份、授权、策略和执行代理集中治理；
- 用语义搜索减少同时暴露给模型的 Tool；
- Gateway 直接代理执行，不要求客户端动态注册底层 MCP。

### ToolHive

[ToolHive](https://github.com/stacklok/toolhive)将 Registry、Runtime、Gateway 和 Portal 分开建设，提供虚拟 MCP Endpoint、工具筛选、身份、Secrets、策略和审计能力，也可以按照团队、角色或使用场景组织 MCP Server。

它反映了确定性 Gateway 的典型边界：负责运行、治理和企业安全，形态更接近 API Gateway 或服务网格，而不是 Agent。

可复用的设计包括：

- Registry、运行时和用户入口模块化；
- 通过虚拟 MCP 暴露受控工具集合；
- 以角色和场景组织 Server，而不是维护一份全局列表；
- Secrets 在运行时注入，不进入模型上下文；
- 策略和审计由网关强制执行，不依赖模型遵守描述。

## 延迟加载 Tool Broker

### Docker Dynamic MCP

[Docker Dynamic MCP](https://docs.docker.com/ai/mcp-catalog-and-toolkit/dynamic-mcp/)与“客户端只注册一个 Broker MCP”的设想非常接近。Gateway 首先只暴露一小组管理工具：

| Tool | 用途 |
| --- | --- |
| `mcp-find` | 按名称和描述搜索 Catalog 中的 MCP Server |
| `mcp-add` | 把命中的 Server 加入当前会话 |
| `mcp-config-set` | 设置 Server 配置 |
| `mcp-remove` | 从当前会话移除 Server |
| `mcp-exec` | 执行当前会话中的真实 Tool |
| `code-mode` | 在沙箱 JavaScript 中组合多个 MCP Tool |

动态加入的 Server 和 Tool 只属于当前会话，不自动持久化到 Profile。这是一个有价值的安全边界：运行时发现不应该悄悄改变长期配置。

Dynamic MCP 和 `code-mode` 仍属于实验性能力，因此更适合用于验证交互契约，而不是直接视为完全稳定的生产基线。

### Anthropic Tool Search

[Anthropic Tool Search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)允许把大部分 Tool 标记为 `defer_loading`。模型最初只看到搜索工具和少量常驻能力；搜索命中后返回少量 `tool_reference`，系统再展开对应的完整 Tool 定义。

官方提供正则和 BM25 搜索，索引内容覆盖 Tool 名称、描述、参数名称和参数描述。这表明 Broker 的第一版不必运行第二个生成式 Agent，传统信息检索已经可以承担大部分工具发现工作。

可借鉴的规则是：

- 默认延迟加载大多数 Tool；
- 单次只返回少量候选；
- 搜索结果使用稳定 Tool Reference；
- Schema 只在候选进入下一步时展开；
- 搜索索引覆盖参数语义，而不只是工具名称。

### OpenAI Tool Search 与 Namespace

[OpenAI Agents SDK](https://openai.github.io/openai-agents-python/tools/)支持 Tool Search、延迟加载 Function Tool、Namespace 和 Hosted MCP Server。相关 Tool 可以使用 `defer_loading`，模型只在需要时搜索并加载当前回合相关的定义。

Namespace 可以让检索先确定领域，再在更小的工具集合中选择。SDK 还支持根据用户权限和运行环境动态过滤工具；[MCP 接入文档](https://openai.github.io/openai-agents-python/mcp/)则区分了 Hosted MCP 与客户端执行 MCP 的接入形态。

Profile、Namespace 和 Tool Search 解决的是不同粒度的问题：

```text
Profile       长期决定一个项目或 Agent 可以使用哪些 MCP
Namespace     给 Tool 建立稳定的领域边界
Tool Search   在当前任务中只加载真正相关的 Tool
```

### Composio Sessions / Tool Router

[Composio Sessions / Tool Router](https://docs.composio.dev/reference/v3/api-reference/tool-router)提供了更偏商业产品的 Broker 形态：创建用户会话、限定可用 Toolkit 和 Connected Account、搜索 Tool、读取 Schema、执行 Tool，并在需要时发起授权。

它把 OAuth 和 API Key 保存在服务端，Agent 和应用代码不直接接触原始凭证。Session 同时承载用户身份、已连接账号、允许的工具集合和执行状态。

可以抽象出以下模型：

```text
Catalog             平台知道有哪些工具
Connected Account   某个用户连接了哪些外部账号
Session             当前任务允许看到和执行哪些工具
Execution Proxy     代用户注入凭证并可靠执行
```

[Pipedream MCP](https://pipedream.com/docs/connect/mcp/developers)也采用远程 MCP 聚合大量第三方应用，并内置终端用户授权、Token 存储和刷新。这说明 SaaS Broker 的核心价值不仅是搜索，还包括账号连接、凭证生命周期和稳定代理执行。

## 把领域 Agent 暴露成 Tool

业界确实在采用“第二 Agent”，但通常不会把它设计成透明的通用 MCP Gateway，而是把边界明确的领域专家封装成高层 Tool。

### AWS Multi-Agent Collaboration

[Amazon Bedrock Multi-Agent Collaboration](https://docs.aws.amazon.com/en_us/bedrock/latest/userguide/agents-multi-agent-collaboration.html)采用 Supervisor Agent 和 Collaborator Agent。Supervisor 统一规划并与用户交互，Collaborator 负责清晰且尽量不重叠的专业领域。

它带来的设计原则是：

- 主 Agent 保留全局目标和用户上下文；
- 领域 Agent 的职责和工具集合必须明确；
- 不同领域尽量避免能力重叠；
- Supervisor 调用的是领域能力，而不是任意底层 Tool 的万能代理。

### Google 与 OpenAI 的 Agent-as-Tool

[Google 对 Sub-agent 与 Agent-as-Tool 的对比](https://cloud.google.com/blog/topics/developers-practitioners/where-to-use-sub-agents-versus-agents-as-tools/)将 Agent-as-Tool 描述为面向离散任务的自包含专家：主 Agent 决定何时调用，专家 Agent 在自己的上下文和工具范围内完成任务，再返回结果。

[OpenAI Agents SDK](https://openai.github.io/openai-agents-python/tools/)也支持把 Agent 暴露为另一个 Agent 可调用的 Tool，并提供结构化输入输出、Approval Gate、结果抽取和嵌套运行追踪。

因此领域 Agent 不应只提供一个完全开放的 `run(prompt)`，而应使用显式业务契约：

```json
{
  "goal": "分析 Service A 最近出现超时的原因",
  "context": {
    "time_range": "最近 30 分钟",
    "environment": "production"
  },
  "constraints": {
    "allow_write": false,
    "max_steps": 8,
    "max_duration_seconds": 120
  }
}
```

返回结果需要保留证据和执行轨迹：

```json
{
  "status": "completed",
  "summary": "超时主要集中在一个下游依赖",
  "evidence": [],
  "tool_calls": [],
  "uncertainties": [],
  "next_actions": []
}
```

领域 Agent 适合封装这样的稳定能力：

```text
diagnose_service_incident
analyze_client_logs
review_release_risk
investigate_dependency_chain
prepare_change_plan
```

## 推荐架构与组件边界

```text
用户
  │
  ▼
客户端主 Agent + Router Skill
  ├── 直接连接由 Profile 启用的普通 MCP
  │
  ├── Tool Broker MCP
  │     ├── search_tools
  │     ├── describe_tool
  │     ├── execute_tool
  │     └── auth / policy / audit
  │
  └── 领域 Agent Tools
        ├── diagnose_incident
        ├── analyze_dependency
        └── review_change
```

### Router Skill

Router Skill 保存稳定的领域知识和使用规则：什么意图属于什么领域、常见任务顺序、哪些操作需要确认，以及什么时候应该升级到领域 Agent。

它不保存全部 Tool Schema，不保存 Token，也不承担实时目录同步。

### Tool Broker

Broker 保持确定性接口：

```text
search_tools(query, namespace, risk, context)
describe_tool(tool_ref)
execute_tool(tool_ref, schema_version, arguments)
```

它可以使用关键词、BM25、Embedding 或轻量模型重排结果，但不自行制定完整业务计划。参数缺失时返回结构化错误，让主 Agent 补充，而不是自行猜测。

### 领域 Agent

领域 Agent 只承接可以作为独立工单验收的复杂任务：

- 内部通常需要多次调用 Tool；
- 有稳定 SOP 和明确终止条件；
- 能独立返回证据、结论和不确定性；
- 可以限制步骤、时长、调用量和数据量；
- 默认只读，高风险操作采用计划与执行分离。

## Registry 与鉴权模型

Tool Registry 至少需要保存：

```yaml
tool_ref: call-graph.query-upstream
namespace: observability.call-graph
server_ref: call-graph-mcp
description: 查询指定服务的上游调用来源
input_schema_ref: schema://call-graph.query-upstream/v1
domains:
  - observability
intents:
  - 上游
  - 谁调用我
risk: read
auth_scopes:
  - call-graph.read
owner: team-observability
version: v1
health: available
```

搜索时先按身份、项目、环境和权限过滤，再进行关键词、BM25、向量召回和可选重排。

配置同步与运行时授权要分开处理：

| 问题 | 推荐方式 |
| --- | --- |
| 配置跨设备同步 | 同步 `SecretRef` 和认证需求，不默认同步明文 |
| Broker 运行时执行 | 根据用户和 Session 解析 Connected Account 或委托身份 |
| 底层资源授权 | 继续由底层系统校验最终用户权限 |
| Token 刷新 | 由 Secret Provider 或授权服务完成 |
| 写操作 | 风险分级、显式确认、幂等和完整审计 |

统一代理不等于统一提权。Gateway 不应使用一个可以绕过所有底层权限的共享万能账号。

## 推荐落地顺序

### 第一阶段：Manager 与 Catalog

- 导入现有 MCP 配置；
- 建立 Server、Group、Profile、Target 和 SecretRef；
- 为不同 Agent 生成原生配置；
- 支持分组、批量开关、设备 Overlay 和非敏感同步；
- Catalog 同时保存未来 Broker 所需的 Tool 元数据。

### 第二阶段：只读 Broker

- 选择少量高频只读 MCP；
- 暴露 `search_tools`、`describe_tool` 和 `execute_tool`；
- 先使用标签、别名和 BM25；
- 每次返回 3～5 个候选；
- 实现用户身份透传、Schema 缓存和结构化调用日志；
- 建立真实意图评测集，观察 Top 1 和 Top 3 命中率。

### 第三阶段：语义检索与 Session

- 引入向量召回和轻量重排；
- 按 Namespace、Profile、权限和环境预过滤；
- 建立用户 Session 与 Connected Account；
- 缓存最近使用 Tool、Schema 和授权状态；
- 对大结果提供分页、摘要和结果引用。

### 第四阶段：首个领域 Agent

- 从真实轨迹中选择一个重复且稳定的多工具流程；
- 将它暴露成名称明确、输入结构化的高层 Tool；
- 默认只读并设置步骤、时间和调用次数预算；
- 返回计划、证据、Tool Trace、不确定性和后续建议；
- 保留 Broker 作为调试、人工接管和能力兜底通道。

## 适用边界

这套分层适合工具数量较多、工具由多个团队维护、需要统一鉴权审计，或者存在可复用领域工作流的 Agent 平台。

如果 MCP 数量有限，客户端原生 Profile 已经能够稳定工作，就没有必要为了形式统一强制代理所有请求。Broker 增加了在线依赖和故障面；领域 Agent 还会增加模型延迟、成本和评测负担。

## 常见错误

### 让 Agent 动态安装任意 MCP

运行时搜索和会话加载值得借鉴，但生产 Catalog 应经过审批。不要让模型根据不可信搜索结果安装和运行任意 Server。

### 给通用 Gateway 加一个万能 Prompt

每次调用都让 Gateway 内的模型重新理解目标，会产生双重规划、重复上下文和难以追踪的参数推断。生成式智能应限制在边界明确的领域 Agent 中。

### Broker 只返回底层地址

如果客户端仍要动态注册地址、处理认证和兼容性，Broker 没有真正收敛复杂度。Runtime Broker 应代理执行；配置管理器则可以显式生成客户端直连配置。

### 混合配置同步和运行时 Token

配置同步解决 Desired State；运行时授权解决某个用户此刻能否执行某个 Tool。两者可以共享 Secret Reference，但不应共享明文同步通道。

### 隐藏第二 Agent 的执行轨迹

领域 Agent 必须保留工具调用、参数来源、证据、不确定性和预算终止原因，否则无法区分模型规划、工具检索、Schema 和底层执行中的不同故障。

## 公开参考

- [Docker Dynamic MCP](https://docs.docker.com/ai/mcp-catalog-and-toolkit/dynamic-mcp/)
- [Amazon Bedrock AgentCore Gateway](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/gateway-using.html)
- [AgentCore Gateway Quickstart](https://aws.github.io/bedrock-agentcore-starter-toolkit/user-guide/gateway/quickstart.html)
- [ToolHive](https://github.com/stacklok/toolhive)
- [Anthropic Tool Search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- [OpenAI Agents SDK Tools](https://openai.github.io/openai-agents-python/tools/)
- [OpenAI Agents SDK MCP](https://openai.github.io/openai-agents-python/mcp/)
- [Composio Sessions / Tool Router](https://docs.composio.dev/reference/v3/api-reference/tool-router)
- [Pipedream MCP for Developers](https://pipedream.com/docs/connect/mcp/developers)
- [Amazon Bedrock Multi-Agent Collaboration](https://docs.aws.amazon.com/en_us/bedrock/latest/userguide/agents-multi-agent-collaboration.html)
- [Google：Sub-agents 与 Agents as tools](https://cloud.google.com/blog/topics/developers-practitioners/where-to-use-sub-agents-versus-agents-as-tools/)

## 相关文章

- [MCP 配置管理与同步](./mcp-configuration-management-and-sync.md)
- [MCP 工具网关：基础架构与核心契约](./mcp-gateway-foundation.md)
- [Broker 型 MCP 网关](./mcp-gateway-tool-broker.md)
- [Agent 型 MCP 网关](./mcp-gateway-agent-proxy.md)
