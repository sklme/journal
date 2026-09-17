---
title: 工程实践
description: 文档工程、构建、测试、持续集成与项目维护
---

# 工程实践

这里记录文档工程、构建、测试、持续集成和项目维护中的可复用方法。

- [AKSK、STS 与 CAM 角色：三种临时凭证获取方式](./aksk-sts-cam-oidc-saml.md)
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
