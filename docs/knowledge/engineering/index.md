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

## 工程专题

- [将 MacBook 配置为远程开发机](./macbook-remote-development-setup.md) — 配置开盖接电、30 分钟熄屏与密码锁屏、SSH 和 tmux，并区分系统在线与 Codex 手机旧会话恢复故障。
- [AKSK、STS 与 CAM 角色：三种临时凭证获取方式](./aksk-sts-cam-oidc-saml.md)
- [COS：对象存储的设计、权限与工程实践](./cos-object-storage-design-and-practices.md)
- [CDN 与 COS：CNAME、TLS、回源路径和权限](./cdn-cos-cname-tls-origin-pull.md)
- [使用 VitePress 搭建个人知识站](./building-a-vitepress-knowledge-site.md)
- [macOS 上使用 Docker CLI 连接 Podman](./docker-cli-with-podman-on-macos.md)
- [Node.js 原生交互全景：内置绑定、Node-API 与 FFI](./nodejs-native-interop-node-api-ffi.md)

## Node.js 异步上下文与 RPC 并发 {#async-context-rpc}

从请求状态的传播机制出发，理解共享对象竞争、锁与子上下文，并把隔离放到业务路由的正确边界。

- [一：从 HTTP 到 RPC——请求上下文如何传递](./http-rpc-context.md)
- [二：AsyncLocalStorage 的原理、机制与使用场景](./node-async-local-storage.md)
- [三：上下文变化时的并发——锁与子上下文](./rpc-context-lock-vs-child-scope.md)
- [四：RPC 并发改造——把路由隔离放到正确边界](./rpc-concurrency-isolation-boundaries.md)
- [五：动手实验——验证 RPC 上下文的并发与隔离](./rpc-context-concurrency-lab.md)
