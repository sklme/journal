---
title: Node.js 运行时安全：Brotli、TLS 与证书信任边界
date: 2026-10-22
tags:
  - Node.js
  - 安全
  - Brotli
  - TLS
description: 解释 Brotli 越界写入、TLS 身份校验与 eMudhra 证书信任问题，用简化示例梳理触发路径、修复边界和升级检查。
---

# Node.js 运行时安全：Brotli、TLS 与证书信任边界

> 适用场景：Node.js API、SSR/BFF、代理、网页抓取、文件处理、CI 和开发环境。
>
> 首次记录：2026-10-22。依据 2026-10-21 官方安全发布公告及公开补丁整理；本文没有执行漏洞利用或验证任何生产系统已受攻击。代码与流程示意不等同于可复现的漏洞利用程序。

## 要解决的问题

为什么没有显式调用解压库也会暴露于内存漏洞？证书签名正确，为什么仍可能连接到错误的服务器？本文以 2026 年 10 月安全更新为案例，建立从外部输入、原生运行时到身份信任的排查方法。

## 结论与修复版本

本次更新需要同时检查外部请求入口和出站请求：Brotli 解压可能由框架自动触发；TLS 与证书信任问题主要关系到 Node 连接其他服务时是否正确验证对方身份。

| 发布分支 | 本次修复版本 |
| --- | --- |
| 22.x | 22.23.4 |
| 24.x | 24.22.1 |
| 26.x | 26.12.1 |

版本与最高严重度 High 以 [Node.js 官方公告](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)为准。这是本次安全发布的基线，不代表未来一直是最新安全版本。停止维护的旧分支没有出现在本次修复列表中，不能据此认定不受影响。

## 1. Brotli：解压过程中的内存安全问题

### 1.1 为什么数据可以影响程序执行

Brotli 常用于 HTTP 的 `Content-Encoding: br`。压缩流包含还原数据所需的编码信息，解码器据此更新内部状态并写入输出。

Node 使用的底层 Brotli 解码器由原生 C 代码实现，直接访问内存。下面仅演示越界写入的一般含义，数字和布局不是本漏洞的实际参数：

```text
输出缓冲区：[ 0 ][ 1 ][ 2 ][ 3 ] | 相邻程序数据
合法范围：  ←──── 4 字节 ────→
错误写入：  ←──────── 8 字节 ─────────→
                                  覆盖相邻内存
```

覆盖普通数据可能导致异常或崩溃；若攻击者能够进一步控制关键数据并绕过运行环境的保护，可能改变程序执行流程。这里没有把压缩内容作为 JavaScript 执行，也无需业务显式调用 `eval()`。[Brotli 安全发布](https://github.com/google/brotli/releases/tag/v1.2.1)将 CVE-2026-111497 描述为可导致远程代码执行的越界写入。

### 1.2 补丁具体修了什么

[公开补丁](https://github.com/google/brotli/commit/0ed4268a4401abcb44720963)调整了块类型切换的错误处理：区分“输入尚不足”和“压缩流格式非法”，并让调用路径传递、检查错误，停止处理非法状态。部分旧路径没有传播切换失败的结果。

这些变化能解释修复方向，但补丁本身不等于完整利用分析；不能仅凭它断言某个业务部署可以稳定执行任意代码。

### 1.3 一个普通 fetch 如何接触恶意压缩流

网页预览服务可能只写了这样的代码：

```js
// 入口示意：真实业务还需要 URL 校验和出站访问控制。
const response = await fetch(userProvidedUrl);
const html = await response.text();
```

目标服务器若返回 `Content-Encoding: br`，Undici 的 fetch 实现会调用 `zlib.createBrotliDecompress()`。因此，读取外部响应可以自动进入原生解码器，不要求业务手动使用 Brotli API。[Undici 实现](https://github.com/nodejs/undici/blob/v7.30.0/lib/web/fetch/index.js#L2028-L2064)

```mermaid
flowchart LR
  A[用户提交网址] --> B[Node 发起 fetch]
  B --> C[外部服务器返回 br 响应]
  C --> D[自动调用 Brotli 解码器]
  D --> E[解码成功后业务才得到正文]
```

入站也需要检查：支持 Brotli 的 body-parser 可自动解压请求体，`inflate` 默认开启。实际是否支持取决于安装版本和配置；若解析中间件位于鉴权之前，未登录请求也可能进入解压流程。[body-parser 文档](https://expressjs.com/en/resources/middleware/body-parser/)

据此判断，网页抓取、图片代理、资源导入，以及解压用户上传内容的后台任务都是重点排查对象。仅生成 `.br` 文件或发送已有压缩文件，不会因该动作本身触发解码器漏洞。

## 2. TLS：主机名与 IP 的解释不一致

### 2.1 证书可信与身份匹配是两项检查

HTTPS 客户端既要验证签名链是否可信，也要验证证书是否属于目标主机。证书中的名称类型有意义：

```text
DNS:192.0.2.1
IP Address:192.0.2.1
```

两者虽然显示相同数字，却不是同一种身份声明。IP 目标不能直接套用 DNS 名称匹配规则。

### 2.2 全角数字示例

将官方测试中的地址替换为文档专用地址，示意输入为 `１９２.0.2.1`：前面的数字为全角字符。旧逻辑可能不把原始形式识别为标准 IP，进入域名匹配分支后又将它规范化为 `192.0.2.1`，从而接受本应不匹配的 DNS 类型声明。[全角数字修复与测试](https://github.com/nodejs/node/commit/de49c913f2)

另一个相关问题是系统解析器与身份校验代码对非标准数字地址的理解可能不同。最终补丁拒绝“原始形式不是标准 IP，经过 `domainToASCII()` 才成为 IP”的输入，避免拿一个可能不对应实际对端的地址验证证书。[非标准 IP 修复](https://github.com/nodejs/node/commit/935918e342)

这解释了用户可指定 URL 的连接测试、Webhook、代理和导入功能为何值得优先检查。该示例说明身份校验中的类型混淆，不保证每个 URL API 都把原始字符串原样传到底层，也不意味着任意自签名证书都会通过可信链验证。

## 3. eMudhra：可信签发能力失陷

### 3.1 证书链为什么仍可能验证通过

正常信任关系如下：

```text
客户端信任的根 CA
    └─签名授权→ 中间 CA
                    └─签发→ 网站证书
```

一旦中间 CA 私钥失陷，攻击者可能在该 CA 授权范围内签发伪造网站证书。证书的签名和域名可以都正确，但实际签发者已不可信。

假设 Node 要访问 `api.example.com`：若攻击者还能通过受控网络或解析路径接走连接，再出示用失陷 CA 签发的伪造证书，仍信任该链的客户端可能接受连接并发送业务凭据。这是风险示意；私钥失陷本身不会自动重定向流量，也不代表能直接解密全部历史 HTTPS 流量。[Mozilla 安全团队通告](https://seclists.org/oss-sec/2026/q4/233)

### 3.2 Node 黑名单做了什么

Node 默认没有在线证书吊销检查，也没有浏览器的 CRLSet/OneCRL 机制。本次补丁加入 SPKI SHA-256 公钥指纹黑名单，在证书验证路径中拒绝命中密钥的证书链；按公钥匹配能覆盖同一密钥对应的不同证书。[Node 修复 PR](https://github.com/nodejs/node/pull/66871)

因此，没有购买 eMudhra 证书的业务也可能需要更新自己的客户端运行时。更新浏览器不能替代更新 Node；若连接因封禁而失败，应调查证书链，不能通过 `rejectUnauthorized: false` 关闭验证来恢复。补丁还说明，升级前已建立的 TLS 会话在恢复时不会重新验证，需要考虑旧连接和会话缓存生命周期。

## 4. DNS：NUL 让两层看到不同的主机名

以下是一个不充分的业务白名单检查示意：

```js
const host = 'example.com\u0000.trusted.example.com';
host.endsWith('.trusted.example.com'); // true：只检查后缀是不充分的。
```

JavaScript 允许字符串包含 NUL；底层 C 字符串将 NUL 视为结束标记：

```text
业务检查：example.com\0.trusted.example.com
实际查询：example.com
```

官方补丁在 DNS 接口入口拒绝含 NUL 的输入，测试中也解释了 c-ares 的 C 字符串截断行为。是否进一步形成 SSRF 或其他绕过，取决于业务如何使用解析结果；不能推断所有 URL 接口都接受 NUL。[DNS 补丁](https://github.com/nodejs/node/commit/843a1627dc)

## 5. 启动快照：随机缓存被复制

运行时可能预取随机数据以减少调用成本。如果自定义启动快照保存了尚未消费的随机缓存，多个恢复进程会拿到相同库存：

```text
快照保存的剩余缓存：[B, C, D]
进程 1 恢复后使用： B → C → D
进程 2 恢复后使用： B → C → D
```

随机源本身可以正常，但输出在进程之间重复。若业务依赖这些输出生成唯一标识或安全凭据，可能造成冲突或可预测性。修复在快照序列化和反序列化的相关阶段清理 `randomUUID()`、`randomInt()` 的缓存。这是特定快照路径的问题，不能概括成所有普通 Node 进程的随机数都不安全。[随机缓存补丁](https://github.com/nodejs/node/commit/4d6990b33c)

## 6. Keep-alive：请求发出前已有响应排队

HTTP 客户端复用空闲连接时，可能发生如下示意过程：

```text
请求 A → 响应 A → 连接进入空闲池
                       ↓
              对端提前发送额外响应数据
                       ↓
请求 B 复用连接 → 错把已排队数据作为 B 的响应
```

旧检查依赖事件循环处理 I/O，数据可能已到达操作系统缓冲区，但尚未触发上层处理。修复在把连接交给新请求前检查底层是否有待读状态；有则销毁连接。具体业务影响取决于对端控制能力和业务如何信任响应。[HTTP Agent 补丁](https://github.com/nodejs/node/commit/96c3ccb1fc)

## 7. 其他修复与范围边界

官方公告还列出 ZIP 头校验失败后返回攻击者可控前缀数据、权限模型通配符匹配过度授权，以及 `fs.realpathSync` 权限模型绕过。前两项影响 26.x，后一项涉及 22.x、24.x、26.x。它们需要对应 API 或权限模型使用场景，不代表操作系统文件权限普遍失效。本文未对这些补丁进行独立复现。[官方漏洞清单](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)

## 8. 按部署形态排查和升级

以下是依据触发条件作出的工程判断，不是已完成的项目审计结果。

| 使用方式 | 优先检查 |
| --- | --- |
| Vue/React 构建后仅部署静态文件 | 开发机、CI 和下载任务；用户浏览静态文件不会执行构建机 Node |
| Node API、Next/Nuxt SSR、BFF | 入站请求解压、出站 HTTP 请求、运行时版本 |
| 网页抓取、图片代理、URL 导入 | 外部响应解压、目标地址控制和 TLS 身份校验 |
| 内部脚本、定时任务 | 是否消费外部内容，不能只凭内网运行排除风险 |
| 自定义启动快照或 SEA | 是否保存随机缓存，以及是否需要重新生成制品 |

建议按下面的顺序执行：

1. 在实际容器、CI、进程启动环境中核对 Node 版本和可执行文件路径，不能只看本地终端。
2. 检查 body-parser、fetch/HTTP 客户端、直接调用 Brotli 的入口，以及各入口处理的数据来源。
3. 升级至相应分支的本次修复版本或后续安全版本，重新构建、部署，并重启全部实例；自包含 Node 或启动快照的制品需要重新生成。
4. 如果使用发行版定制构建或共享 Brotli 库，以供应商安全公告及补丁状态核对覆盖范围，不能只依赖库版本字符串或另一种安装渠道的结论。
5. 回归正常压缩请求、出站 HTTPS、非标准地址拒绝、连接复用及证书错误处理；核对每个存活实例实际运行新版本。

可用于收集环境信息的命令如下；本文没有把它的输出当作修复证明：

```bash
node -p 'JSON.stringify({node: process.version, executable: process.execPath, brotli: process.versions.brotli}, null, 2)'
```

`npm audit fix` 不能替代 Node 运行时升级。临时禁止入站压缩只能减少对应入口；仅发送 `Accept-Encoding: identity` 也不能保证不受控对端不会返回压缩数据。缓解措施必须在进入受影响解码器前生效，并核对所有入口，不能取代升级。

## 常见误区与后续

- 没有直接调用 Brotli，不代表框架没有自动解压。
- 数据使用 HTTPS 传输，不代表对端提供的压缩内容一定可信。
- 启用 CDN 静态 Brotli 压缩，不等于 Node 必然触发解码漏洞。
- 能触达漏洞路径、能让进程崩溃、能稳定执行代码是不同结论，不能互相替代。
- CA 失陷影响信任该链的客户端，并不限于购买该 CA 证书的网站。

后续应按服务清单登记运行时来源、实际版本、外部数据入口、升级负责人及验收结果。本文只完成公告与补丁解读，没有完成生产资产盘点或攻击事件调查。

## 验证依据与公开参考

本文依据公开公告、补丁及官方测试解释机制，没有运行恶意压缩载荷、执行攻击或审计生产资产。示例中的域名与地址仅用于说明规则。有关原生调用的背景，可继续阅读 [Node.js 原生交互全景](./nodejs-native-interop-node-api-ffi.md)。

- [Node.js 2026 年 10 月安全公告](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Brotli 安全发布](https://github.com/google/brotli/releases/tag/v1.2.1)
- [Brotli 非法流错误处理补丁](https://github.com/google/brotli/commit/0ed4268a4401abcb44720963)
- [Node.js 非标准 IP 校验补丁](https://github.com/nodejs/node/commit/935918e342)
- [Node.js 证书公钥黑名单](https://github.com/nodejs/node/pull/66871)
