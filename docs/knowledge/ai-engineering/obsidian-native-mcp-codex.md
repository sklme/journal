---
title: Obsidian 原生 MCP 接入 Codex
date: 2026-10-06
tags:
  - Obsidian
  - MCP
  - Codex
description: 使用 Local REST API 内置的 MCP 接入 Codex，并按需开放笔记读取和写入工具。
---

# Obsidian 原生 MCP 接入 Codex

## 要解决的问题

让 Codex 访问 Obsidian 笔记库，需要配置服务端、认证信息和客户端工具范围，并区分“配置已登记”与“接口实际可用”。本文给出可直接替换占位符使用的配置，以及对应的验证方法。

## 核心原理

让 Codex 搜索、读取和修改 Obsidian 笔记，可以直接连接 Local REST API 插件内置的 MCP 服务：

```text
Codex → Streamable HTTP MCP → Obsidian Local REST API → 当前笔记库
```

Local REST API 从 4.0.0 开始提供原生 MCP。对于支持 Streamable HTTP 的客户端，使用它可以减少一层 Python 桥接及其运行时依赖。

本文配置基于已验证的 Local REST API 5.3.1，该版本要求 Obsidian 1.13.1 或以上。旧版 3.6.1 只提供 REST API，直接访问 MCP 接口会返回 404，需要先更新插件。

## 最小示例

### 接入准备

1. 更新并启用 Obsidian 的 Local REST API 社区插件。
2. 在插件设置中获取 API Key。
3. 保持 Obsidian 和目标笔记库打开。
4. 确认服务只监听本机回环地址。

插件默认提供 HTTPS 服务，端口为 `27124`，MCP 路径为 `/mcp/`。HTTPS 使用插件生成的证书，客户端需要正确配置证书信任。

如果已在插件设置中启用 HTTP 服务，可以使用本机的 `http://<HOST>:27123/mcp/`。下面的配置采用这一方式，适用于同一台电脑上的 Codex 和 Obsidian。`<HOST>` 代表本机回环地址，实际使用时替换为插件监听的回环地址。

### Codex 配置

在 Codex 用户配置文件 `~/.codex/config.toml` 中加入以下通用示例。将 `<HOST>` 替换为本机回环地址，将 `<TOKEN>` 替换为插件提供的 API Key；不要把替换后的真实配置提交到文档仓库。

```toml
[mcp_servers.obsidian]
url = "http://<HOST>:27123/mcp/"
http_headers = { Authorization = "Bearer <TOKEN>" }
enabled = true
startup_timeout_sec = 20
tool_timeout_sec = 60
enabled_tools = [
  "vault_list",
  "vault_read",
  "search_simple",
  "search_query",
  "tag_list",
  "active_file_get_path",
  "vault_write",
  "vault_append",
  "vault_patch"
]
```

修改时保留已有 MCP 和其他 Codex 设置，并保存原配置的私有备份。包含认证信息的配置和备份应限制为当前用户可读写。

完成后重启 MCP 连接；若当前聊天仍未加载工具，重启 Codex 后再试。

### 工具范围

`enabled_tools` 是 Codex 的工具允许列表。插件服务本身还会提供其他工具，这个列表控制 Codex 可以调用哪些工具，不会把 API Key 的服务端权限变成只读。

| 工具 | 用途 |
| --- | --- |
| `vault_list` | 列出笔记库目录和文件 |
| `vault_read` | 读取笔记正文及元数据 |
| `search_simple` | 简单文本搜索 |
| `search_query` | 按路径、标签、属性等元数据进行结构化检索 |
| `tag_list` | 获取笔记库标签 |
| `active_file_get_path` | 获取 Obsidian 当前打开的笔记路径 |
| `vault_write` | 新建笔记或覆盖已有文件 |
| `vault_append` | 在笔记末尾追加内容 |
| `vault_patch` | 定点修改标题区域、块或 Frontmatter 属性 |

只需要检索时，保留前六个工具即可。需要把讨论结果保存为笔记时，加入后三个写入工具。示例没有开放删除文件、移动文件或执行 Obsidian 命令的工具。

修改已有笔记时，优先先读取，再使用追加或局部修改；`vault_write` 会覆盖目标文件的完整内容。针对标题的局部修改，应使用完整标题层级，必要时先读取文档结构；可按需另行开放 `vault_get_document_map`。

## 验证连接

先运行以下命令确认 Codex 已登记并启用服务：

```sh
codex mcp list
```

服务登记成功不代表连接和认证已经通过。继续检查：

1. MCP 握手能完成，工具列表能返回。
2. 允许列表中的工具名称与服务实际提供的名称一致。
3. 能列出根目录、搜索关键词并读取一篇笔记。
4. 能获取当前打开的笔记路径。

本次配置验证确认了上述连接及只读操作，随后加入的三个写入工具也通过了 Codex 配置加载校验。配置过程中没有执行笔记写入，因此不能把这些结果表述为实际写入、追加或局部修改的验证。

排查配置时避免把带认证信息的完整配置输出到终端或日志。诊断结果只需保留服务启用状态、端点、工具名称和成功与否。

## 使用示例

- “搜索笔记库中与 Redis 相关的资料，总结已有方案，并列出来源笔记。”
- “总结我当前在 Obsidian 打开的笔记，指出缺少的说明。”
- “把这次讨论整理成 Markdown，在指定目录新建一篇笔记；如果同名文件已存在，先读取它。”
- “在指定笔记的‘后续行动’标题下追加这次讨论得到的任务。”

文件路径相对于当前笔记库根目录。使用时明确目标目录、文件名和修改范围，避免把“保存摘要”误解为覆盖已有全文。

## 适用边界

MCP 接入不会自动建立向量知识库；这里使用的是文本搜索和元数据检索。对同步笔记库的写入会进入原有同步流程，因此修改可能传播到其他设备。

## 常见错误

| 现象 | 检查方向 |
| --- | --- |
| MCP 接口返回 404 | 插件是否仍是没有原生 MCP 的旧版本；更新后是否重新启用 |
| 认证失败 | API Key 是否正确，是否使用 Bearer 认证，插件重置后配置是否需要更新 |
| HTTPS 连接失败 | 客户端是否信任插件生成的证书；不要把认证失败误判为证书问题 |
| 能读取却无法保存 | 写入工具是否加入 `enabled_tools`，当前聊天是否已重新加载连接 |
| `vault_patch` 找不到标题 | 是否使用完整标题层级，标题是否重名；必要时读取文档结构 |

## 公开参考

- [Local REST API 的 MCP 接入和工具说明](https://github.com/coddingtonbear/obsidian-local-rest-api#quick-start)
- [Local REST API 4.0.0：引入原生 MCP](https://github.com/coddingtonbear/obsidian-local-rest-api/releases/tag/4.0.0)
- [Local REST API 5.3.1 的版本要求](https://github.com/coddingtonbear/obsidian-local-rest-api/blob/5.3.1/manifest.json)
- [Codex MCP 官方配置说明](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Python 桥接方案 mcp-obsidian](https://github.com/MarkusPfundstein/mcp-obsidian)
