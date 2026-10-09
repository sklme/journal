---
title: Codex SSH 图片粘贴：X11 剪贴板与 App Server 输入链路
date: 2026-10-09
tags:
  - Codex
  - SSH
  - X11
  - App Server
  - 多模态
description: 区分远程 CLI、本地客户端和 App Server 的图片输入链路，定位 X11 剪贴板超时并选择可验证的处理方式。
---

# Codex SSH 图片粘贴：X11 剪贴板与 App Server 输入链路

## 要解决的问题

在 SSH 登录的 Linux 主机上运行 Codex CLI，粘贴本地截图时遇到剪贴板不可用、X11 服务连接超时。首先要确认：**处理粘贴的界面运行在哪台机器，它读取的是哪里的剪贴板？**

本地终端可以粘贴文字，并不表示远程程序能读取本地图片。普通终端粘贴通常把文字送入远程标准输入；图片需要客户端读取、编码和传输，或通过文件输入。

## 核心原理

### X11 是图形系统

X11 是 Unix/Linux 常见的图形窗口系统协议，采用客户端与服务器架构。应用程序是 X client，连接负责显示和输入的 X server。这里的“服务器”指图形服务，其所在机器可以是用户的桌面电脑。

`DISPLAY` 指向 X11 显示端点。X11 剪贴板通过 selection 机制协调应用之间的数据交换，不能简单理解成服务器始终保存着一份图片。

当远程 CLI 使用 X11 剪贴板后端时，必须能访问相应显示服务。没有图形会话、端点失效、授权缺失或转发中断，都可能导致读取失败；超时本身不能证明服务器完全没有安装 X11。

SSH 的 X11 转发会设置远程 `DISPLAY` 并建立到本地显示服务的通道。手动填入 `DISPLAY=:0` 只改变连接目标，不能创建服务或补齐授权。[OpenSSH 手册](https://man.openbsd.org/ssh.1#X11_FORWARDING)

### 三种运行方式决定不同的输入边界

| 运行方式 | 读取图片的一端 | 图片如何进入远程任务 |
| --- | --- | --- |
| SSH shell 内直接运行 CLI，使用 X11 粘贴后端 | 远程 CLI 尝试访问其显示端点 | 普通终端会话没有自动图片附件上传；需要可用的图形转发或单独上传文件 |
| 本地桌面客户端连接 SSH 项目 | 本地客户端处理图片附件 | 客户端通过远程连接提交输入；附件传输细节取决于客户端实现 |
| 本地 CLI 界面使用 `codex --remote` | 本地界面处理输入 | 通过 App Server 连接提交给远程后端；图片转换能力需要匹配版本并实测 |

远程直接运行 CLI 时，粘贴操作可能停在下面这一步：

```text
本地截图 → 本地剪贴板
本地终端 → SSH 终端输入 → 远程 CLI → X11 剪贴板读取失败
```

桌面客户端连接 SSH 项目时，概念链路则是：

```text
本地客户端处理图片附件
          ↓ 远程输入提交
远程 Codex App Server
          ↓
远程任务处理图片
```

官方文档确认桌面客户端通过 SSH 启动远程 App Server，并在远程文件系统和 shell 中运行任务。公开文档没有确定桌面端图片附件究竟通过哪个内部上传接口、临时目录或具体通道传递，因此不能把上述概念图当成抓包结果。[远程连接文档](https://learn.chatgpt.com/docs/remote-connections#connect-to-an-ssh-host)

### App Server 协议与底层传输

Codex App Server 是客户端集成接口，处理会话、输入、审批和流式事件。它使用双向 JSON-RPC 2.0 消息格式，线上消息省略 `jsonrpc` 字段。方法名和字段由 Codex 定义，例如 `thread/start`、`turn/start`，与 MCP 的方法和契约不同。

协议定义“消息是什么意思”，传输定义“消息怎么送到对端”：

| 连接方式 | 消息承载方式 | 是否经过 TCP |
| --- | --- | --- |
| `stdio://` | stdin/stdout 中的逐行 JSON | 直接连接子进程时不需要 TCP；经 SSH 转接时还有 SSH 网络连接 |
| `ws://` | 每个 WebSocket 文本帧一条 RPC 消息 | 通常经过 TCP |
| `wss://` | TLS 保护的 WebSocket | 通常经过 TCP；客户端接受此类端点，TLS 可由前置层提供 |
| `unix://` 或 `unix://PATH` | Unix socket 上的 WebSocket，包含 HTTP Upgrade 握手 | 本机 socket 段不经过 TCP |
| 桌面客户端的 SSH 连接 | SSH 启动并管理远程 App Server | SSH 网络连接通常经过 TCP；不能据此断定内部直接使用 `ws://` |

App Server 的 `turn/start.input` 支持 `text`、带 URL 的 `image` 和带路径的 `localImage`。指定 `localImage.path` 时，需要让实际读取文件的一端访问该文件；把本机路径原样交给远程服务，并不会自动上传文件。[App Server 文档](https://learn.chatgpt.com/docs/app-server)

## 最小示例

### 检查执行环境和版本

在发生问题的终端运行以下 POSIX shell 示例，只输出环境变量是否设置，避免把连接地址和本地配置写进日志：

```sh
codex --version
printf 'SSH_CONNECTION=%s\n' "${SSH_CONNECTION:+set}"
printf 'DISPLAY=%s\n' "${DISPLAY:+set}"
printf 'WAYLAND_DISPLAY=%s\n' "${WAYLAND_DISPLAY:+set}"
codex --help
```

空值表示未设置。SSH 标志存在而显示变量为空，结合 X11 读取超时，支持“远程进程没有可用图形剪贴板端点”的判断。变量已设置也不保证端点可达，需要进一步验证显示服务和授权。还要确认实际粘贴操作是否确实发生在这个 CLI 中，而不是桌面客户端的输入框中。

### 上传图片后使用文件输入

在本地保存截图，将其上传到远程已有且可写的目录：

```sh
scp ./screenshot.png example.com:/path/to/project/screenshot.png
```

在远程主机上启动 CLI，并附带远程可读的图片：

```sh
codex -i /path/to/project/screenshot.png "分析这张截图中的错误"
```

`example.com` 和 `/path/to/project` 是占位值，需要替换成实际 SSH 目标和目录。`-i`/`--image` 用于初始提示词的图片附件。[图片输入文档](https://learn.chatgpt.com/docs/image-inputs?surface=cli)

如果要保留终端操作并实现一键粘贴，可以由**本地**快捷键脚本完成“读取剪贴板图片 → 上传文件 → 将远程路径送入输入框”。需要分别确认剪贴板格式、上传成功和附件识别；仅填入路径不等于已经附加图片。

### App Server 输入的最小结构

下面是已经完成 `initialize`/`initialized` 握手并取得 thread ID 后的单条请求示意，文件需能被服务端读取：

```json
{
  "method": "turn/start",
  "id": 1,
  "params": {
    "threadId": "<THREAD_ID>",
    "input": [
      { "type": "text", "text": "分析这张截图中的错误" },
      { "type": "localImage", "path": "/path/to/project/screenshot.png" }
    ]
  }
}
```

该请求说明图片输入的应用层结构，不能单凭它判断桌面客户端内部采用了什么上传方式。

## 验证证据

原排查中观察到 SSH 会话标志存在，`DISPLAY` 和 `WAYLAND_DISPLAY` 均未设置，同时出现 X11 剪贴板连接超时。当时 CLI 版本为 `0.155.1`，帮助输出包含 `-i` 和 `--remote`。这些证据支持远程图形剪贴板不可用的判断，**没有构成图片上传或粘贴修复成功的验证**。

整理本文时，本地 `0.161.0` 的帮助输出仍包含图片文件输入和远程 TUI 参数；官方文档确认了输入类型、SSH 启动远程服务和传输方式。本文没有重新进行跨机器图片粘贴测试，也不将某个旧版本的行为写成所有版本的固定限制。

验证方案是否真正成功，应分别确认：

1. 粘贴或选择图片后，输入框中出现图片附件。
2. 服务端成功接收图片，或能够读取上传后的文件。
3. 任务能识别图片中的具体内容，而不是只读取路径文字。

## 适用边界

- 本文重点讨论远程 CLI 使用 X11 后端读取图片时的失败。Wayland、容器、tmux、终端扩展和不同客户端的输入处理可能不同。
- 本地 TUI 连接远程 App Server 的模式解决了界面与执行位置的分离，但参数存在不代表任意版本组合都已验证图片粘贴。
- `ssh -X`/`ssh -Y` 可以转发 X11，仍依赖本地 X server、远程授权和图片格式支持；启用转发后需要实际验证，不能直接宣称修复完成。
- WebSocket 传输在官方文档中标为实验能力。使用 `--remote` 时，普通 `ws://` 适用于本机或 SSH 转发；跨网络访问需要鉴权和 TLS。[连接远程 TUI](https://learn.chatgpt.com/docs/app-server#connect-the-cli-terminal-ui)

## 常见错误

| 误区 | 原因与正确做法 |
| --- | --- |
| 能粘贴文字，就能把图片传给远程 CLI | 终端字符输入与图片附件是不同能力，分别验证 |
| 安装 `xclip` 就能读取本地截图 | 工具仍需可用的显示服务、授权或转发 |
| 设置 `DISPLAY=:0` 就会创建剪贴板服务 | 环境变量仅指定目标；SSH 转发时应使用 SSH 设置的值 |
| X11 超时说明模型上传失败 | 报错指向剪贴板读取阶段，应先定位失败环节 |
| App Server 是 MCP 或 OpenAI API 的通用协议 | 消息格式相似不代表方法和生命周期契约相同 |
| App Server 连接必然使用 TCP | 直接 stdio 和本机 Unix socket 段都可以不经过 TCP |
| `localImage` 会自动上传客户端路径对应的文件 | 需要先确认客户端转换行为或服务端文件可读性 |

## 公开参考

- [Codex App Server：协议、图片输入与传输](https://learn.chatgpt.com/docs/app-server)
- [远程连接：通过 SSH 启动远程 App Server](https://learn.chatgpt.com/docs/remote-connections#connect-to-an-ssh-host)
- [Codex 图片输入](https://learn.chatgpt.com/docs/image-inputs?surface=cli)
- [OpenSSH 手册：X11 转发与 DISPLAY](https://man.openbsd.org/ssh.1#X11_FORWARDING)
