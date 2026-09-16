---
title: 四：RPC 并发改造——把路由隔离放到正确边界
date: 2026-09-16
tags:
  - Node.js
  - RPC
  - 性能优化
description: 将路由隔离提前到业务操作入口，以通用实验验证上下文边界，并设计有限并发、初始化与性能验收规则。
---

# 四：RPC 并发改造——把路由隔离放到正确边界

::: tip Node.js 异步上下文与 RPC 并发
[专题索引](./index.md#async-context-rpc) · [一：请求上下文](./http-rpc-context.md) · [二：ALS](./node-async-local-storage.md) · [三：锁与子上下文](./rpc-context-lock-vs-child-scope.md) · [四：隔离边界](./rpc-concurrency-isolation-boundaries.md) · [五：动手实验](./rpc-context-concurrency-lab.md)
:::

## 问题与结论

一个聚合服务在单个 HTTP 请求中执行多次独立读取。底层 RPC 包装已经建立子上下文，但业务操作仍在路由锁上排队。

**隔离要放在首次修改业务路由之前。只在持锁后的发送层建立子状态，无法消除外层锁造成的串行。**

本文从实践问题中提炼通用方案。内部项目、框架、源码与监控入口、版本标识和线上样本已移除；代码为原生 Node.js 的独立模拟。下文是设计与机制验证，不是任何业务优化已上线的记录。

## 先分清排队与工作量

| 现象 | 需要收集的证据 | 可能的方向 |
| --- | --- | --- |
| 单次 RPC 不慢，接口仍慢 | 锁等待、关键路径、实际在途数 | 审查共享状态及隔离位置 |
| 最终返回很少，组装很多 | 候选数、组装数、返回数 | 提前筛选、按需补齐 |
| 列表越长，查询越多 | 每类 RPC 次数、重复键比例 | 批量化与去重 |
| 某阶段长尾突出 | 分页扫描量、阶段分布 | 限制扫描或设计快照 |

并发减少排队，不一定减少 RPC 次数；批量化减少工作量，不一定解决状态竞争。两类改造应分别记录证据。

客户端与后端要按请求标识配对，再判断时间花在哪里。不要相减覆盖范围不同的平均值，也不要把小样本当成全量分位数。

## 已有子上下文为什么仍然串行

```text
父状态 P
  → 业务操作等待 P 对应的锁
  → 修改 P 的数据路由
  → 发送包装层复制为子状态 C
  → RPC
  → 恢复 P，释放锁
```

发送层的子状态只能保护其范围内的选项。多个业务操作仍须轮流修改 P。一个持锁操作内部可能已经有并发，但不能据此认为独立业务操作之间没有排队。

目标结构是：

```text
父状态 P：稳定请求信息、可信身份
  ├─ 操作 A 先建立状态 A → 设置数据路由 A → RPC
  └─ 操作 B 先建立状态 B → 设置数据路由 B → RPC
```

客户端可以继续持有同一个 scope，只要它在每个异步分支中读取当前状态。若底层仍会修改父对象、共享嵌套字段或单例客户端上的“当前路由”，这张结构图还不成立。

## 只有注册接口时的最小适配

自己管理 ALS 时优先使用第二篇的 `run()`。下面模拟一种只公开 `state` 与 `register()` 的接口，约定 `register()` 使用同一个 ALS 的 `enterWith()`。这份接口是教学模型，不是某个私有框架的实现。

保存为 `independent-route.mjs`，运行 `node independent-route.mjs`：

```js
import assert from 'node:assert/strict';
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';

const storage = new AsyncLocalStorage();
const scope = {
  get state() { return storage.getStore(); },
  register(value) { storage.enterWith(value); },
};

async function inRoute(route, operation) {
  const parent = scope.state;
  if (!parent) throw new Error('request context required');
  const child = {
    ...parent,
    route,
    options: { ...parent.options },
  };
  const resource = new AsyncResource('IndependentOperation', {
    requireManualDestroy: true,
  });
  try {
    return await resource.runInAsyncScope(() => {
      scope.register(child);
      return operation();
    });
  } finally {
    resource.emitDestroy();
  }
}

async function simulateRequest(requestId) {
  const parent = { requestId, route: 'parent', options: { target: 'default' } };
  return storage.run(parent, async () => {
    const rendezvous = Promise.withResolvers();
    let arrived = 0;
    let active = 0;
    let peak = 0;
    const results = await Promise.all(['A', 'B', 'C'].map(route =>
      inRoute(route, async () => {
        const branch = scope.state;
        branch.options.target = route;
        peak = Math.max(peak, ++active);
        try {
          if (++arrived === 3) rendezvous.resolve();
          await rendezvous.promise;
          assert.equal(scope.state.requestId, requestId);
          assert.equal(scope.state.route, route);
          assert.equal(scope.state.options.target, route);
          await inRoute('nested', async () => {
            await Promise.resolve();
            assert.equal(scope.state.route, 'nested');
          });
          assert.equal(scope.state, branch);
          return route;
        } finally {
          --active;
        }
      }),
    ));
    assert.deepEqual(results, ['A', 'B', 'C']);
    assert.equal(peak, 3);
    assert.equal(scope.state, parent);
    assert.equal(parent.route, 'parent');
    assert.equal(parent.options.target, 'default');

    const outcomes = await Promise.allSettled([
      inRoute('sync-failure', () => { throw new Error('sync'); }),
      inRoute('async-failure', async () => {
        await Promise.resolve();
        throw new Error('async');
      }),
      inRoute('success', async () => {
        await Promise.resolve();
        assert.equal(scope.state.route, 'success');
        return true;
      }),
    ]);
    assert.deepEqual(outcomes.map(item => item.status),
      ['rejected', 'rejected', 'fulfilled']);
    assert.equal(scope.state, parent);
    assert.equal(parent.route, 'parent');
    assert.equal(parent.options.target, 'default');
    return peak;
  });
}

assert.deepEqual(await Promise.all([
  simulateRequest('request-A'), simulateRequest('request-B'),
]), [3, 3]);
assert.equal(scope.state, undefined);
await assert.rejects(inRoute('orphan', () => {}), /request context required/);
console.log('branch isolation, nesting and failure handling: passed');
```

AsyncResource 负责执行环境边界；状态对象仍由 helper 显式创建和注册。其 API 行为可查阅 [Node.js AsyncResource 文档](https://nodejs.org/download/release/v22.17.1/docs/api/async_context.html#class-asyncresource)。

`operation()` 必须在范围内启动实际工作，并返回覆盖完整生命周期的 Promise。示例中的屏障专门用于证明三个任务同时在途，不是生产调度器；它没有实现超时、取消或限并发。

## 状态所有权与初始化

| 字段或资源 | 处理规则 |
| --- | --- |
| 请求标识、稳定可信身份 | 按契约继承，维持日志关联 |
| 数据路由与单次代理选项 | 分支独立，职责分开 |
| 嵌套可变选项 | 逐层审查写入者与复制范围 |
| Request、连接、客户端 | 不任意深拷贝，遵循资源自身契约 |
| 共享会话与初始化结果 | 明确就绪条件、所有权和回写规则 |

示例只复制顶层选项。若新增嵌套对象，仍需重新审查；把父状态整体展开不代表全部字段已隔离。

共享初始化应有明确状态机，例如未开始、进行中、已就绪、失败。写入某个标识不代表初始化已经完成。可在分叉前等待就绪，或按框架支持的方式共享初始化 Promise；失败后如何重试也要定义。若初始化结果与路由绑定，还须按正确的路由键管理，不能共用错误范围的结果。

临时路由不应回写父状态。真正要合并的业务结果以显式返回值交给父任务，避免按分支完成顺序覆盖整份状态。

## 实施边界与读取编排

把适配放在公共业务路由入口，以覆盖各个 Repository 操作；不要散落在每个生成的客户端方法中。一个子状态内部再次分叉时，如需不同路由，新的分支也要先隔离。

缺少 HTTP 状态的后台工作应显式建立任务上下文。旧消费者若依赖“子操作修改对父状态可见”，需要迁移成显式结果传递，不能直接删锁。

并发上限可从小值开始试验，例如 4；这只是候选参数，需要结合服务总在途量和下游承载能力决定。对依赖前一步结果的操作保留顺序；对于独立读取，再调整串行 `await` 的编排。

同时减少多余候选组装、逐项元数据查询和无界扫描。引入统计快照时单独定义新鲜度、删除与可见性规则。不要因读取提速而扩大写操作的自动重试范围。

## 本地证据与真实链路验收

前四篇的六段完整 JavaScript 示例在 Node.js `v22.23.2` 本地执行通过。

| 本文断言 | 结果 |
| --- | --- |
| 两个请求交错，每个请求三个分支 | 每请求峰值在途数均为 3 |
| 等待后的请求标识、路由及顶层选项 | 各分支保持独立 |
| 嵌套子路由 | 返回后仍处于外层子状态 |
| 同步抛错、异步拒绝与成功分支并存 | 失败保留，成功分支及父状态不受污染 |
| 无父上下文调用 | 按示例契约拒绝 |

这些断言验证通用机制，没有调用真实 RPC、验证生产会话初始化或测量线上性能。接入具体框架后，仍须分别覆盖普通发送与代理发送、同路由与不同路由、发送前读取、重试、取消、初始化并发和响应后的元数据更新。

性能验收应固定输入规模与条件，对照接口总耗时、RPC 数量、锁等待、错误率、最大并发和下游负载；样本足够后再比较分位数。并发与查询减量分开实验，结果才可解释。

方案应能逐步启用并退回明确的串行路径。业务结果、授权与可见性、异常行为保持正确，是性能收益成立的前提。

下一篇提供[统一的可下载实验与八项回归断言](./rpc-context-concurrency-lab.md)。
