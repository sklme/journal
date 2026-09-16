import assert from 'node:assert/strict';
import { AsyncLocalStorage, AsyncResource } from 'node:async_hooks';
import { setImmediate as nextTurn } from 'node:timers/promises';
import test from 'node:test';

// 独立教学模型：不加载业务框架，不建立网络连接。
const storage = new AsyncLocalStorage();
const scope = {
  get state() { return storage.getStore(); },
  register(state) { storage.enterWith(state); },
};

function request(requestId, operation) {
  return storage.run({
    requestId,
    route: 'parent',
    options: { target: 'default' },
  }, operation);
}

async function branch(route, operation) {
  const parent = scope.state;
  if (!parent) throw new Error('request context required');
  const state = { ...parent, route, options: { ...parent.options } };
  const resource = new AsyncResource('ContextLabBranch', {
    requireManualDestroy: true,
  });
  try {
    return await resource.runInAsyncScope(() => {
      scope.register(state);
      return operation();
    });
  } finally {
    resource.emitDestroy();
  }
}

function lockedRouter() {
  const owner = scope.state;
  assert.ok(owner, 'create the queue inside its request');
  let pending = Promise.resolve();
  return (route, operation) => {
    assert.equal(scope.state, owner, 'one queue belongs to one store');
    const result = pending.then(async () => {
      const previous = owner.route;
      owner.route = route;
      try { return await operation(); }
      finally { owner.route = previous; }
    });
    pending = result.then(() => undefined, () => undefined);
    return result;
  };
}

function assertParent(parent) {
  assert.equal(scope.state, parent);
  assert.equal(parent.route, 'parent');
  assert.equal(parent.options.target, 'default');
}

async function measure(mode, requestId) {
  return request(requestId, async () => {
    const parent = scope.state;
    const dispatch = mode === 'locked' ? lockedRouter() : branch;
    let active = 0;
    let peak = 0;
    const routes = ['partition-A', 'partition-B', 'partition-A'];
    const outcomes = await Promise.allSettled(routes.map((route, index) =>
      dispatch(route, async () => {
        const current = scope.state;
        ++active;
        peak = Math.max(peak, active);
        try {
          assert.equal(current.route, route);
          assert.equal(current.requestId, requestId);
          if (mode === 'child') {
            assert.notEqual(current, parent);
            assert.notEqual(current.options, parent.options);
            current.options.target = `target-${index}`;
          }
          await nextTurn(); // 提供异步交错，不断言毫秒数。
          assert.equal(scope.state, current);
          assert.equal(scope.state.route, route);
          assert.equal(scope.state.requestId, requestId);
          if (mode === 'child') {
            assert.equal(scope.state.options.target, `target-${index}`);
          }
          return route;
        } finally { --active; }
      }),
    ));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') throw outcome.reason;
    }
    assert.deepEqual(outcomes.map(item => item.value), routes);
    assert.equal(active, 0);
    assert.equal(peak, mode === 'locked' ? 1 : 3);
    assertParent(parent);
    return peak;
  });
}

test('shared mutation is reproduced with an explicit barrier', async () => {
  await request('race', async () => {
    const gate = Promise.withResolvers();
    const first = (async () => {
      scope.state.route = 'partition-A';
      await gate.promise;
      return scope.state.route;
    })();
    scope.state.route = 'partition-B';
    gate.resolve();
    assert.equal(await first, 'partition-B');
  });
  assert.equal(scope.state, undefined);
});

test('request-owned queue has peak concurrency 1', async () => {
  assert.equal(await measure('locked', 'serial-request'), 1);
});

test('child stores have peak concurrency 3 with repeated and distinct routes', async () => {
  assert.equal(await measure('child', 'parallel-request'), 3);
});

test('two interleaved request scopes keep their own identifiers', async () => {
  assert.deepEqual(await Promise.all([
    measure('child', 'request-A'), measure('child', 'request-B'),
  ]), [3, 3]);
});

test('nested branches preserve outer state and options', async () => {
  await request('nested-request', async () => {
    const parent = scope.state;
    await branch('outer', async () => {
      const outer = scope.state;
      outer.options.target = 'outer-target';
      await branch('inner', async () => {
        scope.state.options.target = 'inner-target';
        await nextTurn();
        assert.equal(scope.state.route, 'inner');
        assert.equal(scope.state.options.target, 'inner-target');
      });
      assert.equal(scope.state, outer);
      assert.equal(scope.state.route, 'outer');
      assert.equal(scope.state.options.target, 'outer-target');
    });
    assertParent(parent);
  });
});

test('sync and async failures remain visible without polluting a successful sibling', async () => {
  await request('failure-request', async () => {
    const parent = scope.state;
    const outcomes = await Promise.allSettled([
      branch('sync', () => { throw new Error('sync failure'); }),
      branch('async', async () => { await nextTurn(); throw new Error('async failure'); }),
      branch('success', async () => { await nextTurn(); return scope.state.route; }),
    ]);
    assert.deepEqual(outcomes.map(item => item.status),
      ['rejected', 'rejected', 'fulfilled']);
    assert.equal(outcomes[0].reason.message, 'sync failure');
    assert.equal(outcomes[1].reason.message, 'async failure');
    assert.equal(outcomes[2].value, 'success');
    assertParent(parent);
  });
});

test('a rejected queue operation does not stop later operations', async () => {
  await request('queue-recovery', async () => {
    const parent = scope.state;
    const dispatch = lockedRouter();
    const outcomes = await Promise.allSettled([
      dispatch('failure', async () => { await nextTurn(); throw new Error('queued failure'); }),
      dispatch('next', async () => { await nextTurn(); return scope.state.route; }),
    ]);
    assert.equal(outcomes[0].status, 'rejected');
    assert.equal(outcomes[0].reason.message, 'queued failure');
    assert.equal(outcomes[1].status, 'fulfilled');
    assert.equal(outcomes[1].value, 'next');
    assertParent(parent);
  });
});

test('no request state leaks outside; orphan branches reject', async () => {
  assert.equal(scope.state, undefined);
  await assert.rejects(branch('orphan', () => {}), /request context required/);
  assert.equal(scope.state, undefined);
});
