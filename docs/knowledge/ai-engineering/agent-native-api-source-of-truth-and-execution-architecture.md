---
title: Agent 原生 API 测试架构：事实来源、Runner 与多入口
date: 2026-08-26
tags:
  - AI Agent
  - API 测试
  - 软件架构
  - Single Source of Truth
description: 划分接口契约、测试场景、环境和执行结果的权威来源，并用共享 Runner 支撑 Agent、CLI、UI 与 CI。
---

# Agent 原生 API 测试架构：事实来源、Runner 与多入口

## 要解决的问题

当团队从 Postman Collection 转向 Agent 和代码化测试时，很容易得出一个过度简化的结论：把所有事实和所有命令都放进 CLI。

CLI 很适合作为稳定执行入口，却不适合保存接口契约、完整测试语义、密钥和运行历史。把所有内容塞进 CLI 参数只会形成新的单体工具，并让 UI、CI 和 Agent 难以共享资产。

真正需要建立的是两条原则：

1. 每类事实只有一个权威来源；
2. 所有入口共享同一个确定性执行内核。

## 核心架构

```text
OpenAPI + 测试代码 + Fixtures
               ↓
        共享 Runner / SDK
          ↓      ↓      ↓
        CLI      UI     CI
          ↑
        Agent
```

这张图中，CLI 是 Agent 和开发者最容易组合的入口，但真正的执行核心是 Runner/SDK。UI 可以直接调用 Runner，也可以在规模扩大后通过 Test Service API 调用同一内核。

## 不同事实的权威来源

“单一事实来源”不是把所有内容放进一个文件，而是同一类事实只有一个权威位置：

| 内容 | 推荐权威来源 | 不应成为权威来源的位置 |
| --- | --- | --- |
| 接口路径、参数和 Schema | OpenAPI、Proto、GraphQL Schema | 手工维护的请求副本 |
| 业务测试场景与断言 | 测试代码 | 对话摘要、运行报告 |
| 可复用输入数据 | Fixtures、数据工厂 | UI 临时表单状态 |
| 环境元数据 | 版本化配置 | 散落的本地客户端配置 |
| 密钥 | Secret Manager、系统凭据存储 | Git、Fixture、对话 |
| 执行语义 | Shared Runner/SDK | 每个入口各写一套实现 |
| 运行事实 | 结构化 Result、Artifacts | Agent 自然语言总结 |
| 历史趋势 | CI 或测试结果存储 | 单次本地终端输出 |

OpenAPI 不能替代业务断言，测试代码也不应复制所有接口 Schema。不同资产相互引用，而不是相互抄写。

## Shared Runner 的职责

Runner 是架构中的确定性内核，至少应负责：

- 根据 `operation_id` 解析接口定义；
- 校验输入参数和请求体；
- 选择环境并解析非敏感配置；
- 注入鉴权、证书和代理配置；
- 执行超时、重试、限流和幂等策略；
- 运行前置步骤、请求链和清理逻辑；
- 执行 Schema 与业务断言；
- 脱敏请求、响应和日志；
- 生成统一的运行结果和 Artifact；
- 记录审批、调用者、环境和副作用。

Runner 不负责理解开放式自然语言目标，也不应该自行决定高风险写操作是否符合用户意图。这些属于 Agent 规划和人工授权层。

## CLI 是统一执行协议，不是数据库

一个好的 CLI 应主要引用稳定资产：

```bash
api-test run order.create \
  --env testing \
  --fixture basic-order \
  --report artifacts/result.json
```

这里：

- `order.create` 指向测试场景或 OpenAPI Operation；
- `testing` 指向环境配置；
- `basic-order` 指向 Fixture；
- 断言、鉴权和清理由 Runner 负责；
- CLI 只负责参数解析、调用 Runner 和设置退出码。

因此，CLI 可以成为人、Agent 和 CI 的共同命令面，却不应保存密钥、测试内容和历史数据。

## UI 如何接入

小型本地工具可以让 UI 直接调用 Shared Runner：

```text
Desktop UI → Runner → API
CLI       → Runner → API
```

当需要多人协作、集中审计或长任务时，可以增加 Test Service：

```text
              CLI
               ↓
Agent → Test Service API ← UI
               ↑
              CI
               ↓
          Runner / Workers
```

此时 CLI 和 UI 都只是服务客户端。测试定义仍来自仓库或版本化 Registry，服务负责排队、凭据代理、运行记录和 Artifact 存储。

## 标准运行结果

所有入口应消费同一个结果模型。例如：

```ts
interface ApiTestRun {
  runId: string
  testRef: string
  revision: string
  environment: 'local' | 'testing' | 'staging' | 'production'
  status: 'passed' | 'failed' | 'blocked' | 'cancelled'
  startedAt: string
  durationMs: number
  requestId?: string
  assertions: Array<{
    name: string
    passed: boolean
    expected?: unknown
    actual?: unknown
  }>
  sideEffects: Array<{
    kind: string
    resourceRef: string
    cleanupStatus?: 'passed' | 'failed' | 'not-required'
  }>
  artifactRefs: string[]
}
```

UI 展示它，CI 根据状态设置门禁，Agent 根据断言和 Artifact 解释失败。任何入口都不应重新定义“通过”的含义。

## 避免第二份 Collection

UI 最常见的架构问题是保存一套独立请求数据。时间一长，就会出现：

- OpenAPI 已更新，UI 请求仍使用旧参数；
- 测试代码已经修复，Collection 中的断言仍然失败；
- CI 与开发者手工运行的环境变量不同；
- Agent 不知道应该相信仓库还是工作区。

推荐采用三种方式之一：

1. UI 直接读取 OpenAPI、测试清单和 Fixture；
2. UI 中的临时请求不持久化，重要请求通过“晋升”生成仓库变更；
3. 如果使用客户端 Collection，则由权威资产单向生成，并禁止反向手工同步。

不要建立无冲突规则的双向同步。双向编辑只有在双方共享同一种可合并文件格式、版本和校验规则时才可能可靠。

## 最小项目结构

```text
api/
  openapi.yaml
tests/
  api/
    orders/
      create.test.ts
      get.test.ts
  fixtures/
    orders/
      basic.json
tools/
  api-test/
    runner.ts
    cli.ts
artifacts/
  .gitkeep
```

其中 `artifacts/` 通常不进入 Git，只在本地、CI 或专门的 Artifact Store 中保留。环境文件只保存非敏感配置，真实凭据在运行时注入。

## 变更与一致性规则

建议建立以下自动检查：

- OpenAPI 语法和兼容性检查；
- 测试引用的 `operation_id` 必须存在；
- Fixture 必须通过请求 Schema 校验；
- 每个高风险接口至少有权限或失败路径测试；
- Runner 版本与运行结果 Schema 版本必须记录；
- UI 和 CLI 只接受 Runner 当前支持的 Result Schema；
- 生产环境执行必须携带审批记录和测试修订版本。

## 适用边界

只有少量接口、没有 CI、也没有跨角色协作时，直接使用项目测试框架可能已经足够，不必额外开发 Runner。

Shared Runner 的价值在于统一重复出现的鉴权、环境、执行和证据合同。如果项目测试天然共享同一套 Fixture、Client 和 Reporter，那么它本身已经承担了 Runner 的角色，不需要为了命名一致再包装一层。

## 常见错误

### 把 OpenAPI 当作完整测试

OpenAPI 能校验结构，却无法证明订单没有重复创建、用户只能读取自己的资源等业务不变量。

### 让 UI 直接拼装所有请求

这会绕过 Runner 的鉴权、审计、重试和安全策略。UI 应提交意图和参数，由 Runner 构造最终请求。

### CLI 与 CI 使用不同代码路径

本地成功、CI 失败往往来自执行实现分叉。两者必须调用同一 Runner，只允许环境与并发策略不同。

### 把运行报告提交进 Git

报告是执行事实，不是长期源代码。除非它是经过审查的固定基线，否则应保存在 Artifact Store 或测试结果系统中。

## 系列文章

1. [Agent 时代的 API 管理工具：从请求编辑器到能力基础设施](./agent-native-api-management-from-client-to-infrastructure.md)
2. [Agent 原生 API 测试：从临时探索到稳定回归](./agent-native-api-testing-exploration-to-regression.md)
3. 本文：事实来源、Runner 与多入口
4. [Agent 原生 API Tool 设计：从任意 HTTP 到安全插件](./agent-native-api-tools-and-plugin-design.md)
5. [Agent 原生 API 工具的 Human UI：从操作台到审查控制面](./agent-native-api-human-control-surface.md)
