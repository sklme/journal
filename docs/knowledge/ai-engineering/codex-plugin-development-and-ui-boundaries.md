---
title: Codex 插件开发：从 MCP Server 到对话内 UI
date: 2026-09-22
tags:
  - Codex
  - Plugin
  - MCP
  - MCP Apps
  - AI Engineering
description: 梳理 Codex 插件的组成、代码库检查插件的实现路径，以及 MCP UI 与原生 Tab 之间的能力边界。
---

# Codex 插件开发：从 MCP Server 到对话内 UI

## 要解决的问题

如果希望让 Codex 检查代码库，并把扫描结果以可交互界面展示出来，首先要区分三种能力：插件负责分发和组合，MCP Server 负责暴露工具，MCP Apps UI 负责展示工具结果。它们共同构成一个可安装的工作流，但并不等同于可以任意修改 Codex 主窗口的桌面插件。

## 插件的组成

Codex 插件可以组合以下部分：

```text
Plugin
├── Skill：触发条件、工作流、成功标准和安全边界
├── MCP Server：工具、结构化结果和鉴权
├── MCP Apps UI：可选的交互式结果界面
└── Hooks：在支持的 Codex 运行时阶段执行命令
```

只需要稳定流程说明时，Skill 就足够；需要读取仓库、运行检查器或连接外部服务时，应增加 MCP Server；只有当用户需要筛选、比较、确认或浏览结构化结果时，才增加 UI。

## 代码库检查插件的推荐架构

本地代码库检查适合使用本地 STDIO MCP Server，使分析程序与仓库处在同一执行环境中。工具可以按职责拆分为：

```text
scan_repository(input)
  → 执行静态分析、依赖检查或自定义规则
  → 返回结构化 findings、摘要、文件和行号

get_finding_detail(finding_id)
  → 返回规则、证据、影响和修复建议

render_findings(findings)
  → 返回 MCP Apps UI resource
```

`scan_repository` 应优先设计为只读工具。需要修改代码时，再单独提供 `apply_fix`，并让工具按照环境、文件范围和风险级别执行审批。工具结果应同时包含模型可理解的文本和可供 UI 使用的 `structuredContent`，这样即使宿主不渲染 UI，Codex 仍能完成分析。

推荐把数据处理和界面渲染拆开：先扫描并让模型筛选、归并问题，再调用渲染工具生成报告。这样可以避免每次数据工具调用都重新挂载组件，也能让界面只展示最终需要人工查看的内容。

## MCP UI 能做什么

MCP Server 可以将工具关联到一个 UI resource。组件通常在宿主提供的 iframe 中运行，通过 MCP Apps 的 `ui/*` JSON-RPC bridge 与宿主和 MCP Server 通信。一个代码审查界面可以提供：

- 按严重级别、规则和文件筛选；
- 展开问题详情和证据；
- 显示文件、行号和修复建议；
- 触发更多 MCP Tool 调用；
- 将用户选择或暂存修改同步给模型。

展示形态包括对话内卡片、全屏视图、模态窗口和画中画。全屏模式适合详细浏览报告，但仍然属于当前工具结果的 UI，而不是 Codex 主窗口中注册的新工作区页面。

## 与 Obsidian 插件的能力差异

Obsidian 插件可以通过宿主 API 注册命令、View、Workspace Leaf 和侧边栏，因此能够创建长期存在的原生 Tab。Codex 插件的公开模型更接近“Agent 能力和工作流扩展”：模型调用 MCP Tool，Tool 返回数据或 UI，宿主负责在对话上下文中展示。

截至 2026 年 9 月，公开文档没有提供向 Codex 主窗口注册永久 Tab、原生侧边栏或任意宿主菜单的 API。MCP UI 可以通过全屏、模态或画中画模拟一个审查工作台，但不能直接获得 Obsidian 式的 workspace leaf。

如果产品必须拥有永久 Tab，可以考虑三种替代方案：

1. 使用 MCP UI 的全屏模式，保存报告状态并提供持续交互；
2. 让 MCP Server 启动或连接一个本地 Web App，再从 UI 打开它；
3. 开发独立桌面应用或 IDE 扩展，获得真正的侧栏、Tab 和编辑器联动能力。

## 运行和权限边界

桌面端可以配置 STDIO 或 Streamable HTTP MCP Server；项目级配置只应在受信任的项目中使用。读取本地仓库时，工具应接收并校验仓库根目录，限制路径范围，默认不执行写操作。远程 HTTP Server 不能自动读取本地文件，除非额外提供文件上传或本地代理。

插件 UI 也不应成为第二套事实来源。业务数据和检查结果应由 MCP Server 保存和校验，UI 只保存选中项、展开状态和筛选条件等临时展示状态。所有写操作仍需由服务端重新校验，不能只依赖模型或 UI 传入的参数。

## 最小实现路径

可以按以下顺序实现：

1. 先用只读 `scan_repository` 返回结构化检查结果；
2. 增加一个 Skill，规定扫描顺序、结果解释和失败处理；
3. 增加 `render_findings` 和一个 MCP Apps UI；
4. 在 UI 中加入详情查看和重新扫描按钮；
5. 最后再增加需要审批的修复工具；
6. 在 Codex 桌面端和 CLI 等不同宿主中分别验证无 UI 回退路径。

## 常见错误

### 把 MCP UI 当成原生插件面板

MCP UI 是工具结果的可选呈现层。不要依赖它修改 Codex 的原生导航、Tab 或侧栏。

### 只返回 HTML，不返回结构化结果

没有结构化结果时，模型难以继续追问、筛选或调用后续工具；不支持组件的客户端也无法完成工作流。

### 让 UI 直接拥有业务写权限

UI 发起的操作仍应回到 MCP Server，由服务端做权限、范围、版本和风险校验，并返回新的权威状态。

### 用远程 Server 直接扫描本地目录

远程进程没有本地文件访问能力。代码扫描需要本地 STDIO、文件上传或受控的本地代理。

## 公开参考

- [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins?site_locale=en)
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Plugins reference](https://developers.openai.com/zh-Hans/plugins/reference)
- [Model Context Protocol](https://learn.chatgpt.com/docs/extend/mcp)
