---
title: Agent 原生 API Tool 设计：从任意 HTTP 到安全插件
date: 2026-08-26
tags:
  - AI Agent
  - MCP
  - Tool Design
  - API 安全
description: 设计适合 Agent 的 API 插件、工具发现与执行契约，在灵活性、上下文成本和写操作安全之间取得平衡。
---

# Agent 原生 API Tool 设计：从任意 HTTP 到安全插件

## 要解决的问题

把 API 客户端变成 Agent 插件，看起来只需要暴露一个 `send_http` Tool，或者把每个 OpenAPI Operation 生成一个 Function。两种极端都存在明显问题：

- 一个任意 HTTP Tool 过于宽泛，Agent 可能访问错误域名、泄漏凭据或绕过业务策略；
- 每个接口一个 Tool 会产生巨大工具目录，让 Schema 占满上下文，并增加错误选择概率；
- 如果 Tool 只负责发送请求，Agent 仍需重新实现环境、鉴权、测试和审计；
- 如果 Tool 自动执行所有写操作，又会把自然语言误解直接放大成真实副作用。

Agent 原生 API 插件需要在“可发现、可组合、可约束、可解释”之间建立稳定合同。

## 插件的组成

一个完整插件可以由三层组成：

```text
Skill
  └── 领域流程、选择规则、成功标准、安全边界

MCP Server / Tools
  └── 结构化发现、预览、执行、测试和结果读取

Optional UI
  └── 请求预览、人工审批、Diff、历史和 Artifact
```

Skill 保存相对稳定的领域知识，不复制所有接口 Schema。MCP 提供当前真实的工具和资源。UI 是可选的人类控制面，不应成为另一套执行逻辑。

## 两种错误的 Tool 形态

### 错误一：一个接口一个 Tool

```text
create_order
get_order
cancel_order
create_user
update_user
...
```

当接口数量上升到数百或数千时，模型需要同时理解大量相似名称与 Schema。即使上下文允许，工具选择和版本维护也会变得困难。

如果平台支持 Tool Search 或 MCP 延迟发现，可以按领域加载少量相关工具；否则应该提供稳定的 Operation 检索与执行接口。

### 错误二：只有 send_http

```json
{
  "method": "POST",
  "url": "https://api.example.com/orders",
  "headers": {},
  "body": {}
}
```

这个接口没有表达：

- 目标是否属于允许域名；
- 当前环境是否可以写入；
- 参数是否符合 OpenAPI；
- Token 应由谁注入；
- 操作是否幂等；
- 哪些字段必须脱敏；
- 成功后如何验证和清理。

任意 HTTP 能力可以作为受限探索工具保留，但不应成为正式 API 操作的唯一入口。

## 推荐的两阶段工具面

### 接口发现

```text
search_operations(query, service?, method?, risk?)
describe_operation(operation_id, schema_version?)
```

`search_operations` 只返回少量候选摘要：

```json
{
  "operations": [
    {
      "operation_id": "createOrder",
      "summary": "创建订单",
      "method": "POST",
      "risk": "write",
      "environments": ["testing", "staging"],
      "schema_version": "2026-08-26"
    }
  ]
}
```

Agent 选定候选后，再用 `describe_operation` 获取完整参数、约束、示例和错误类型。这样既降低上下文成本，也减少名称相似导致的误调用。

### 请求预览与执行

```text
preview_operation(operation_id, environment, input)
execute_operation(operation_id, environment, input, approval_ref?, idempotency_key?)
```

`preview_operation` 应返回脱敏后的最终方法、路径、参数摘要、风险、预期副作用和清理计划。它不发送请求。

`execute_operation` 必须重新执行服务端校验，不能相信 Agent 已经调用过预览。审批引用、Schema 版本、环境、身份和幂等键都应成为执行记录的一部分。

## 测试工具面

正式测试不应让 Agent 每次重新拼装请求。插件可以进一步提供：

```text
list_tests(query?, tag?, risk?)
describe_test(test_ref)
run_test(test_ref, environment, fixture_ref?)
run_suite(suite_ref, environment)
get_run(run_id)
get_artifact(artifact_ref)
promote_run_to_regression(run_id, target_path)
```

其中 `promote_run_to_regression` 不应直接静默写入主分支。更安全的方式是生成草稿测试或代码补丁，交给人和 Agent 审查后进入正常代码评审。

## Tool 描述必须包含什么

Tool Description 不只是功能简介，还应说明：

- 何时使用、何时不使用；
- 必填参数与稳定标识；
- 是否产生副作用；
- 是否可以安全重试；
- 哪些错误需要补充参数，哪些错误不应重试；
- 返回值字段和 Artifact 行为；
- 是否需要用户确认；
- 环境和权限限制。

例如：

```text
execute_operation

Executes one registered API operation in an allowed environment.
Use only after operation discovery and input validation.
This tool may have side effects. Write operations require approval_ref.
Retries are allowed only when retry_safe is true in the preview result.
Returns a compact result and stores large payloads as artifacts.
```

## 风险分级与审批

至少区分三类操作：

| 风险 | 示例 | 默认策略 |
| --- | --- | --- |
| read | 查询、列表、健康检查 | 测试环境可自动执行 |
| write | 创建、更新、触发任务 | 预览副作用，按环境审批 |
| destructive | 删除、退款、回滚、生产变更 | 强制逐次审批，禁止自动重试 |

审批不能只依赖 Tool 名称。插件应根据最终解析出的 Operation、环境、参数和身份计算风险。一个看似普通的更新接口，如果目标是生产环境或影响大量资源，也应升级风险等级。

## 安全执行边界

### 域名与环境白名单

正式 Tool 只能访问注册的服务和环境。探索 Tool 也应限制协议、域名、端口和重定向目标。

### 凭据代理

Agent 只引用 Credential Profile，不直接读取 Token。Runner 在服务端或本地安全进程中注入凭据，并在日志和返回值中脱敏。

### 参数和响应校验

输入必须通过 Schema 与业务规则校验。响应不仅需要限制大小，还应对敏感字段、二进制内容和未知 Content-Type 做处理。

### 幂等与重试

Tool 应明确返回 `retry_safe`。写操作必须使用幂等键或稳定请求标识；超时不能自动被解释为失败并盲目重发。

### 审计

每次执行至少记录：

- 用户目标和调用 Agent；
- Operation、Schema 版本和环境；
- 脱敏参数摘要；
- 身份与审批引用；
- requestId、耗时和错误分类；
- 产生的资源和清理状态；
- 运行 Artifact。

## 大结果与上下文控制

Agent 不需要在上下文中看到完整响应。推荐返回：

```json
{
  "run_id": "run_123",
  "status": "passed",
  "http_status": 200,
  "summary": {
    "items": 200,
    "next_cursor": "cursor_123"
  },
  "artifact_ref": "artifact://run_123/response.json"
}
```

Agent 可以按需读取特定字段、分页或 Artifact 片段。默认返回巨大 JSON 会增加成本，也会让关键错误淹没在无关数据中。

## 评估 Tool 是否适合 Agent

不要只验证“能否调用成功”，还应建立代表性任务集：

- 能否从自然语言稳定找到正确 Operation；
- Top 1、Top 3 检索命中率；
- 是否错误选择生产环境；
- 写操作审批覆盖率；
- 参数校验失败是否能给出可修复错误；
- Agent 是否会在超时后重复提交；
- 大响应是否被正确摘要和保存；
- 运行结果是否包含足够证据；
- 相同任务在不同模型下是否仍满足安全合同。

## 适用边界

只有十几个内部只读接口时，直接生成 Function Tool 可能更简单。只有当 Operation 数量、Schema 体积、环境差异或治理要求显著增加时，才需要搜索—描述—执行的 Broker 结构。

MCP 也不是唯一协议。只要 Agent 能以强类型方式调用稳定 Tool，并且系统能够实施审批、授权和审计，Function Calling、CLI 或内部 RPC 都可以实现相同架构。

## 常见错误

### Skill 保存全部 OpenAPI

Skill 会迅速膨胀并随接口变化而失效。Skill 保存领域策略，真实 Schema 应由 Tool 或 Registry 动态提供。

### 审批后允许 Agent 任意修改参数

审批必须绑定最终环境、Operation 和参数摘要。参数变化后需要重新预览和审批。

### 用平台万能账号执行

插件不应绕过底层资源级授权。优先传递用户委托身份，并让目标服务继续完成最终校验。

### 把自然语言摘要当作审计记录

审计必须记录结构化调用事实。Agent 的解释只能作为附加信息。

## 系列文章

1. [Agent 时代的 API 管理工具：从请求编辑器到能力基础设施](./agent-native-api-management-from-client-to-infrastructure.md)
2. [Agent 原生 API 测试：从临时探索到稳定回归](./agent-native-api-testing-exploration-to-regression.md)
3. [Agent 原生 API 测试架构：事实来源、Runner 与多入口](./agent-native-api-source-of-truth-and-execution-architecture.md)
4. 本文：从任意 HTTP 到安全插件
5. [Agent 原生 API 工具的 Human UI：从操作台到审查控制面](./agent-native-api-human-control-surface.md)

## 公开参考

- [OpenAI MCP and Connectors](https://developers.openai.com/api/docs/guides/tools-connectors-mcp)
- [OpenAI Tool Search](https://developers.openai.com/api/docs/guides/tools-tool-search)
- [OpenAI Function Calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Postman MCP Server](https://learning.postman.com/docs/reference/postman-api/postman-mcp-server/overview/)
- [Koh：面向 Agent 的 Insomnia CLI](https://developer.konghq.com/koh/)
- [Yaak MCP Server](https://yaak.app/docs/getting-started/mcp-server)
