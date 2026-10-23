---
title: 从 Node.js 到 NestJS：彻底理解控制反转、装饰器与依赖注入
date: 2026-10-23
tags:
  - Node.js
  - TypeScript
  - NestJS
  - IoC
  - DI
description: 从“Express 不也在调用回调吗”开始，沿着实参构造、装饰器编译和对象组装，逐步理解 NestJS 的运行机制。
---

# 从 Node.js 到 NestJS：彻底理解控制反转、装饰器与依赖注入

在 NestJS 中，我们很容易写出这样的代码：

```ts
@Controller('users')
class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.userService.findUser(id);
  }
}
```

请求 `GET /users/42` 到来，方法里的 `id` 就有了值，构造函数里的 `userService` 也已经准备好了。

但把代码多看一眼，就会产生疑问：我们没有调用 `getUser()`，是谁调用了它？参数前面写一个 `@Param('id')`，怎么就能拿到未来请求里的数据？

如果用“框架帮我们做了这些事”回答，问题只是往后挪了一层。我们还需要把这句话拆成普通的函数调用、数据记录和对象创建。

这篇文章假定你已经熟悉 JavaScript 的函数、回调和类。我们围绕同一个“查询用户”例子逐步改造代码，保留那些会迫使解释变得更准确的追问。读完后，你应该能追踪一次请求的参数由谁传给谁，也能说清楚 Controller 的依赖由谁创建。

开头是 NestJS 代码片段；中间会构造一个教学模型。涉及 Nest 内部实现时，以 **NestJS 11.1.6 的 Express 适配器**为核对对象。教学模型省略框架的大部分功能，只用于把执行关系显露出来。

## 从 Node.js 开始：我没有调用这个函数，谁调用了它？

先把 NestJS 放到一边，看一个普通的 HTTP Server：

```js
import { createServer } from 'node:http';

function handleRequest(req, res) {
  res.end('Hello');
}

const server = createServer(handleRequest);
server.listen(3000, '127.0.0.1');
```

注意 `createServer(handleRequest)` 和 `handleRequest(req, res)` 的区别。前者把函数交给服务器，后者才是真正调用函数。

在这段程序里，我们没有为每一个请求主动执行 `handleRequest()`。Node.js 的 HTTP Server 在收到请求时发出事件，调用已经登记的监听器。传给 `createServer()` 的 `requestListener`，正是登记到 `request` 事件上的监听器。[Node.js HTTP 文档](https://nodejs.org/api/http.html#httpcreateserveroptions-requestlistener)

业务代码决定处理函数内部做什么；服务器决定何时进入这个处理函数。

如果原来由应用自己组织“等待输入、得到输入、调用处理逻辑”的顺序，现在改成向外部运行机制登记处理逻辑，调用时机就交了出去。这是理解 **控制反转，Inversion of Control，IoC** 的一个具体入口。[Martin Fowler 对调用流程反转的说明](https://martinfowler.com/bliki/InversionOfControl.html)

这里先记住一个可观察的事实就够了：**我们提供函数，外部机制在合适的时机调用它。** 至于 Nest 相比这个模式又多做了什么，还要继续往下看。

## 第一个反问：Express 不也在调用我的回调吗？

把请求处理换成 Express：

```js
app.get('/users/:id', (req, res) => {
  res.json({ id: req.params.id });
});
```

Express 在匹配到请求方法和路径后，调用我们登记的处理函数。我们仍然没有为每个请求手工调用这个回调。[Express 路由说明](https://expressjs.com/en/guide/routing/)

于是，一个很有价值的反问出现了：

> 如果“框架调用我的函数”就是这里讨论的控制反转，那 Express 早就做到了。为什么介绍 NestJS 时还要反复强调它？

这个反例成立。用“Nest 接管 Controller 调用”来说明 Nest 有 IoC，并不能据此区分 Nest 和 Express。

我们需要修正原来的理解：**控制反转描述的是某一项控制权的分配。讨论它时，需要明确究竟交出了哪项工作。**

在刚才的例子里，交出去的是请求到来后进入处理函数的时机。Nest 后面还会涉及对象创建、依赖组装和生命周期管理。仅仅说“用了 IoC”，这些区别都还没有说明白。

也因此，看到一个函数接收 `callback`，不宜立刻推导出它具备完整的框架组织能力。回调能表达某种调用关系，但不会自动带来路由扫描、依赖管理或作用域。

先不急着列出 Nest 的所有职责。继续看同一个用户查询，Express 和 Nest 的写法之间，究竟缺了哪段代码。

## Controller 的实参从哪里来？先手工调用一次

Express 的处理函数接收 `req`、`res`，我们自己从 `req.params` 取数据；Nest 的方法却直接接收 `id`：

```ts
@Get(':id')
getUser(@Param('id') id: string) {
  return { id };
}
```

先提出一个假设：是不是在参数前面加上装饰器，这个参数就有了“自己读取请求”的能力？

要检验它，先看一个没有装饰器的普通 JavaScript 方法：

```js
class UserController {
  getUser(id) {
    return { id };
  }
}

const controller = new UserController();
console.log(controller.getUser());
// { id: undefined }
```

形参名叫 `id`，并不会让 JavaScript 替它寻找请求数据。调用者没有传值，它就得到 `undefined`。

要让它得到 `'42'`，至少需要有人做这件事：

```js
const req = { params: { id: '42' } };
const args = [req.params.id];
console.log(controller.getUser(...args));
// { id: '42' }
```

现在我们看到了一段不能省掉的工作：从请求对象取值，组成实参数组，再调用方法。

NestJS 的处理链中也需要完成这些工作。以 Express 适配器为例，外层路由处理函数拿到 `req`、`res`、`next`；Nest 据参数规则生成 Controller 的实参，最后调用 Controller 方法。概念上可以写成：

```js
// 流程示意，省略 Guard、Pipe、Interceptor 和异常处理。
app.get('/users/:id', async (req, res) => {
  const args = [req.params.id];
  const result = await controller.getUser(...args);
  res.json(result);
});
```

外层回调的 `(req, res, next)` 和 Controller 的 `(id)` 是两组参数。它们之间存在一次转换。Nest 11.1.6 的 `RouterExecutionContext` 中，可以看到参数处理之后的 `callback.apply(instance, args)`；`apply` 的第一个参数还负责保留 Controller 的 `this`。[路由执行上下文](https://github.com/nestjs/nest/blob/v11.1.6/packages/core/router/router-execution-context.ts)

原来的假设需要进一步修正：`@Param('id')` 声明参数应该从哪里来，**实际取值和传参必须由读取这份声明的调用逻辑完成**。直接调用一个已经装饰的方法，也不会因此自动进入 Nest 的 HTTP 请求管线。

接下来只剩一个更具体的问题：装饰器如何把“第 0 个参数来自路径中的 id”这条规则记下来？

## 参数装饰器怎么知道自己在第几个位置？

我们先不用 Nest，写一个只打印信息的参数装饰器：

```ts
function LogParam(
  target: object,
  method: string | symbol | undefined,
  index: number,
) {
  console.log('登记', String(method), index);
}

class Probe {
  getUser(@LogParam id: string) {
    console.log('调用', id);
  }
}

console.log('类定义之后');
new Probe().getUser('42');
```

这里使用 TypeScript 的 **legacy decorators**，需要开启 `experimentalDecorators`。TypeScript 5.0 引入的另一套装饰器模式不支持参数装饰器，也不兼容这里使用的 `emitDecoratorMetadata`；两套模式不能混着解释。[两套装饰器的区别](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html#differences-with-experimental-legacy-decorators)

实际执行的输出是：

```text
登记 getUser 0
类定义之后
调用 42
```

装饰器在执行类定义时就运行了，比 `getUser('42')` 更早。此时还没有某一次业务调用的实参，它自然不能读到未来传进来的 `'42'`。

它拿到的三个信息，在这个实例方法例子中分别是 `Probe.prototype`、`'getUser'`、`0`。索引从哪里来？看编译之后的关键部分：

```js
class Probe {
  getUser(id) {
    console.log('调用', id);
  }
}

__decorate([
  __param(0, LogParam)
], Probe.prototype, 'getUser', null);
```

编译器把参数位置直接写成了 `0`。辅助函数 `__param` 的工作，可以简化成：

```js
function __param(index, decorator) {
  return (target, method) => decorator(target, method, index);
}
```

最终等价于安排了一次 `LogParam(Probe.prototype, 'getUser', 0)` 调用。JavaScript 不需要在请求到来时解析函数签名来猜位置。

这里要把两个时点分开：**编译器生成这段 JavaScript；运行这段 JavaScript、执行类定义时，装饰器函数才真正被调用。** 编译时并没有执行某次 HTTP 参数提取。

传统参数装饰器的返回值也不会替换某次调用的参数。它适合记录声明信息；要改变之后的方法调用，还需要其他执行逻辑。[TypeScript 参数装饰器规则](https://www.typescriptlang.org/docs/handbook/decorators.html#parameter-decorators)

## 自己做一个 `@Param()`：先记录规则，再让调用器使用它

到这里，装饰器需要知道什么已经很明确了：目标对象、方法名、参数位置，再加上我们传给装饰器工厂的 `'id'`。

我们可以先用一个普通数据结构记录它：

```js
const rules = [{ index: 0, key: 'id' }];
```

如果有多个类、多个方法，只用一个数组就容易混在一起。因此用 `WeakMap` 关联目标对象，再用 `Map` 区分方法。下面是我们自己的教学实现，和 Nest 同名，方便对应含义：

<<< ../../public/examples/nodejs-nestjs-ioc-lab.ts#rules{ts}

`Param('id')` 先返回一个装饰器函数。类定义执行时，编译产物再把目标、方法名和位置传给这个函数。于是下面的写法就能产生对应规则：

```ts
class UserController {
  getUser(@Param('id') id: string) {
    return { id };
  }
}
```

记录在这个目标上的内容，大致是：

```text
UserController.prototype
  └─ getUser
       └─ { index: 0, key: 'id' }
```

这份“描述代码应该如何被使用”的额外信息，现在可以称为 **元数据，metadata**。名字并没有增加新的能力；它仍然只是刚才那条规则。

只记录还不够。我们需要补上另一半：

<<< ../../public/examples/nodejs-nestjs-ioc-lab.ts#invoke{ts}

调用器读取规则，从请求里取值，再把 `args` 交给原方法。`handler.apply(instance, args)` 同时指定了方法内部的 `this`。

所以装饰器和调用器之间有一份约定：一个负责登记，一个负责解释。如果只写 `@Param('id')`，却没有读取规则的调用器，参数不会自行发生变化。

这也解释了为什么登记元数据的装饰器不必在每次请求时重新运行。规则已经存在，请求时要做的是使用规则。真实 Nest 的参数装饰器还会保存参数种类、数据键和 Pipes；保存位置与我们的 `WeakMap` 不同，但同样需要运行时消费者。[Nest 参数规则登记](https://github.com/nestjs/nest/blob/v11.1.6/packages/common/decorators/http/route-params.decorator.ts)

试着把方法改成 `getUser(prefix, @Param('id') id)`。编译器会把索引改为 `1`，调用器就把值写入 `args[1]`。这个模型也没有给 `prefix` 配规则，因此它会得到 `undefined`。参数的位置与提取来源，是两项可以分别检查的信息。

## 那为什么不直接写配置对象？装饰器到底省了什么？

既然我们已经把规则写成了普通对象，自然会继续追问：

> 不用装饰器，直接把这份配置交给框架，不也一样吗？

完全可以。比如路由可以描述为：

```js
const routes = [{
  method: 'GET',
  path: '/users/:id',
  action: 'getUser',
  params: [{ index: 0, key: 'id' }],
}];
```

只要编写相应的扫描器和调用器，它就能表达刚才的关系。

装饰器的价值，在于把这份声明放到了对应的类、方法或参数旁边。改参数时，可以就近看见它的数据来源。代价则是运行关系变得隐含：只读方法本身，很难看见谁在消费声明。

`@Get(':id')` 也是这种关系的一部分。在核对的 Nest 版本中，它登记路径和请求方法等信息；应用初始化时，Nest 扫描 Controller，为路由构造处理逻辑，再登记到 HTTP 适配器。[请求方法元数据登记](https://github.com/nestjs/nest/blob/v11.1.6/packages/common/decorators/http/request-mapping.decorator.ts)

因此，`@Param()` 解决的是“调用时这个位置从哪里取值”，`@Get()` 解决的是“哪条路由需要关联这个方法”。只有参数规则，没有完整的路由注册过程，也不会凭空出现一个可访问的接口。

到这里，我们已经能解释一个请求怎样变成方法实参了。不过，前面的代码一直有一个刻意留下的动作：`new UserController()`。Controller 自己是谁创建的？

## 第二个反问：Controller 仍然自己调用 Service，反转了什么？

把查询用户的业务拆到 Service，再让 Service 使用一个数据访问对象：

```ts
class Database {
  findUser(id: string) {
    return { id, name: '示例用户' };
  }
}

class UserService {
  constructor(private readonly database: Database) {}

  findUser(id: string) {
    return this.database.findUser(id);
  }
}

class UserController {
  constructor(private readonly userService: UserService) {}

  getUser(id: string) {
    return this.userService.findUser(id);
  }
}
```

如果现在有人说“Nest 接管了控制权”，我们仍然可以反问：

> `getUser()` 里明明还是我决定调用 `userService.findUser()`。我也可以改成另一个 Service 方法，这部分控制权并没有交出去啊？

这个反问同样成立。业务方法内部选择调用谁，仍然由业务代码决定。要找到另一项控制权，需要往前退一步，看这些对象是怎样准备好的：

```ts
const database = new Database();
const userService = new UserService(database);
const controller = new UserController(userService);
```

这里，应用代码负责创建对象、决定创建顺序，并把依赖送进构造函数。`UserController` 使用现成的 `UserService`，它不需要在自己的内部创建这个依赖。

**把依赖从外部传入，就是这里的依赖注入，Dependency Injection，DI。** 刚才这条手工 `new` 的链已经在进行构造函数注入，并不需要等到出现 Nest 或容器才算 DI。

如果想在测试时换一个用户查询实现，可以在组装处传入一个满足约定的替代对象。Controller 的业务方法可以继续调用相同接口，而不用同时负责决定依赖怎样创建。

Nest 的 DI 容器进一步接手了这种组装工作：读取依赖关系，找到注册的 Provider，安排创建或复用实例，再交给使用方。这时交出去的是**对象组装和相关生命周期管理**。[Nest DI fundamentals](https://docs.nestjs.com/fundamentals/custom-providers#di-fundamentals)

所以前后两个反问推动我们得到更精确的理解：框架调度请求处理，与容器组装对象，是不同的工作。Controller 继续决定业务调用，与这两项工作由外部组织，可以同时成立。

Express 项目也可以采用手工 DI，或者接入容器。比较框架时，更有意义的问题是项目是否需要这些组织机制，以及愿意为统一约定承担多少额外抽象。

## 类型都擦除了，容器怎么知道构造函数需要谁？

手工组装时，我们明确写出了 `new UserController(userService)`。如果容器只接到一个 `UserController`，它怎样得知还要准备 `UserService`？

看 TypeScript 的声明似乎很容易：

```ts
constructor(private readonly userService: UserService) {}
```

但这个类型注解通常不会留在 JavaScript 中。如果简单回答“容器反射构造函数的 TypeScript 类型”，就会与类型擦除产生冲突。

解决这个疑问，要去看编译产物，而不是假设运行时还握着完整的 TypeScript 类型系统。

在传统装饰器模式下，配合下面的配置：

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

TypeScript 会为符合条件的装饰声明生成一部分额外元数据。[emitDecoratorMetadata 的编译前后示例](https://www.typescriptlang.org/tsconfig/emitDecoratorMetadata.html)

例如，对带有类装饰器的 `UserController`，关键编译产物可以简化成：

```js
UserController = __decorate([
  Managed(),
  __metadata('design:paramtypes', [UserService])
], UserController);
```

注意这里的 `[UserService]`：它是一个数组，里面放着运行时存在的类构造函数引用。容器可以用这个引用继续查找依赖。

类型注解被擦除了，同时编译器又按这套选项额外发出了一条记录；二者并不冲突。也不能据此推导出“所有类型都保留在运行时”。

这样就引出了两个更小的问题：谁负责保存记录？`Managed()` 又做了什么，怎么和真实的 `@Injectable()` 对应？

## `reflect-metadata` 是不是一张存额外信息的表？

可以先这样理解。我们之前用 `WeakMap` 关联目标对象和规则；`reflect-metadata` 提供了另一套更通用的读写接口：

```ts
import 'reflect-metadata';

class UserService {}
Reflect.defineMetadata('role', 'service', UserService);

console.log(Reflect.getMetadata('role', UserService)); // service
console.log(Object.hasOwn(UserService, 'role'));       // false
```

`role` 是元数据键，不会因此成为 `UserService.role` 这个普通属性。编译产物中的 `__metadata()` 会在相应 API 可用时调用它们，登记编译器生成的信息。

所以需要在装饰类的定义被执行之前加载 `reflect-metadata`。如果装饰器已经执行完，事后才加载库，并不会让之前没有登记成功的内容自动重来。

这套 API 还定义了继承查询等语义。例如：

```ts
class Parent {}
Reflect.defineMetadata('role', 'parent', Parent);
class Child extends Parent {}

console.log(Reflect.getMetadata('role', Child));    // parent
console.log(Reflect.getOwnMetadata('role', Child)); // undefined
```

`getMetadata()` 可以沿原型链查找；`getOwnMetadata()` 只看自身。把它理解为“目标、成员、元数据键和值之间的关联”更有帮助，不能把一个简化的 `WeakMap` 当成它的完整实现。[reflect-metadata 的 API 与语义](https://github.com/microsoft/reflect-metadata)

它负责记录和读取；记录中的 `[UserService]` 来自编译器；根据这个引用创建实例，则是容器的工作。把这些职责分开，反射就不再是一个包办所有事情的词。

## `@Injectable()` 会自动创建对象吗？用一个空装饰器检验

现在可以做一个很小的反例实验：完全不用 Nest 的 `@Injectable()`，只写一个什么也不做的类装饰器。

<<< ../../public/examples/nodejs-nestjs-ioc-lab.ts#managed{ts}

把它加到我们自己的模型上，仍然让编译器开启上面的两个选项：

<<< ../../public/examples/nodejs-nestjs-ioc-lab.ts#objects{ts}

这就是查询用户例子的最终教学版本：`getUser()` 使用之前实现的参数规则，构造函数则接收外部提供的依赖。

此时可以读取：

```ts
Reflect.getMetadata('design:paramtypes', UserController);
// [UserService]
```

空的 `Managed()` 没有解析类型，也没有创建 `UserService`。元数据仍然出现，证明这里负责发出类型信息的是编译器。`emitDecoratorMetadata` 也不是让所有未装饰的声明都拥有完整反射；要检查具体声明是否触发了生成。

真实 Nest 的 `@Injectable()` 有额外的框架用途，会登记可注入标记和作用域选项等信息。[可注入装饰器实现](https://github.com/nestjs/nest/blob/v11.1.6/packages/common/decorators/core/injectable.decorator.ts) 但“类装饰器触发这里的编译期信息生成”和“容器实际创建依赖”，仍然是两回事。后者还要求 Provider 已注册且在当前模块可见。使用不同编译器或构建工具时，也要核对实际产物，不能仅凭写了一个装饰器就假定信息完整。

既然已经拿到 `[UserService]`，我们现在终于能亲手接上对象组装的那一半了。

## 把手工 `new` 的顺序交给一个微型容器

沿着依赖向下看：`UserController` 需要 `UserService`，后者需要 `Database`。先创建最底层，再依次向上组装，就能复现刚才的手工过程。

<<< ../../public/examples/nodejs-nestjs-ioc-lab.ts#container{ts}

容器做了四件事：读取依赖数组、递归准备依赖、调用构造函数、缓存实例。

这份模型把类构造函数直接当作依赖标识，并自动尝试创建它；真实 Nest 还需要 Provider 注册表和模块解析，不能用这段代码替代。模型只在一个容器内复用对象，没有实现请求作用域、循环依赖、异步工厂、销毁钩子，也没有完整检查缺失的元数据。

不过，用它解释这次组装已经足够。把容器和前面的调用器接起来：

<<< ../../public/examples/nodejs-nestjs-ioc-lab.ts#run{ts}

执行输出为：

```text
[ 'UserService' ]
{ id: '42', name: '示例用户' }
true
```

第一行说明 Controller 的构造函数依赖记录里有 `UserService`。第二行说明另一条参数规则把请求中的 `'42'` 放进了 `getUser()` 的实参。第三行验证同一个教学容器复用了实例。

到这里，两条原来混在一起的链已经能分别追踪：

| 我们在问什么 | 参数从哪里来 | 谁负责组织 | 在这个例子中何时发生 |
| --- | --- | --- | --- |
| Controller 构造函数需要什么 | 依赖元数据和对应实例 | 容器 | 创建 Controller 时 |
| `getUser()` 收到什么 | HTTP 路径参数 | 参数调用器 | 处理请求时 |

二者都可以表现为“准备一组实参，再调用一个函数”，但数据来源、消费者和生命周期不同。真实 Nest 的默认单例通常在应用初始化时准备；请求作用域等情形会改变实例创建时机，不宜把“所有依赖都只在启动时创建一次”当成通则。

## 回到真实 Nest：为什么接口依赖还要写 `@Inject()`？

前面用类作为依赖，类构造函数在 JavaScript 中存在。再换一个常见的需求：我们希望 Service 依赖一个接口，以便替换数据访问实现。

```ts
interface UserStore {
  findUser(id: string): { id: string; name: string };
}
```

如果直接写 `constructor(database: UserStore)`，运行时没有一个名为 `UserStore` 的接口对象可以交给容器。这里的类型元数据也不能完整保留接口、泛型、联合类型等 TypeScript 信息。

因此需要一个明确存在于运行时的标识，也就是注入令牌：

```ts
const USER_STORE = Symbol('USER_STORE');

@Injectable()
class UserService {
  constructor(@Inject(USER_STORE) private readonly database: UserStore) {}

  findUser(id: string) {
    return this.database.findUser(id);
  }
}

@Module({
  controllers: [UserController],
  providers: [
    UserService,
    { provide: USER_STORE, useClass: Database },
  ],
})
class AppModule {}
```

这是接入真实 Nest 的替换片段：`Injectable`、`Inject`、`Module` 来自 `@nestjs/common`，`UserController` 使用开头的路由装饰器，`Database` 使用前面的实现。教学模型中的 `Managed()` 和 `Param()` 应替换为对应的 Nest 装饰器。

`@Inject(USER_STORE)` 明确声明依赖哪个令牌，模块里的 `provide` / `useClass` 明确声明这个令牌采用哪个实现。类型注解继续服务于静态检查，运行时选择则有了可用的依据。[Nest 的非类令牌与自定义 Provider](https://docs.nestjs.com/fundamentals/custom-providers#non-class-based-provider-tokens)

如果把 Provider 放在另一个模块，还需要导出它，并在使用方模块导入相应模块。写上 `@Injectable()` 或 `@Inject()` 都不能替代可见性配置。Nest 的 `Injector` 会结合构造函数类型记录和显式注入令牌解析依赖。[Nest 11.1.6 的依赖解析](https://github.com/nestjs/nest/blob/v11.1.6/packages/core/injector/injector.ts)

这个反例再次说明：这里的机制建立在具体的编译产物、元数据和 Provider 配置上，不能概括成“运行时能读出所有 TypeScript 类型”。

## 现在重新走一遍 `GET /users/42`

我们可以把开头的几行代码还原成三个连续阶段：

```text
编译 TypeScript
  生成应用装饰器的 JavaScript 调用
  按配置生成部分 design:paramtypes 记录

执行模块、定义类，并初始化 Nest 应用
  装饰器登记路由、方法参数和依赖相关信息
  Nest 扫描模块并解析 Provider，准备默认作用域的对象
  根据路由信息，向 HTTP 适配器登记处理逻辑

处理 GET /users/42
  HTTP 适配器匹配路由，进入 Nest 处理链
  Nest 根据参数规则取出路径中的 42，执行相应 Pipes
  以正确的 this 调用 controller.getUser('42')
  Controller 调用 Service，Service 使用已组装的依赖
  处理返回值或异常，完成响应
```

这是帮助阅读的主线；真实请求管线还会执行 Guards、Interceptors 等步骤，请求作用域对象也有自己的解析时机。前面省略这些细节，是为了先看清调用和数据流；对应实现可以从 `RouterExecutionContext` 继续读起。

回头再看两个反问，答案已经不依赖记忆定义了。

“Express 不也在调用回调吗？”——是的，请求调度上的控制反转早已存在。介绍 Nest 时，需要进一步解释它还组织了哪些职责。

“Controller 还在自己调用 Service，反转了什么？”——业务选择仍然在方法里，容器承担的是依赖准备和对象组装。这些控制关系可以同时存在。

装饰器、反射和容器也都能落到具体动作上：装饰器登记规则，反射 API 读写记录，调用器和容器消费这些记录。理解它们各自负责哪一步，比把它们统称为“框架魔法”更便于调试。

## 把完整示例跑起来

下载[完整教学代码](/examples/nodejs-nestjs-ioc-lab.ts)，在一个新的空目录中保存为 `nodejs-nestjs-ioc-lab.ts`。正文中的规则、调用器、对象和容器代码直接引用这份文件，避免两份代码分别维护。

下面固定一组用于复现的版本；它们不是生产项目的版本选型建议：

```bash
npm init -y
npm install --save-exact reflect-metadata@0.2.2
npm install --save-dev --save-exact typescript@5.9.3
npx tsc nodejs-nestjs-ioc-lab.ts --target ES2022 --module commonjs --experimentalDecorators --emitDecoratorMetadata --strict --skipLibCheck --outDir dist
node dist/nodejs-nestjs-ioc-lab.js
```

这里选择新空目录，是为了使用默认的 CommonJS 包环境，避免已有项目的 `type: module` 设置与输出格式冲突。教学代码没有 HTTP 服务器，不需要连接数据库，也不需要安装 Nest。

本次验证使用 Node.js `v22.23.3`、TypeScript `5.9.3` 和 `reflect-metadata` `0.2.2`，对完整模型进行编译与执行；另外使用 Nest `11.1.6`、Express `5.1.0` 做真实 HTTP 对照，核对路径参数、构造函数依赖和显式令牌注入。验证涉及本文这些场景，不代表模型覆盖 Nest 的全部生命周期或错误处理。

如果想检验自己是否理解，可以再做两个变化：把 `id` 移到第二个参数，观察索引和实参数组；把自动组装改回手工 `new`，观察方法业务逻辑是否需要改变。能够解释这些变化，就能开始把同样的方法用于阅读其他框架。

继续深入时，可以按当前遇到的问题选择资料：参数装饰器规则看 [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/decorators.html)，编译期记录看 [emitDecoratorMetadata](https://www.typescriptlang.org/tsconfig/emitDecoratorMetadata.html)，存储与继承语义看 [reflect-metadata](https://github.com/microsoft/reflect-metadata)，真实参数调用看 [RouterExecutionContext](https://github.com/nestjs/nest/blob/v11.1.6/packages/core/router/router-execution-context.ts)，Provider 选择看 [Nest 自定义 Provider](https://docs.nestjs.com/fundamentals/custom-providers)。
