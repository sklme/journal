---
title: Codex 使用 Modern Web Guidance：Skills 与浏览器工具的分工
date: 2026-10-19
tags:
  - Codex
  - Agent Skills
  - Chrome Extensions
  - MCP
description: 掌握 Modern Web Guidance 的接入方法，区分 Codex 现有浏览器能力与 Chrome DevTools MCP，按实际需求补充工具。
---

# Codex 使用 Modern Web Guidance：Skills 与浏览器工具的分工

## 要解决的问题

Chrome 的 AI 扩展开发指南同时介绍了 Modern Web Guidance 和 Chrome DevTools MCP。使用 Codex 时，需要分别判断两个问题：怎样补充开发知识，以及现有工具是否足以完成验证。

**Codex 可以使用这套 Skills；已有浏览器工具时，无需为了点击、截图或普通页面测试再安装一套 MCP。** 是否增加 DevTools MCP，应取决于扩展管理、性能诊断等具体流程，而不是看到教程推荐就全部接入。

本文于 **2026-10-19** 核对公开文档。安装命令和工具能力会随版本变化，以下示例是接入指南，不代表已在某个项目完成安装与端到端测试。

## 核心原理：知识与执行工具分别解决什么

| 组成 | 解决的问题 | 使用方式 |
| --- | --- | --- |
| `modern-web-guidance` Skill | 如何选择现代 Web API、处理兼容性与实现细节 | 给 Agent 提供查找和获取相关指南的流程 |
| `chrome-extensions` Skill | 如何组织 Chrome 扩展代码与准备商店资料 | 为扩展开发提供专门指导 |
| Codex 已有浏览器工具 | 页面是否能正常交互、实际显示与运行状态如何 | 使用当前环境已提供的浏览器能力 |
| Chrome DevTools MCP | 如何重复执行特定 Chrome 调试流程 | 接入独立 MCP Server，调用封装好的工具 |

Modern Web Guidance 的指南通过 CLI 按需检索和读取。Skill 提供的规则与资料，需要由 Agent 结合项目要求应用；安装 Skill 本身不会赋予浏览器操作权限。[Modern Web Guidance 入门](https://developer.chrome.com/docs/modern-web-guidance/get-started)

## 最小接入：先安装所需 Skills

在具备 Node.js、npm 和 `npx` 的环境中，进入目标项目目录，运行：

```bash
npx modern-web-guidance@latest install --choose
```

在向导中选择 Codex，再按任务选择技能：普通 Web 开发选择 `modern-web-guidance`；开发 Chrome 扩展时，同时选择 `chrome-extensions`。确认安装作用域，并在安装后检查 Codex 是否已发现相应技能；必要时重新加载应用或新建会话。[Chrome 扩展开发指南](https://developer.chrome.com/docs/extensions/ai/build-with-ai#modern_web_guidance)

Codex 支持明确指定技能，也能根据任务匹配技能描述。用下面的提示词可以让调用意图更清晰：[OpenAI Skills 文档](https://learn.chatgpt.com/docs/customization/overview#skills)

```text
使用 modern-web-guidance 技能检查这个项目。
先确认目标浏览器和兼容性要求，再改进弹窗的语义、键盘操作和动画。
完成后，用当前可用的浏览器工具验证，并报告实际检查过的行为。
```

扩展开发示例：

```text
使用 chrome-extensions 和 modern-web-guidance 技能，创建 Manifest V3 便签扩展。
点击扩展按钮打开 popup，支持保存便签，并在重新打开后恢复内容。
采用最小必要权限，并记录验证结果。
```

项目可以在 `AGENTS.md` 中声明 Baseline 目标。未配置时，Modern Web Guidance 默认采用 Baseline Widely available；实际项目仍需明确浏览器版本及降级要求，尤其不能用普通网页的兼容性结论替代扩展 API 的支持范围检查。[Baseline 配置说明](https://developer.chrome.com/docs/modern-web-guidance/get-started#baseline)

## Codex 已有浏览器能力，为什么还会推荐 DevTools MCP

两者有大量重叠，差异主要体现在接入方式和现成的工具接口。

| 场景 | Codex 现有环境 | Chrome DevTools MCP |
| --- | --- | --- |
| 打开页面、点击、输入、截图 | 桌面应用的浏览器工具可支持 | 同样支持 |
| 控制台、网络请求、DOM 与样式检查 | 浏览器开发者模式或已接入的自动化工具可提供，需确认当前接口 | 提供相应查询工具 |
| 性能分析 | 开发者模式开放 CDP 后可进行性能诊断 | 提供 trace 录制和性能洞察接口 |
| 内存诊断 | 需确认当前可用工具与工作流 | 提供堆快照及分析接口 |
| 扩展安装、重载与触发按钮 | 不应仅凭“能操作网页”就认定有专门接口 | 有明确的扩展管理工具 |

OpenAI 文档说明，桌面浏览器开发者模式可访问 Chrome DevTools Protocol（CDP），用于 JavaScript 性能分析、控制台、网络和页面状态检查。因此，不能把“深度调试”说成 DevTools MCP 独有的能力。相关入口是 **Settings → Browser → Developer mode → Enable full CDP access**；实际可用性还受组织策略和网站访问授权影响。[OpenAI 浏览器开发者模式](https://learn.chatgpt.com/docs/browser#developer-mode)

DevTools MCP 则把重复动作封装成具名接口。例如 `performance_start_trace`、`performance_analyze_insight`，以及扩展的 `install_extension`、`reload_extension`、`trigger_extension_action`。对频繁执行“修改代码 → 重载扩展 → 触发动作 → 检查结果”的任务，这种封装有实际价值。[Chrome DevTools 工具清单](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)

判断能力时应区分 **Codex 桌面应用内置功能、额外接入的 Playwright 等工具，以及独立 MCP Server**。某个会话有某项工具，不代表所有 Codex 客户端、机器和组织配置都具备同样能力。

## 可选接入：确有需求时添加 DevTools MCP

先确认本机已安装 Codex CLI，且 Chrome、Node.js 满足当前 DevTools MCP 的要求，再检查是否已有同名或同类服务器，避免重复配置。

```bash
codex mcp list
```

需要新增时，可以使用以下组合命令：

```bash
codex mcp add chrome-devtools -- \
  npx -y chrome-devtools-mcp@latest \
  --categoryExtensions \
  --autoConnect
```

其中 `--categoryExtensions` 开放扩展工具，`--autoConnect` 用于连接现有 Chrome。该示例组合了 Codex 的 MCP 注册语法和 Chrome 的扩展调试参数。[Codex MCP 配置](https://learn.chatgpt.com/docs/extend/mcp#configure-with-the-cli) · [Chrome 配置说明](https://developer.chrome.com/docs/extensions/ai/build-with-ai)

使用此连接方式时，在 Chrome 打开 `chrome://inspect/#remote-debugging` 并允许远程调试，重新加载 Codex 的 MCP 配置，按浏览器弹窗完成授权。连接现有浏览器会使用对应的浏览器会话，测试前应确认连接的是计划使用的环境。

## 按任务选择，并验证实际效果

建议先列出验收动作，再选择工具：

1. **只需要开发指导**：使用 Skills，并明确兼容性目标。
2. **需要验证页面交互**：先使用已有浏览器工具完成一次最小检查。
3. **需要重复管理扩展或使用特定诊断接口**：检查现有工具缺口，再决定是否加入 DevTools MCP。

安装与验证应分开记录：

| 验证层次 | 可接受的证据 | 仍不能证明什么 |
| --- | --- | --- |
| Skill 发现 | 能找到技能，Agent 实际读取相关指南 | 生成代码一定正确 |
| MCP 配置 | `codex mcp list` 显示服务器 | 服务器已连接浏览器 |
| 工具连通 | 一次所需的只读调用成功 | 所有扩展操作均可用 |
| 功能验收 | 便签保存、关闭再打开后恢复，且结果被检查 | 未执行的兼容性或性能测试也通过 |

对可复现流程，还应记录实际使用的工具版本、浏览器版本和验证步骤。示例中的 `@latest` 便于获取当前版本，但不能单独保证未来复现相同结果。

## 常见错误与适用边界

- **把 Skills 当成操作工具。** 开发知识和执行权限需要分别配置、分别验证。
- **把“Codex 有浏览器”理解为覆盖全部调试任务。** 应查看当前客户端、工具列表和权限，再判断具体动作能否完成。
- **认为只有 DevTools MCP 能看网络或做性能分析。** Codex 的开发者模式和其他已接入工具也可能满足这些需求。
- **把安装成功写成功能测试成功。** 配置登记、服务连通、浏览器连接与业务验证是不同证据。
- **同时启用多套工具却未明确目标浏览器。** 登录态、标签页和扩展状态可能分属不同实例，测试应始终指向同一目标环境。

本次整理核对了公开安装文档、Codex MCP 命令格式、浏览器开发者模式说明，以及 DevTools MCP 的工具定义；未执行 Skills 安装、MCP 接入或扩展端到端测试。它提供的是选型与接入依据，不是对工具效果的性能比较。

## 公开参考

- [Chrome：使用编码 Agent 构建扩展](https://developer.chrome.com/docs/extensions/ai/build-with-ai)
- [Chrome：Modern Web Guidance 入门](https://developer.chrome.com/docs/modern-web-guidance/get-started)
- [Chrome DevTools MCP：工具清单](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/tool-reference.md)
- [OpenAI：Skills](https://learn.chatgpt.com/docs/customization/overview#skills)
- [OpenAI：浏览器开发者模式](https://learn.chatgpt.com/docs/browser#developer-mode)
- [OpenAI：MCP 配置](https://learn.chatgpt.com/docs/extend/mcp)
