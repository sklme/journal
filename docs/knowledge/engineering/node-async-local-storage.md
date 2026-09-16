---
title: 二：AsyncLocalStorage 的原理、机制与使用场景
date: 2026-09-16
tags:
  - Node.js
  - AsyncLocalStorage
  - 并发
description: 通过确定性实验理解异步链传播、共享对象和子 store，并划清 run、enterWith 与 AsyncResource 的边界。
---

# 二：AsyncLocalStorage 的原理、机制与使用场景

::: tip Node.js 异步上下文与 RPC 并发
[专题索引](./index.md#async-context-rpc) · [一：请求上下文](./http-rpc-context.md) · [二：ALS](./node-async-local-storage.md) · [三：锁与子上下文](./rpc-context-lock-vs-child-scope.md) · [四：隔离边界](./rpc-concurrency-isolation-boundaries.md) · [五：动手实验](./rpc-context-concurrency-lab.md)
:::

## 核心原理

显式参数让依赖容易追踪；ALS 则让深层日志、追踪和客户端代码查询当前执行链的信息。理解它时需要区分：ALS 容器、异步执行范围，以及范围内引用的 store 对象。

**建立子上下文要同时创建独立状态，并在这个状态的范围内启动工作。异步分叉本身不会复制对象。**

可以把 ALS 理解为运行时在异步回调执行时恢复相关环境。这个使用模型不等于“运行时深拷贝了状态”，也不要求业务自行用 Promise 映射表重写传播机制。

## 实验一：共享对象会发生什么

以下各段完整示例可分别保存为 `.mjs` 文件，用 Node.js 22 执行。屏障控制任务交错顺序，不依赖时间差碰巧触发竞争。

```js
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const barrier = Promise.withResolvers();

await storage.run({ route: 'parent' }, async () => {
  const first = (async () => {
    storage.getStore().route = 'partition-A';
    await barrier.promise;
    return storage.getStore().route;
  })();

  storage.getStore().route = 'partition-B';
  barrier.resolve();
  assert.equal(await first, 'partition-B');
  assert.equal(storage.getStore().route, 'partition-B');
});

console.log('shared object race: reproduced');
```

第一个任务等待期间，另一路代码改写了同一个对象。`await` 之后 ALS 仍能找到正确的 store；错误在于这个 store 的内容已经变了。这与上下文丢失是不同问题。

## 实验二：新对象与新执行范围一起建立

```js
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

await storage.run({ requestId: 'request-A', route: 'parent' }, async () => {
  const parent = storage.getStore();
  const ready = Promise.withResolvers();
  let arrivals = 0;

  const observed = await Promise.all(['partition-A', 'partition-B'].map(route =>
    storage.run({ ...parent, route }, async () => {
      if (++arrivals === 2) ready.resolve();
      await ready.promise;
      assert.equal(storage.getStore().route, route);
      assert.equal(storage.getStore().requestId, parent.requestId);
      return storage.getStore().route;
    }),
  ));

  assert.deepEqual(observed, ['partition-A', 'partition-B']);
  assert.equal(storage.getStore(), parent);
  assert.equal(parent.route, 'parent');
});

console.log('child store isolation: passed');
```

父对象没有被写入，外层无需“把路由改回去”。关键是把创建任务的调用放在 `run()` 内；先启动客户端，再进入子范围等待既有 Promise，不会把已经启动的工作迁入新范围。

## run、enterWith 与 AsyncResource

| API | 用途 | 需要注意 |
| --- | --- | --- |
| `run(store, callback)` | 在明确范围内执行回调，关联其中创建的异步工作 | 传入同一对象仍会共享字段 |
| `enterWith(store)` | 改变当前同步执行剩余部分及其后续异步工作的上下文 | 可能影响同一事件中的后续监听器 |
| `runInAsyncScope(callback)` | 在指定 AsyncResource 的执行环境中调用函数 | 不负责复制业务对象 |

自己持有 ALS 时，通常优先用 `run()`。框架只提供基于 `enterWith()` 的注册方法时，可在独立 AsyncResource 的范围内注册子状态并启动任务；第四篇提供完整模拟。[Node.js 的 run、enterWith 与 AsyncResource 说明](https://nodejs.org/download/release/v22.17.1/docs/api/async_context.html#asynclocalstorageenterwithstore)

`bind()`、`snapshot()` 捕获的是执行上下文，不是业务对象的深副本。`emitDestroy()` 通知资源生命周期结束，不表示取消任务或关闭连接。不要用作用于整个 ALS 实例的 `disable()` 结束单个请求。[Node.js API 参考](https://nodejs.org/download/release/v22.17.1/docs/api/async_context.html)

## 浅拷贝只能隔离被复制的那一层

下面的完整示例展示顶层新对象仍共享嵌套字段：

```js
import assert from 'node:assert/strict';

const parent = { route: 'parent', options: { retry: { limit: 1 } } };
const child = { ...parent, options: { ...parent.options } };
child.route = 'branch';
child.options.retry.limit = 2;

assert.equal(parent.route, 'parent');
assert.equal(parent.options.retry.limit, 2);
console.log('nested sharing: reproduced');
```

复制策略应按所有权决定：稳定的请求标识可继承；分支会改写的选项要独立；嵌套对象继续审查。Request、Socket、客户端实例不能用 JSON 序列化随意复制。正在初始化的连接或会话更不能靠拷贝变成“已经就绪”。

子状态需要回传的信息，应作为显式结果返回，由父任务决定如何合并。把整份子状态覆盖回父状态，会重新引入竞争并泄漏临时路由。

## 场景与排查方法

| 场景 | 设计要点 |
| --- | --- |
| 日志、Trace | 传播稳定标识，避免深层函数依赖整个 Request |
| 租户、区域、RPC 路由 | 区分授权身份与单次调用参数 |
| 回调与事件系统 | 核对回调实际执行时的上下文归属 |
| 后台任务 | 建立独立任务状态，只携带必要字段 |

遇到 `getStore()` 意外为 `undefined` 时，沿调用边界观察最早丢失的位置；对回调 API、定制 thenable 或调度器，检查是否需要 AsyncResource 适配。[Node.js 上下文丢失排查](https://nodejs.org/download/release/v22.17.1/docs/api/async_context.html#troubleshooting-context-loss)

若 store 存在但字段错误，先检查对象共享和修改顺序。不要把所有问题都归因于 ALS 传播失效。

## 验证与生命周期边界

本文三段示例在 Node.js `v22.23.2` 执行通过：共享对象和嵌套共享按预期复现，子 store 隔离断言通过。验证只涉及原生运行时与本地 Promise，不覆盖特定 RPC 框架。

HTTP 响应结束不会自动停止派生任务。未等待的异步工作可能继续持有 store 和请求对象；后台任务应独立管理生命周期。ALS 也不负责跨进程传输、分布式互斥或取消网络请求。

下一篇比较[共享状态加锁与子上下文](./rpc-context-lock-vs-child-scope.md)的成本和失败边界。
