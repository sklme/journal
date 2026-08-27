---
title: Agent 原生 API 工具的 Human UI：从操作台到审查控制面
date: 2026-08-26
tags:
  - AI Agent
  - API 管理
  - Human in the Loop
  - 产品设计
description: 重新定义 API 工具中的人工界面，使其服务于发现、预览、审批、证据与历史，而不是成为第二份请求事实来源。
---

# Agent 原生 API 工具的 Human UI：从操作台到审查控制面

## 要解决的问题

当 Agent、CLI 和 CI 可以完成请求构造与执行后，团队可能发现自己不再需要每天打开 Postman 或 Insomnia，却仍然缺少一个适合人的界面：

- 不知道当前有哪些接口和测试；
- 看不到 Agent 将要发送的最终请求；
- 无法方便地批准写操作；
- 失败后缺少响应 Diff、断言证据和执行历史；
- 非开发角色无法从代码和终端理解系统状态。

这说明 GUI 并没有失去价值，只是需要从“请求编辑器”转向“审查控制面”。

## 核心结论

未来的 UI 不应重新实现一套 API Client，而应成为 Shared Runner 或 Test Service 的人类视图：

```text
OpenAPI + 测试代码 + Fixtures
               ↓
          Runner / Service
          ↓      ↓      ↓
        Agent    CI     Human UI
```

UI 负责让系统可见、可批准、可回放和可管理。它不应单独保存正式请求、断言、密钥和环境语义。

## UI 的五个核心任务

### 1. 发现

帮助人快速回答：

- 有哪些服务、接口和测试场景？
- 某个 Operation 属于哪个版本和 Owner？
- 哪些接口具有写入或破坏性风险？
- 当前有哪些失败、废弃或缺少覆盖的测试？

发现页面应主要读取 OpenAPI、测试清单和 Registry，而不是依赖用户手工创建文件夹。

### 2. 预览

在执行前展示 Agent 和 Runner 解析出的最终意图：

- Operation、方法和脱敏路径；
- 目标环境和身份 Profile；
- 参数与 Fixture 差异；
- 预计副作用和影响范围；
- 重试安全性和幂等键；
- 成功标准与清理计划。

预览的重点不是展示所有 Header，而是帮助人判断“这是不是我想做的事”。

### 3. 审批

审批界面必须绑定最终执行摘要：

```text
谁发起 → 为什么执行 → 调用什么 → 在哪个环境 → 影响什么 → 如何恢复
```

如果 Agent 在审批后修改 Operation、环境或关键参数，原审批立即失效。高风险操作还应要求短时有效、不可复用的批准记录。

### 4. 证据

运行完成后，UI 应把结论拆成可核对证据：

- 状态码、耗时和 requestId；
- Schema 与业务断言；
- Expected/Actual Diff；
- 创建、修改和删除的资源；
- 清理是否成功；
- 日志、Trace 和完整响应 Artifact；
- Agent 的解释与建议。

Agent 总结可以帮助阅读，但结构化运行事实应始终可独立查看。

### 5. 历史与治理

团队需要查看：

- 同一测试最近的通过率和耗时趋势；
- 某次发布前后的行为变化；
- 谁在什么环境执行过写操作；
- 哪些失败长期没有 Owner；
- 测试定义与运行所使用的 Git 修订版本；
- 哪些临时场景值得晋升为回归测试。

这些能力属于测试管理与治理，而不是传统请求编辑器的核心模型。

## 推荐的信息架构

### Overview

- 环境健康状态；
- 最近失败和阻塞运行；
- 等待审批的操作；
- 高风险接口和覆盖缺口；
- 最近变更的 API 契约。

### Catalog

- 服务、Operation 和 Schema；
- 测试套件、标签、Owner 和风险；
- 接口到测试的覆盖关系；
- 废弃与版本兼容状态。

### Run

- 环境和 Fixture 选择；
- Agent 生成的参数建议；
- 最终请求预览；
- 单个测试或 Suite 执行；
- 实时阶段、日志摘要和取消操作。

### Results

- 断言、Diff 和 Artifact；
- 请求链与失败步骤；
- 副作用和清理；
- 复制稳定 CLI 命令；
- 创建 Issue 或生成回归测试草稿。

### Governance

- 审批策略；
- 环境与 Credential Profile；
- Role、Owner 和审计；
- 数据保留、脱敏和导出策略。

## 运行状态模型

UI 不应只显示一个旋转图标。推荐明确状态：

```text
draft
  ↓
validated
  ↓
waiting_for_approval ──→ rejected
  ↓
queued
  ↓
running
  ├──→ passed
  ├──→ failed
  ├──→ blocked
  └──→ cancelled
          ↓
       cleanup
          ├──→ completed
          └──→ cleanup_failed
```

`failed` 与 `blocked` 必须区分：前者说明断言或执行失败，后者说明缺少权限、凭据、环境或依赖，不能简单归类为产品缺陷。

## UI 与 Agent 的协作

### Agent 发起，UI 批准

用户在对话中描述目标，Agent 完成 Operation 搜索、参数准备和风险分析。需要写操作时，系统生成 Approval 页面；用户批准后，Agent 继续执行并解释结果。

### UI 发起，Agent 解释

用户也可以在 Catalog 中选择测试并运行。失败后，UI 将结构化证据交给 Agent，由 Agent结合代码和日志解释原因。

### UI 修改，生成可审查变更

用户在 UI 中调整参数或新增断言时，不直接产生隐藏状态。系统应生成 Fixture、测试代码或版本化配置的 Diff，通过正常代码评审进入权威来源。

## 最小可行 UI

开发者小团队不需要一开始就建设完整平台。MVP 可以只有四个页面：

1. 从 OpenAPI 和测试清单生成的 Catalog；
2. 测试环境中的运行表单与请求预览；
3. 单次运行的断言、Diff 和 Artifact；
4. 最近运行与等待审批列表。

登录、权限、密钥和审计尽量复用现有基础设施。不要在第一版实现复杂拖拽编排、低代码脚本语言和双向 Collection 同步。

## 什么时候可以直接使用现有工具

如果主要需求只是手工修改参数和查看响应，Bruno、Yaak、Hoppscotch 或传统客户端仍然足够。可以把它们视为可替换 UI，但应遵守：

- 正式契约从 OpenAPI 导入；
- 重要测试最终回到测试代码；
- Collection 不成为唯一资产；
- 密钥不进入共享文件；
- CI 调用稳定 Runner，而不是依赖某台桌面应用。

如果需求已经包含审批、集中审计、长任务、运行历史和跨角色协作，则更适合在 Test Service 上建设专用控制面。

## 产品指标

UI 的成功不应以“用户发送了多少次请求”衡量。更有价值的指标包括：

- 高风险操作获得正确审批的比例；
- 用户从失败到定位原因的时间；
- 运行结果包含完整证据的比例；
- 临时测试晋升为回归测试的数量；
- OpenAPI、测试和 UI 状态的漂移数量；
- 重复手工配置环境与凭据的次数；
- 非开发角色能够独立理解运行结果的比例。

## 常见错误

### 把聊天框放进旧 UI 就称为 Agent 原生

如果 Agent 只能生成文本，无法调用同一 Runner、读取结构化结果和遵守审批策略，它仍然只是助手，不是完整工作流入口。

### UI 保存第二套正式请求

这会再次制造漂移。UI 中的持久化修改必须转化为权威资产的可审查 Diff。

### 审批页面只显示 Tool 名称

用户需要看到最终环境、关键参数、影响范围和恢复方式。`execute_operation` 本身不是有意义的风险说明。

### 只展示 Agent 总结

自然语言结论不能替代断言、requestId、Artifact 和副作用记录。

### 第一版就建设完整测试管理平台

先验证 Catalog、预览、运行、证据和审批五个核心闭环，再根据真实协作成本增加趋势、Owner 和治理能力。

## 系列文章

1. [Agent 时代的 API 管理工具：从请求编辑器到能力基础设施](./agent-native-api-management-from-client-to-infrastructure.md)
2. [Agent 原生 API 测试：从临时探索到稳定回归](./agent-native-api-testing-exploration-to-regression.md)
3. [Agent 原生 API 测试架构：事实来源、Runner 与多入口](./agent-native-api-source-of-truth-and-execution-architecture.md)
4. [Agent 原生 API Tool 设计：从任意 HTTP 到安全插件](./agent-native-api-tools-and-plugin-design.md)
5. 本文：从操作台到审查控制面
