---
title: HTTP 代理：请求解压与响应压缩
date: 2026-10-22
tags:
  - HTTP
  - 反向代理
  - 压缩
description: 区分请求内容解码与响应压缩，解释编码头、代理和应用的职责，以及如何验证实际链路。
---

# HTTP 代理：请求解压与响应压缩

## 要解决的问题

反向代理能为响应启用 gzip，是否意味着客户端发送的 gzip 或 Brotli 请求也会被它解压？如果后端能直接读取 JSON，解压究竟发生在哪里？

**请求解压与响应压缩是两个独立能力。** 仅凭前面有 CDN、网关或反向代理，不能判断后端收到的是压缩字节还是原始内容；需要核对实际产品、版本、过滤器、路由配置和执行顺序。

本文依据 HTTP 标准和公开产品文档整理，不描述任何特定生产部署。配置片段和验证步骤用于说明机制，不代表已完成环境实测。

## 核心原理：先分清头部与方向

| 位置与字段 | 含义 |
| --- | --- |
| 请求 `Content-Encoding: gzip` | 本次请求体已用 gzip 编码 |
| 请求 `Content-Type: application/json` | 解码后的内容类型是 JSON |
| 请求 `Accept-Encoding: gzip, br` | 客户端接受哪些响应编码 |
| 响应 `Content-Encoding: gzip` | 本次响应体已用 gzip 编码 |
| 响应 `Accept-Encoding` | 可用于告知客户端后续请求可采用的内容编码 |

Content-Encoding 描述已经应用的编码；Accept-Encoding 表达可接受的编码，两者不能互换。设置 Content-Encoding 本身不会压缩数据。[RFC 9110 §8.4](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4)、[§12.5.3](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3)。

TLS 解密、HTTP 分帧／分块、HTTP/2 或 HTTP/3 的头部压缩，都不等同于对请求 body 执行 gzip／Brotli 解压。

## 请求方向：可能转发、解压，也可能拒绝

下图是假设代理保留压缩内容的通用链路：

```mermaid
flowchart LR
  A[客户端压缩 JSON] --> B[请求声明 Content-Encoding]
  B --> C[代理保留编码头和压缩字节]
  C --> D[应用解析中间件解压]
  D --> E[业务获得 JSON 对象]
```

应用能读到对象，只能说明业务处理前有人完成了解码与解析，不能反推一定由代理完成。

| 代理的请求处理策略 | 后端需要知道什么 |
| --- | --- |
| 保留压缩内容并转发 | 后端解析器需支持对应编码，或者拒绝 |
| 先解压再转发 | 后端收到解码后的数据，编码头与长度必须同步处理 |
| 拒绝不允许的编码 | 请求不应继续进入后端解压器 |

作为公开例子，Envoy 提供 Decompressor HTTP filter，可以分别处理请求与响应。启用后按请求头和配置决定是否解压，并移除已处理的编码及原 Content-Length。这说明请求解压可以由代理承担，但不能据此认定任何 Envoy 部署已启用该过滤器。[Envoy Decompressor](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/decompressor_filter)。

发生解压时，消息元信息也必须与新内容一致：不能将已解压 body 仍标为 gzip，也不能继续使用压缩内容的长度。若只解开多层编码中的一层，还需准确描述剩余编码。

## 响应方向：根据能力、配置和内容选择编码

常见模式是应用返回普通 JSON，由代理根据客户端的 Accept-Encoding 和自身配置压缩响应，再设置 Content-Encoding。也可以由应用自身完成响应压缩。

以 NGINX 为例，`ngx_http_gzip_module` 是响应压缩过滤器。`gzip`、`gzip_types`、`gzip_min_length` 和 `gzip_vary` 分别控制启用、类型、长度阈值和 Vary 头行为。这组指令不是请求解压配置。[NGINX gzip 模块](https://nginx.org/en/docs/http/ngx_http_gzip_module.html)。

响应是否压缩通常要检查：

- 客户端接受的算法、权重和禁用值，例如 `gzip;q=0`。
- 当前路由是否启用了该编码，内容类型和体积是否符合策略。
- 内容是否已经编码，是否需要透传或进行明确配置的转换。
- 流式传输、缓存、延迟和 CPU 成本是否适合该压缩策略。

各产品对流式响应和长度判断的支持不同，不能概括成“chunked 或流式响应一律不能压缩”。缓存不同编码的表示时，还要正确处理 Vary 等缓存元信息。

## 最小示例：相同算法，两个不同方向

请求压缩的示意报文：

```http
POST /api/items HTTP/1.1
Host: api.example.com
Content-Type: application/json
Content-Encoding: gzip

<gzip 压缩后的 JSON 字节>
```

响应压缩协商的示意报文：

```http
GET /api/items HTTP/1.1
Host: api.example.com
Accept-Encoding: gzip, br
```

服务器选择 gzip 后，响应可包含：

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Encoding: gzip
Vary: Accept-Encoding

<gzip 压缩后的 JSON 字节>
```

这两种交互可以独立存在。客户端收到 gzip 响应，不能证明代理会处理 gzip 请求，更不能证明其支持入站 br。

## 如何验证实际链路

在授权测试环境使用小体积、合法的压缩样本，分别观察客户端、代理出站与应用解析前后的数据：

1. 固定同一段普通 JSON，分别生成 identity、gzip 和需要验证的其他编码。
2. 设置匹配的 Content-Type 与 Content-Encoding，确保真实字节与声明一致。
3. 在应用 parser 之前记录有限的元信息，例如编码、长度、测试样本摘要；不要记录敏感正文。
4. 确认代理出站的 body 和编码头是否变化，再观察业务最终收到的解析结果。
5. 分开验证响应编码；记录每一跳的版本和生效配置，不用单次响应推断全部路由。

仅查看解析后的 `req.body` 不够；某些客户端还会自动解压响应，导致展示层与线上字节不同。测试应说明观察点和工具是否自动解码。此处列出的是验证方法，不是已执行的测试结果。

## 适用边界与常见错误

- 代理具备解压功能，不等于当前路由启用了它。
- 后端未直接调用 zlib，不等于其 HTTP 中间件没有解压。
- 请求通过 HTTPS，不会让不可信压缩内容变得可信。
- 把 Content-Encoding 删除而保留压缩字节，会破坏报文语义。
- gzip 响应压缩配置不能作为入站 br 被拒绝的证据。

Node 侧的具体处理方式见 [Nest／Express 入站解压与 br 控制](./nest-express-request-decompression.md)。

## 公开参考

- [RFC 9110：Content-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.4)
- [RFC 9110：Accept-Encoding](https://www.rfc-editor.org/rfc/rfc9110.html#section-12.5.3)
- [NGINX 响应 gzip 模块](https://nginx.org/en/docs/http/ngx_http_gzip_module.html)
- [Envoy Decompressor 过滤器](https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/decompressor_filter)
