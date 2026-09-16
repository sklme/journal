---
title: 三：上下文变化时的并发——锁与子上下文
date: 2026-09-16
tags:
  - Node.js
  - RPC
  - 并发控制
description: 比较请求内互斥与分支状态隔离，明确锁范围、业务依赖、并发容量和失败处理的边界。
---

# 三：上下文变化时的并发——锁与子上下文

::: tip Node.js 异步上下文与 RPC 并发
[专题索引](./index.md#async-context-rpc) · [一：请求上下文](./http-rpc-context.md) · [二：ALS](./node-async-local-storage.md) · [三：锁与子上下文](./rpc-context-lock-vs-child-scope.md) · [四：隔离边界](./rpc-concurrency-isolation-boundaries.md) · [五：动手实验](./rpc-context-concurrency-lab.md)
:::

## 要解决的问题

一个请求需要读取不同分片，旧接口要求“先修改当前路由，再调用客户端”。共享 store 会让这些修改互相覆盖。

**锁让任务轮流使用同一份状态；子上下文让任务拥有各自的状态。** 先判断变化是否需要被其他任务看见，再决定互斥还是隔离。下文讨论进程内、按请求状态划分的异步锁，不是分布式锁。

## 保存与恢复不等于互斥

如下伪代码只展示反例，不应作为生产 helper：

```text
保存旧路由
设置临时路由
try:
    await 客户端调用
finally:
    恢复旧路由
```

任务 A 等待时，任务 B 可以覆盖路由；A 随后的恢复还可能覆盖 B 正在使用的值。`finally` 确保清理被执行，但不能阻止操作交错。

## 方法一：持锁完成整个操作

临界区应包括读取旧值、修改、调用及恢复。除非客户端契约能证明发送前已经捕获全部相关参数，否则不能在调用刚返回 Promise 时解锁。

下面的完整示例为一个父状态创建一个串行路由入口，并验证失败后队列仍能继续。保存为 `serial-route.mjs`，用 Node.js 22 执行。

```js
import assert from 'node:assert/strict';

function serialRouter(state) {
  let queue = Promise.resolve();
  return function invoke(route, operation) {
    const result = queue.then(async () => {
      const previous = state.route;
      state.route = route;
      try {
        return await operation();
      } finally {
        state.route = previous;
      }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  };
}

const state = { route: 'parent' };
const invoke = serialRouter(state);
let active = 0;
let peak = 0;

const results = await Promise.allSettled(['A', 'B', 'C'].map(route =>
  invoke(route, async () => {
    peak = Math.max(peak, ++active);
    try {
      await Promise.resolve();
      assert.equal(state.route, route);
      if (route === 'B') throw new Error('simulated failure');
      return route;
    } finally {
      --active;
    }
  }),
));

assert.equal(peak, 1);
assert.deepEqual(results.map(item => item.status),
  ['fulfilled', 'rejected', 'fulfilled']);
assert.equal(results[2].value, 'C');
assert.equal(state.route, 'parent');
console.log('serial routing and failure recovery: passed');
```

这是最小模型，没有可重入、排队超时或取消能力。每个独立父状态只使用一个对应的 runner：全应用共享会扩大串行范围；为同一状态创建多个 runner 则无法互斥。所有会读写临时路由的相关路径都必须遵守同一协议，绕开锁的读取仍可能看到别人的值。

不可重入队列里再次调用同一队列并等待，会死锁。可重入实现若只靠 ALS 的“已经持锁”标记放行，还须防止多个子任务继承同一标记后同时改写状态。

## 方法二：为独立操作建立子上下文

```text
父状态：requestId=R，route=parent
  ├─ 子状态 A：requestId=R，route=A
  ├─ 子状态 B：requestId=R，route=B
  └─ 子状态 C：requestId=R，route=C
```

每个分支在自己的状态内设置路由，再启动工作；父状态从未被改写。具体可运行写法见[第二篇](./node-async-local-storage.md)，框架适配见[第四篇](./rpc-concurrency-isolation-boundaries.md)。

这种方式适合变化只属于单次调用的场景。若任务必须更新共同资源，复制上下文不会使该资源自动隔离。共享连接、事务和一次性初始化仍须按各自契约处理。

| 比较项 | 共享状态加锁 | 子上下文 |
| --- | --- | --- |
| 临时参数 | 原地修改，完成后恢复 | 分支独立，不回写父状态 |
| 独立 I/O | 临界区内串行 | 可重叠等待 |
| 主要代价 | 排队、队头阻塞、重入规则 | 字段复制、所有权审查、执行范围管理 |
| 对业务依赖的作用 | 可以表达顺序 | 不能消除先写后读依赖 |
| 适用前提 | 所有相关访问遵守锁协议 | 所有会变化的分支字段正确隔离 |

若可以修改 API，把路由作为不可变参数显式传给客户端也是选择。无需为了使用 ALS 而隐藏本来已经清晰的单次调用参数。

## 怎样理解性能收益

假设三个独立 RPC 各等待 30 毫秒，且忽略其他开销：串行约需 90 毫秒，并发三个约需 30 毫秒。这是教学模型，不是生产性能数据。同步 CPU 工作不会因为 `Promise.all` 自动使用多核。

十个串行操作各执行 30 毫秒，墙钟耗时约 300 毫秒，累计排队等待却为 `0 + 30 + … + 270 = 1350` 毫秒。多个等待者在相同时间段等待，因此累计等待不能直接从接口耗时中扣除。

评估时同时看关键路径、单次最大等待、实际在途量、RPC 数量与下游负载。阶段可能嵌套或并行，不能直接相加。

## 选择与容量边界

| 条件 | 处理方式 |
| --- | --- |
| 全链路只读取稳定状态 | 可有限并发，仍检查隐藏初始化 |
| 独立查询需要不同路由 | 隔离分支状态，再有限并发 |
| B 依赖 A 的结果或写入 | 保留业务顺序 |
| 需要原地修改外部资源 | 为该资源保留同步机制 |
| 共享会话尚未初始化完成 | 等待明确的就绪结果，再分叉 |
| 查询数量随列表长度放大 | 批量读取、去重、按需组装 |

单请求最多 4 路，不代表服务总共最多 4 路。大量 HTTP 请求叠加后仍会形成高在途量；服务级限流、下游容量、超时和重试预算需要共同约束。

`Promise.all` 中一个任务失败，不会自动取消其他已启动任务。`allSettled` 可等待所有结果，但真正取消 RPC 仍依赖客户端的取消机制。锁内操作若启动后台任务后提前返回，锁也保护不到这些任务的后续读取。

## 正确性验收与证据

验收应先证明路由正确，再看耗时改善：

1. 在任务入口、异步等待后、发送前核对请求标识和路由。
2. 覆盖多个请求交错、同路由、不同路由和嵌套分支。
3. 注入同步异常及异步失败，确认父状态、其他分支和队列不被污染。
4. 检查实际最大在途量，确认确有并发且不超过上限。
5. 单独验证共享初始化、可变选项、取消与超时。

本文示例在 Node.js `v22.23.2` 执行通过：最大在途数为 1，中间任务失败后第三个任务正常完成，父路由恢复。它验证串行模型，不涉及真实传输。

下一篇讨论[为什么已有子上下文仍可能排队，以及应把隔离放在哪里](./rpc-concurrency-isolation-boundaries.md)。
