---
title: 工程实践
description: 从开发环境与工程基础两条路线浏览工程知识
---

# 工程实践

按使用场景选择入口：环境配置和远程排障进入开发环境；Node.js、云服务与文档站建设进入工程基础。

## 主题导航

<TopicCards exclude-area="ai" />

## 现代终端工作流 {#terminal-workflow}

进入 [开发环境 · 终端工作流](/knowledge/topics/development-environment/#terminal-workflow)，按搭建环境、目录导航、文件浏览、阅读、搜索和配置恢复的顺序练习。

## MacBook 远程开发机系列 {#macbook-remote-development}

进入 [开发环境 · 远程开发机](/knowledge/topics/development-environment/#remote-development)，按供电、网络、会话、工具和恢复验收建立远程环境。

网络架构研究见 [无公网 IP 的远程组网：原理、移动端整合与云端混合架构](/knowledge/engineering/remote-networking-without-public-ip)，从 NAT 穿透、移动端 VPN 整合与加密边界理解云端和家庭设备的分工。

远程 Codex 的图片输入和旧会话恢复，见 [Codex 远程使用与排障](/knowledge/topics/development-environment/#codex-remote)；容器后端与构建隔离见 [容器与虚拟机](/knowledge/topics/development-environment/#containers)。

## 容器与虚拟机

- [Tart：为什么在虚拟机中构建与测试 macOS 应用](/knowledge/engineering/tart-virtual-machines-for-macos-ci)：理解虚拟机打包的原因、CI 使用流程和适用边界。
- [开发环境 · 容器与虚拟机](/knowledge/topics/development-environment/#containers)：查看容器后端与虚拟机构建环境的相关知识。

## Node.js 与框架原理

- [从 Node.js 到 NestJS：彻底理解控制反转、装饰器与依赖注入](./nodejs-nestjs-ioc-decorators-di.md)：保留 Express 回调和业务调用的两个反问，用可运行的教学模型解释参数来源、装饰器编译与对象组装。

## HTTP 压缩与请求解析

- [HTTP 代理：请求解压与响应压缩](./http-proxy-compression.md)：区分请求内容解码与响应压缩，解释编码头、代理和应用的职责，以及如何验证实际链路。
- [Nest／Express 入站解压与 br 控制](./nest-express-request-decompression.md)：解释默认 body parser、Content-Encoding、版本差异与浏览器请求行为，并在解析之前限制入站压缩编码。

## 工程专题

- [包版本与发布](/knowledge/topics/engineering-foundations/#package-releases)
- [云身份、存储与 CDN](/knowledge/topics/engineering-foundations/#cloud-services)
- [Node.js 原生交互与运行时安全](/knowledge/topics/engineering-foundations/#native-interop)
- [文档工程](/knowledge/topics/engineering-foundations/#documentation)

安全案例见 [Node.js 运行时安全：Brotli、TLS 与证书信任边界](./nodejs-runtime-security-brotli-tls.md)，结合 2026 年 10 月更新理解触发条件、最小示例和升级检查。

## Node.js 异步上下文与 RPC 并发 {#async-context-rpc}

进入 [工程基础 · 请求上下文与 RPC](/knowledge/topics/engineering-foundations/#async-context-rpc)，从状态传播机制开始，理解锁、子上下文和业务路由的隔离边界。
