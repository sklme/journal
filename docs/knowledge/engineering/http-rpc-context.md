---
title: 一：从 HTTP 到 RPC——请求上下文如何传递
date: 2026-09-16
tags:
  - Node.js
  - RPC
  - 异步上下文
description: 区分作用域访问对象、进程内异步状态和跨进程元数据，理解请求隔离与调用路由的边界。
---

# 一：从 HTTP 到 RPC——请求上下文如何传递

::: tip Node.js 异步上下文与 RPC 并发
[专题索引](./index.md#async-context-rpc) · [一：请求上下文](./http-rpc-context.md) · [二：ALS](./node-async-local-storage.md) · [三：锁与子上下文](./rpc-context-lock-vs-child-scope.md) · [四：隔离边界](./rpc-concurrency-isolation-boundaries.md) · [五：动手实验](./rpc-context-concurrency-lab.md)
:::

## 要解决的问题

一个 HTTP 聚合接口需要读取多个下游的数据。日志代码需要请求标识，鉴权需要可信身份，RPC 客户端需要本次调用的路由参数。如果不想把整份请求信息逐层传参，可以用 AsyncLocalStorage（ALS）关联当前异步执行链。

**一个 HTTP 请求可以并发调用多个 RPC。是否需要锁，取决于完整调用链是否修改共享状态，而不是客户端是否持有同一个作用域对象。**

本文采用通用模型，不依赖特定框架、服务协议或部署架构。

## 请求链路与三个层次

```text
HTTP 入口 → 建立请求状态 → 鉴权与业务编排
                          ├─ RPC A
                          ├─ RPC B
                          └─ RPC C
                       → 聚合结果 → 响应
```

| 层次 | 职责 | 示例 |
| --- | --- | --- |
| 作用域访问对象 | 提供读取当前状态的入口 | `scope.requestId` |
| 当前 ALS store | 保存这条执行链关联的进程内状态 | 请求标识、可信身份、路由选项 |
| 出站元数据 | 按协议向下游传递必要信息 | Trace 信息、显式编码的请求头 |

Node.js 提供 ALS 来关联异步执行链与状态；各实例具有各自的存储上下文。[Node.js 异步上下文文档](https://nodejs.org/download/release/v22.17.1/docs/api/async_context.html#class-asynclocalstorage)

ALS 不会把 JavaScript 对象自动传到另一进程。出站客户端仍须选择允许传播的字段、按协议编码；接收端需要校验这些字段并建立自己的上下文。不要把本地 store 等同于远程会话、连接或授权凭据。

## 同一个作用域对象怎样服务多个请求

下面是独立编写的最小模型。保存为 `request-scope.mjs`，运行 `node request-scope.mjs`；所有异步等待均在本地完成。

```js
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const scope = {
  get requestId() { return storage.getStore()?.requestId; },
  get route() { return storage.getStore()?.route; },
};

async function simulatedClient() {
  await Promise.resolve();
  return { requestId: scope.requestId, route: scope.route };
}

const observed = await Promise.all(['A', 'B'].map(label =>
  storage.run(
    { requestId: `request-${label}`, route: `partition-${label}` },
    simulatedClient,
  ),
));

assert.deepEqual(observed, [
  { requestId: 'request-A', route: 'partition-A' },
  { requestId: 'request-B', route: 'partition-B' },
]);
assert.equal(scope.requestId, undefined);
console.log('scope accessor isolation: passed');
```

客户端始终读取同一个 `scope`，getter 每次从当前执行环境取值。入口必须为每个请求建立新的 store；把多个请求放进同一对象，或把 getter 改成模块级“当前请求”变量，都不满足这个前提。

单独创建一个新 scope，不会替换客户端已经注入的依赖；新建一个客户端不读取的 ALS 实例，也不会改变它的行为。应先确认访问对象最终读取哪个容器、哪个 store。

## 请求隔离不等于分支隔离

```text
请求 A → store A
         ├─ 查询资料 → store A
         └─ 查询列表 → store A
请求 B → store B
```

同一请求里的两个任务通常继承同一个对象。读取稳定字段没有冲突；如果一个任务临时修改路由后执行 `await`，另一个任务可能在这段时间覆盖路由。

`Promise.all` 不会复制状态或保护临界区。单线程也不能使跨 `await` 的业务操作具有原子性。要并发执行使用不同临时路由的任务，需要独立的分支状态，或者完整的共享状态互斥规则。

## RPC 客户端在什么时候读取状态

客户端调用可能经历中间件、连接准备、重试、参数编码等步骤，真正读取路由的时刻可能在一次异步等待之后。

因此不能默认“调用方法后参数就全部捕获了”，随即恢复共享路由。应检查从业务入口到发送前的读取点；若无法证明已捕获所有状态，锁应覆盖完整操作，子上下文也应包住实际任务的启动。

同样需要检查隐藏写入：连接初始化、共享元数据刷新、远程会话建立、响应后的状态更新。业务层只读，不意味着整条链只读。

## 身份、数据路由与代理选机

| 信息 | 回答的问题 | 约束 |
| --- | --- | --- |
| 可信身份 | 谁在请求、允许访问什么 | 从可信入口建立并执行授权 |
| 数据路由 | 数据属于哪个分片 | 保持数据定位语义 |
| 代理选机参数 | 本次使用哪个可用代理 | 遵守传输层契约 |

改变路由不授予权限。为分散代理负载而随机改变数据分片，会改变查询含义。实际系统即使把多个职责编码在同一个字段中，也需要在设计和测试中分清。

## 验证与适用边界

本文示例在 Node.js `v22.23.2` 执行通过，证明同一访问对象能在两个异步请求范围内读取不同状态。它没有访问真实 HTTP/RPC 网络，也没有验证任何框架的传输或初始化语义。

后台任务要有明确的任务入口；跨线程、跨服务传播要显式传递必要数据。ALS 不是分布式锁，也不会让共享数据库连接自动支持并发。

下一篇通过[共享对象与子 store 的实验](./node-async-local-storage.md)进一步解释这些边界。
