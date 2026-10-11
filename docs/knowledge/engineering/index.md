---
title: 工程实践
description: 文档工程、构建、测试、持续集成与项目维护
---

# 工程实践

这里记录文档工程、构建、测试、持续集成和项目维护中的可复用方法。

## 现代终端工作流 {#terminal-workflow}

从搭建环境到配置恢复，逐步创建一套以 Ghostty、Fish 和 Starship 为基础的 macOS 终端工作流。每篇包含工具选择、安装配置、操作示例和适用边界，可以按顺序练习，也可以按需查阅。

推荐顺序是：**搭建环境 → 目录导航 → 文件浏览 → 内容阅读 → 搜索定位 → 配置同步与恢复**。基础安装使用 Homebrew，命令示例使用 Fish；后面的组合练习会复用前面配置的 fzf、eza 和 bat。

- [01 · 终端基础：Ghostty、Fish 与 Starship](./ghostty-fish-starship-terminal-workflow.md) — 建立终端、Shell 与提示符，统一基础交互和视觉。
- [02 · 导航与选择：zoxide 与 fzf](./zoxide-directory-navigation-with-fish.md) — 快速进入常用目录，交互选择路径和历史命令，按需启用文件与目录预览。
- [03 · 文件浏览：eza](./eza-file-browsing-with-fish.md) — 查看文件属性、项目结构和 Git 状态。
- [04 · 文件阅读：bat](./bat-file-reading-with-fish.md) — 使用高亮、行号与分页阅读文件，并预览候选内容。
- [05 · 搜索定位：fd 与 rg](./fd-ripgrep-search-with-fish.md) — 按名称查文件、按内容找代码，再组合筛选与预览。
- [06 · 配置同步与恢复](./terminal-dotfiles-sync-and-restore.md) — 用 Git 管理配置，通过符号链接、备份与安装清单完成同步和换机。
- [补充 · Ghostty SSH 退格异常：理解 TERM 与 terminfo](./ghostty-ssh-backspace-terminfo.md) — 区分终端类型声明与能力数据库，定位并修复远端退格和光标显示异常。
- [补充 · tmux 实用指南：常用命令、会话管理与远程开发](./tmux-practical-guide.md) — 用速查表和典型场景练习会话、窗口、分屏、历史复制与跨设备接续。

## MacBook 远程开发机系列 {#macbook-remote-development}

从保持在线到实际开发，按执行位置、操作步骤、预期结果与验收建立远程环境。已有配置先核对，再补充缺少的部分。

- [系列总览与配置路线](./macbook-remote-development-setup.md)
- [01 · 供电、熄屏与锁屏](./macbook-remote-development-power-and-sleep.md)
- [02 · Tailscale 与 SSH](./macbook-remote-development-network-and-ssh.md)
- [03 · 屏幕共享与 iPhone 接入](./macbook-remote-development-screen-sharing.md)
- [04 · tmux 会话与跨设备接续](./tmux-practical-guide.md)
- [05 · 开发工具、远程 IDE 与容器](./macbook-remote-development-tools-and-services.md)
- [06 · 验收、重启恢复与维护](./macbook-remote-development-recovery-and-checks.md)

排障按症状查阅：

- [Tailscale 与 Clash TUN 共存](./macos-tailscale-clash-tun-coexistence.md)
- [SSH 退格与光标异常](./ghostty-ssh-backspace-terminfo.md)
- [Codex 手机旧会话恢复](../ai-engineering/codex-mobile-session-reconnect-troubleshooting.md)

容器替代方案见 [Docker CLI 与 Podman](./docker-cli-with-podman-on-macos.md)。

## 工程专题

- [AKSK、STS 与 CAM 角色：三种临时凭证获取方式](./aksk-sts-cam-oidc-saml.md)
- [COS：对象存储的设计、权限与工程实践](./cos-object-storage-design-and-practices.md)
- [CDN 与 COS：CNAME、TLS、回源路径和权限](./cdn-cos-cname-tls-origin-pull.md)
- [使用 VitePress 搭建个人知识站](./building-a-vitepress-knowledge-site.md)
- [在文档中使用 Mermaid 图表](./mermaid-diagrams-in-vitepress.md) — 用代码块绘制流程图、时序图和关系图，自动适配深浅色主题。
- [macOS 上使用 Docker CLI 连接 Podman](./docker-cli-with-podman-on-macos.md)
- [Node.js 原生交互全景：内置绑定、Node-API 与 FFI](./nodejs-native-interop-node-api-ffi.md)

## Node.js 异步上下文与 RPC 并发 {#async-context-rpc}

从请求状态的传播机制出发，理解共享对象竞争、锁与子上下文，并把隔离放到业务路由的正确边界。

- [一：从 HTTP 到 RPC——请求上下文如何传递](./http-rpc-context.md)
- [二：AsyncLocalStorage 的原理、机制与使用场景](./node-async-local-storage.md)
- [三：上下文变化时的并发——锁与子上下文](./rpc-context-lock-vs-child-scope.md)
- [四：RPC 并发改造——把路由隔离放到正确边界](./rpc-concurrency-isolation-boundaries.md)
- [五：动手实验——验证 RPC 上下文的并发与隔离](./rpc-context-concurrency-lab.md)
