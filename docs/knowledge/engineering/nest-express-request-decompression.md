---
title: Nest／Express 入站解压与 br 控制
date: 2026-10-22
tags:
  - Node.js
  - NestJS
  - Express
  - HTTP
description: 解释默认 body parser、Content-Encoding、版本差异与浏览器请求行为，并在解析之前限制入站压缩编码。
---

# Nest／Express 入站解压与 br 控制

## 要解决的问题

业务没有写解压代码，为什么仍可能执行 Brotli 解压？不显式注册 body-parser 的 Nest 服务是否也有这个能力？如果要拒绝 br，应放在中间件、Guard 还是 Controller？

**解压能力来自实际执行的请求解析器。** Express 提供 body-parser 的接口，后者按 Content-Encoding 调用 Node zlib；Nest 的 Express 适配器还会默认注册 JSON／表单 parser。是否支持 br 取决于解析器版本，能否触发还取决于类型匹配、配置和执行顺序。

本文使用公开源码和通用示例说明机制，没有检查任何生产服务或运行漏洞利用。版本表用于对照历史实现，不代表推荐继续部署这些版本。

## 核心原理

```text
HTTP 请求流
  → 入口中间件
  → parser 检查 body 和 Content-Type
  → 读取 Content-Encoding，选择解压器
  → 读取解码后的内容
  → 解析 JSON／表单或保留 Buffer／文本
  → 写入 req.body
  → 后续业务处理
```

Express 的 `json()`、`urlencoded()`、`raw()` 和 `text()` 是对 body-parser 对应接口的导出，开发者不一定需要单独导入该包。[Express 源码](https://github.com/expressjs/express/blob/v5.2.1/lib/express.js#L73)。

### 纯 Express：注册 parser，默认允许解压

```ts
import express from 'express';

const app = express();
app.use(express.json({ limit: '1mb' }));
app.post('/api/echo', (req, res) => {
  res.json(req.body);
});
```

当请求包含 `Content-Type: application/json`、`Content-Encoding: gzip`，且 body 是真正的 gzip JSON 时，parser 默认先解压，再解析为对象。这里的 1 MB 只是示例，应按接口需要确定。

如果只有 `express()` 和路由而没有 parser，Express 不会自动完成这件事；直接读取原生请求流仍是压缩字节。`inflate` 默认开启，但必须先有一个匹配且实际执行的 parser。[选项与类型匹配](https://github.com/expressjs/body-parser/blob/v2.2.1/lib/utils.js#L52)。

### Nest：业务没配置，不代表链路没 parser

Nest 9.4.3 的初始化逻辑默认注册 JSON／URL-encoded parser，除非 `bodyParser: false`；Express 适配器会检查已有同名中间件以避免重复注册。[Nest 初始化](https://github.com/nestjs/nest/blob/v9.4.3/packages/core/nest-application.ts#L169)、[Express 适配器](https://github.com/nestjs/nest/blob/v9.4.3/packages/platform-express/adapters/express-adapter.ts#L226)。

需要区分三个开关：

| 配置 | 实际作用 |
| --- | --- |
| 不写 `inflate: true` | 默认仍允许 parser 解压 |
| parser 设置 `inflate: false` | 拒绝进入该 parser 的非 identity 编码 |
| Nest 设置 `bodyParser: false` | 关闭 Nest 默认 parser 注册；不影响手动挂载的 parser |

上述 Nest 结论针对 Express 适配器。Fastify、自定义适配器和嵌套应用需重新检查实际入口。

## br 支持取决于哪个版本

| 公开源码版本 | 支持的读取分支 |
| --- | --- |
| body-parser 1.20.1 | identity、gzip、deflate；br 产生不支持编码错误 |
| body-parser 2.2.1 | 增加 br，调用 `zlib.createBrotliDecompress()` |

依据：[1.20.1 读取实现](https://github.com/expressjs/body-parser/blob/1.20.1/lib/read.js#L143)、[2.2.1 读取实现](https://github.com/expressjs/body-parser/blob/v2.2.1/lib/read.js#L176)。不支持的编码会生成 415 错误，最终 HTTP 响应可能受应用异常处理影响。

Express 4.18.2 的包声明依赖 body-parser 1.20.1；Express 5.2.1 声明的是 `^2.2.1` 范围。后者不是“任何安装都固定为 2.2.1”，必须进一步读取锁文件与部署产物。[Express 4.18.2 包声明](https://github.com/expressjs/express/blob/4.18.2/package.json)、[Express 5.2.1 包声明](https://github.com/expressjs/express/blob/v5.2.1/package.json)。

一个应用可能同时存在平台适配器依赖的旧版 parser，以及应用直接导入的新版 Express parser。不能根据 Nest 主版本、TypeScript 类型包版本，或锁文件中某一条 body-parser 记录直接下结论；要沿实际导入关系和中间件注册顺序追踪。

## 最小示例：在解压之前限制编码

### 允许 identity、gzip、deflate，拒绝 br

已检查版本没有单独的 `brotli: false` 开关。若要保留 gzip／deflate，可以在最早的 HTTP 入口设置允许列表：

```ts
import { NestFactory } from '@nestjs/core';
import type { RequestHandler } from 'express';
import { AppModule } from './app.module';

const restrictEncoding: RequestHandler = (req, res, next) => {
  const encoding = String(
    req.headers['content-encoding'] ?? 'identity',
  ).trim().toLowerCase();

  if (!['identity', 'gzip', 'deflate'].includes(encoding)) {
    res.status(415).json({ message: 'Unsupported Content-Encoding' });
    return;
  }

  next();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(restrictEncoding);

  // 如有显式 parser，必须在此后注册，并保留原有业务选项。
  // 否则由 Nest 在初始化阶段挂载默认 JSON／表单 parser。
  await app.listen(3000);
}

void bootstrap();
```

该允许列表还会拒绝其他编码和多重编码，例如 `gzip, br`，比单独禁止 br 更严格。HTTP 标准允许描述多重编码，但应用不必支持所有组合，应明确接口契约。

拦截器必须早于任何读取／解压 body 的组件，以及 `app.init()`／`app.listen()`。如果顶层 Express 已经挂载 parser，再进入 Nest 子应用，则规则应放到顶层 parser 之前。

| 位置 | 是否适合阻止解压 |
| --- | --- |
| 网关转发前的拒绝规则 | 可以，需确认覆盖范围和生效配置 |
| 顶层 HTTP 入口、所有 parser 之前 | 可以，由服务自身控制 |
| Nest 模块中间件 | 不能默认认为足够早；默认 parser 通常先注册 |
| Guard／Interceptor／Controller | 通常已经完成 body 解析，太晚 |
| body-parser `verify` 回调 | 读取解压后的数据之后才调用，太晚 |

执行顺序依据见 [Nest 初始化源码](https://github.com/nestjs/nest/blob/v9.4.3/packages/core/nest-application.ts#L169)和 [body-parser 读取、验证流程](https://github.com/expressjs/body-parser/blob/v2.2.1/lib/read.js#L84)。

### 禁止全部请求压缩

可以关闭 Nest 默认 parser 注册，再配置需要的解析器：

```ts
const app = await NestFactory.create(AppModule, { bodyParser: false });
app.use(express.json({ inflate: false, limit: '1mb' }));
app.use(express.urlencoded({ inflate: false, extended: true, limit: '1mb' }));
```

此片段假设已导入 Express，大小限制仅为示意。`inflate: false` 同时拒绝 gzip、deflate 和 br；它不是“跳过解压后继续正常解析”。其他 raw／text parser、自定义解压代码和上游过滤器也需独立检查。

`express.raw()` 表示输出 Buffer，不天然表示保留线上压缩字节；它同样有 inflate 选项。不要删除 Content-Encoding 来禁用解压，也不要把解析后的 body 类型当作是否解压的证据。

## 浏览器请求体通常会自动压缩吗

普通 `fetch()`、XHR、表单和文件上传通常不会自动对整个请求 body 做 gzip／br 压缩。浏览器常自动发送的 Accept-Encoding 用于响应协商，不能说明请求本身已压缩。[Fetch 标准](https://fetch.spec.whatwg.org/)、[HTTP 压缩说明](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Compression)。

前端代码或 SDK 可以主动使用 Compression Streams API 或压缩库，发送压缩字节并设置 Content-Encoding。[Compression Streams API](https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API)。仅写请求头不会执行压缩。

在 DevTools 的 Network 中检查 Request Headers 的 Content-Encoding，并核对发送代码；不要混淆 Accept-Encoding 和 Response Headers。上传 ZIP 或 JPEG 文件也不等同于整个 HTTP body 使用内容编码压缩。

正常前端不用 br，不能证明服务端解压分支不可到达，其他 HTTP 客户端仍可以发送这种请求。

## 适用边界与验证方法

本页的结论来自公开源码阅读，代码为通用配置示例，没有执行生产接口测试。建议在授权测试环境验证：

| 输入 | 编码允许列表启用后的预期 |
| --- | --- |
| 普通 JSON，无编码头 | 进入 JSON parser |
| 合法 gzip／deflate JSON | 进入支持该算法的 parser 并解压 |
| 合法 br JSON | 在 parser 前返回 415 |
| 多重编码或未知编码 | 在 parser 前返回 415 |
| Content-Type 不匹配 | parser 可能跳过，应另核对路由的类型处理 |

使用小体积正常样本，不以恶意压缩载荷验证。确认 br 被拒绝发生在解码器之前，不能只根据最终状态码下结论。大小限制也不等于完全消除解压 CPU／内存开销。

禁止入站 br 不会禁用出站 HTTP 客户端、文件处理或其他任务的 Brotli 解压，也不替代运行时安全升级。相关背景见 [Node.js 运行时安全](./nodejs-runtime-security-brotli-tls.md)；代理侧职责见 [HTTP 代理：请求解压与响应压缩](./http-proxy-compression.md)。

## 常见错误

- 把“没有业务解压代码”当作“进程不解压”。
- 仅根据 Nest 主版本或类型声明判断 br 支持。
- 只关闭 Nest 默认 parser，却遗漏手动挂载的 parser。
- 在 Guard 或 verify 回调中拒绝，误以为阻止了解压。
- 仅观察正常浏览器流量，就认定其他编码不会进入服务。

## 公开参考

- [Node HTTP API](https://nodejs.org/api/http.html#http)
- [Nest 9.4.3 请求解析器注册](https://github.com/nestjs/nest/blob/v9.4.3/packages/core/nest-application.ts#L169)
- [Express 5.2.1 body-parser 接口导出](https://github.com/expressjs/express/blob/v5.2.1/lib/express.js#L73)
- [body-parser 2.2.1 编码选择](https://github.com/expressjs/body-parser/blob/v2.2.1/lib/read.js#L176)
- [RFC 9110：内容编码](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4)
