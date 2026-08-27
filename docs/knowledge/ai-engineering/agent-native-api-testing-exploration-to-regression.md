---
title: Agent 原生 API 测试：从临时探索到稳定回归
date: 2026-08-26
tags:
  - AI Agent
  - API 测试
  - 测试自动化
  - CI
description: 建立临时探索、可复用命令与自动化回归之间的晋升路径，让 Agent 生成的请求转化为稳定测试资产。
---

# Agent 原生 API 测试：从临时探索到稳定回归

## 要解决的问题

Agent 可以根据代码和接口文档临时写脚本发起请求，这比在图形界面中手工填写参数更快，也更容易串联登录、查询、写入和日志分析。

但“这次调用成功”并不等于“已经完成测试”。如果脚本只存在于临时目录或对话上下文中，下次运行可能改变实现，其他人也无法稳定复现。更严重的是，Agent 可能只观察到 HTTP 200，却没有验证响应语义、数据副作用、权限边界和清理结果。

Agent 原生工作流需要一条明确的资产晋升路径：允许探索保持轻量，同时把重要发现逐步提升为稳定命令和回归测试。

## 核心结论

不要要求所有请求一开始就进入正式测试，也不要让所有请求永远停留在临时代码。推荐分为三层：

```text
临时探索
   ↓ 具有复用价值
稳定命令 / 场景入口
   ↓ 具有质量保证价值
自动化回归测试
```

每一层解决不同问题：

| 层级 | 目标 | 典型产物 | 生命周期 |
| --- | --- | --- | --- |
| 临时探索 | 快速理解和复现 | 临时脚本、一次性命令 | 用后删除或归档 |
| 稳定入口 | 让人和 Agent 可重复执行 | CLI 子命令、共享 SDK、Fixture | 跟随接口维护 |
| 回归测试 | 持续证明行为未退化 | 测试代码、断言、CI 结果 | 进入质量门禁 |

## 第一层：临时探索

适合临时探索的情况包括：

- 第一次理解未知接口；
- 快速验证参数组合；
- 串联多个请求定位失败环节；
- 根据一次响应继续查日志或数据库；
- 判断问题是否值得沉淀。

对 Agent 的请求应明确环境、安全边界和证据要求：

```text
根据 OpenAPI 和当前代码调用测试环境的订单查询接口。
默认只执行只读请求，不输出任何凭据。
记录状态码、耗时、requestId 和关键响应字段。
如果需要写操作，先说明副作用和清理方式。
```

临时脚本应放在明确的临时目录，不进入业务源码。它仍应复用项目已有的鉴权和 API Client，避免重新实现签名、重试与序列化。

## 第二层：稳定命令或场景入口

当一个操作开始重复出现，应该把它提升为稳定入口。例如：

```bash
api-test run order.get \
  --env testing \
  --input fixtures/order/existing.json \
  --report artifacts/order-get.json
```

稳定入口的价值不是缩短命令，而是固定执行合同：

- 参数名称和类型稳定；
- 环境选择显式；
- 鉴权从安全位置注入；
- 输出为可解析的结构化结果；
- 超时、重试和错误类型一致；
- 大响应写入文件，只返回摘要和路径；
- 写操作具有预览、审批和幂等保护；
- 运行结果可以被人、Agent 和 CI 共同消费。

CLI 是常见入口，但并不是唯一方案。项目 SDK、测试服务 API 或任务队列也可以承载相同合同。关键是不要每次让 Agent 重新发明调用方式。

## 第三层：自动化回归测试

以下场景应优先提升为回归测试：

- 已经发现并修复的缺陷；
- 核心成功路径和高风险失败路径；
- 权限、幂等、并发和状态机边界；
- 容易受依赖升级或协议变更影响的接口；
- 发布前必须持续验证的契约。

一个回归测试至少应验证业务不变量，而不只是状态码：

```ts
test('相同幂等键不会创建两个订单', async () => {
  const key = createUniqueId()

  const first = await api.orders.create({ idempotencyKey: key })
  const second = await api.orders.create({ idempotencyKey: key })

  expect(first.status).toBe(200)
  expect(second.orderId).toBe(first.orderId)
  expect(await api.orders.countByKey(key)).toBe(1)
})
```

测试结束后还应删除创建的数据，或者使用隔离的短生命周期环境。清理失败本身需要进入运行结果，不能静默忽略。

## 什么时候应该晋升

可以用一组简单问题判断是否值得沉淀：

1. 未来是否可能再次执行？
2. 是否包含容易写错的鉴权、签名或参数转换？
3. 是否用于证明一个缺陷已经修复？
4. 是否具有权限、资金、数据一致性或生产风险？
5. 是否需要被其他人或 CI 重复验证？

只要其中两项为“是”，就应至少形成稳定命令；如果涉及缺陷修复或发布质量门禁，应进一步形成回归测试。

## 运行结果必须是证据，而不是叙述

Agent 的最终总结容易遗漏细节，因此 Runner 应首先输出结构化证据：

```json
{
  "run_id": "run_123",
  "environment": "testing",
  "operation_id": "getOrder",
  "status": "passed",
  "http_status": 200,
  "duration_ms": 184,
  "request_id": "req_123",
  "assertions": [
    { "name": "status is 200", "passed": true },
    { "name": "order belongs to expected user", "passed": true }
  ],
  "artifact": "artifacts/run_123.json"
}
```

Agent 再根据证据解释结论。这样即使自然语言摘要出现遗漏，原始运行事实仍然可验证。

## 环境与安全边界

推荐把环境按风险而不是按 URL 字符串管理：

| 环境 | 默认能力 |
| --- | --- |
| local | 允许读写，可自动清理 |
| testing | 默认只读；白名单写操作可自动执行 |
| staging | 写操作需要显式确认 |
| production | 默认禁止；授权后仍需逐次审批 |

凭据只能通过环境变量、系统凭据存储或 Secret Manager 注入。Agent、日志、Fixture、测试报告和 Git 中都不应出现真实 Token、Cookie 或证书。

## 验收指标

Agent 原生 API 测试体系可以观测以下指标：

- 临时请求晋升为稳定入口的比例；
- 已修复缺陷拥有回归用例的比例；
- 同一场景在本地与 CI 的结果一致率；
- 测试失败中环境问题、断言问题和产品缺陷的分布；
- 写操作审批覆盖率；
- 测试数据清理成功率；
- Agent 重新生成一次性调用代码的频率。

最后一项持续过高，通常说明稳定 Runner 或 Tool 设计仍不完整。

## 常见错误

### 把 HTTP 200 当作测试通过

状态码只能证明传输层结果。还需要验证 Schema、业务字段、权限和副作用。

### 保存所有临时脚本

无差别沉淀会制造大量重复、无人维护的测试资产。只有具有复用或质量保证价值的场景才应晋升。

### 只保存对话，不保存可执行入口

对话可以解释问题，却不是确定性测试合同。最终产物必须脱离当前会话独立执行。

### 让 Agent 在测试代码中写入密钥

即使仓库是私有的，也不能把凭据写进脚本。密钥必须在运行时注入，并在输出中自动脱敏。

### 回归测试依赖不可控的共享数据

共享账号和固定 ID 容易产生顺序依赖。优先创建唯一数据、隔离命名空间，并保证清理可观测。

## 系列文章

1. [Agent 时代的 API 管理工具：从请求编辑器到能力基础设施](./agent-native-api-management-from-client-to-infrastructure.md)
2. 本文：从临时探索到稳定回归
3. [Agent 原生 API 测试架构：事实来源、Runner 与多入口](./agent-native-api-source-of-truth-and-execution-architecture.md)
4. [Agent 原生 API Tool 设计：从任意 HTTP 到安全插件](./agent-native-api-tools-and-plugin-design.md)
5. [Agent 原生 API 工具的 Human UI：从操作台到审查控制面](./agent-native-api-human-control-surface.md)

## 公开参考

- [Create a CLI Codex can use](https://learn.chatgpt.com/use-cases/agent-friendly-clis)
