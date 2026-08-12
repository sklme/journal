---
title: 主流 LLM 的 Prompt Cache 方案与机制对比
date: 2026-08-12
tags:
  - LLM
  - Prompt Cache
  - DeepSeek
  - OpenAI
  - Claude
  - Gemini
description: 对比 DeepSeek、OpenAI、Claude、Gemini 与自托管推理框架的前缀缓存规则、控制方式、生命周期和适用场景。
---

# 主流 LLM 的 Prompt Cache 方案与机制对比

## 要解决的问题

主流 LLM 提供商都在复用重复输入的 Prefill 结果，但产品接口差异很大：有的自动识别相同前缀，有的要求设置缓存断点，有的允许创建有名字和 TTL 的缓存对象，还有的把 KV 存在磁盘或多级存储中。

这篇文章比较的是跨请求 Prompt/Prefix/Context Cache，而不是单次生成必备的 KV Cache，也不是直接返回旧答案的 Semantic Cache。

以下机制截至 `2026-08-12`。模型、价格、TTL 和支持范围变化较快，实施前应再次核对官方文档。

## 共同原理

无论产品名称是什么，服务端缓存的核心通常都是 Prompt 前缀在 Transformer 各层产生的 KV 张量：

```text
第一次请求：[稳定前缀 A] + [动态后缀 B]
                         ↓
                  计算 A、B，并保存 A 的 KV

后续请求：  [稳定前缀 A] + [动态后缀 C]
                         ↓
                  读取 A 的 KV，只计算 C
```

它们普遍具有以下性质：

- 匹配的是从第 0 个 token 开始的前缀，而不是任意中间片段。
- 缓存命中降低输入 Prefill 成本和首 token 延迟。
- 输出仍需重新生成，结果仍可能受采样参数影响。
- 工具定义、图片和结构化输出 Schema 也可能属于前缀。
- 缓存有最小 token 门槛、TTL、淘汰和租户隔离规则。

真正的差异集中在五个维度：谁决定缓存边界、如何路由到缓存、缓存存在哪里、多久失效，以及缓存写入如何收费。

## 总览

| 方案 | 开启方式 | 边界控制 | 典型生命周期 | 主要特点 |
| --- | --- | --- | --- | --- |
| DeepSeek | 默认自动开启 | 服务端自动持久化前缀单元 | 不活跃后通常数小时至数天 | MLA 支撑的分布式磁盘缓存，读取折扣很大 |
| OpenAI | 自动；新模型可显式控制 | `prompt_cache_key` 与显式 breakpoint | 新模型最短 30 分钟；旧模型按策略不同 | 同时提供隐式与显式断点，支持路由键和读写统计 |
| Claude | 请求中启用自动或显式缓存 | `cache_control` 标记 block | 默认 5 分钟，可选 1 小时 | `tools → system → messages` 的层级断点设计 |
| Gemini | Implicit；部分 API 支持 Explicit | 显式创建缓存对象并引用 | 显式缓存默认 1 小时，可更新 TTL | 缓存对象生命周期最直观，但需要额外管理和存储费用 |
| 自托管 | 推理引擎配置 | 由运行时与应用共同控制 | 由显存、内存、磁盘和淘汰策略决定 | 可完全控制数据布局、隔离、路由和多级存储 |

## DeepSeek：自动的磁盘前缀缓存

[DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) 对所有 API 用户默认开启，不要求在请求中声明缓存块。

### 命中和持久化规则

当前文档把可缓存前缀视为独立、完整的 prefix unit。服务端会在以下位置持久化：

- 用户输入结束和模型输出结束等请求边界；
- 多次请求中检测出的公共前缀；
- 长输入或长输出中的固定 token 间隔。

假设第一次请求是 `A+B`，第二次是 `A+B+C`，第二次可以完整复用 `A+B`。如果第二次是 `A+C`，它不能立即命中原有的 `A+B` 单元；服务端检测到公共前缀 `A` 后会单独持久化它，使之后的 `A+D` 可以命中。

响应通过以下字段报告结果：

```json
{
  "usage": {
    "prompt_cache_hit_tokens": 100000,
    "prompt_cache_miss_tokens": 120
  }
}
```

缓存是 best-effort，构建需要一定时间，不活跃的数据通常会在数小时至数天内清理。

### 特点和代价

DeepSeek 的突出点不是“只有它能做 Prefix Cache”，而是把 MLA 压缩后的 KV 与低成本分布式磁盘结合，并把缓存命中价格设置得显著低于普通输入价格。当前价格应以[官方价格页](https://api-docs.deepseek.com/quick_start/pricing/)为准。

代价是开发者几乎没有显式 breakpoint 或缓存对象接口。想提高命中率，主要依赖客户端或 Agent Harness 保持 Prompt 前缀稳定。

## OpenAI：自动缓存、路由键与显式断点

[OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching) 对符合条件的请求自动生效。当前文档区分 GPT-5.6 及之后模型与较早模型的行为。

### GPT-5.6 及之后模型

这类模型支持：

- `prompt_cache_key`：让共享长前缀的请求更稳定地路由到同一缓存。
- `prompt_cache_breakpoint`：显式标记可复用稳定前缀的终点。
- `prompt_cache_options.mode`：选择隐式断点，或只使用开发者声明的显式断点。
- `prompt_cache_options.ttl`：当前值为 `30m`，表示最短可复用时间，服务端可能保留更久。

最小可缓存前缀是 1,024 token。一次请求最多创建四个新缓存写入点，读取时会在可用断点中选择最长匹配前缀。

显式模式适合“稳定长文档 + 每轮动态问题”：把 breakpoint 放在文档末尾，后面的用户问题变化不会破坏前面的缓存。新模型通过 `cache_write_tokens` 和 `cached_tokens` 分别报告写入与读取；写入按未缓存输入价格的 1.25 倍收费。

### 较早模型

较早模型主要依赖自动最长前缀匹配，可使用 `prompt_cache_retention` 选择支持的保留策略。内存缓存一般在停止使用 5 至 10 分钟后失效，最长约一小时；部分模型支持最长 24 小时的扩展保留。

### 特点和代价

OpenAI 的方案兼顾默认可用性和显式控制，也暴露路由键来提高大规模服务中的命中稳定性。相应地，调用方需要理解模型代际差异、写缓存费用、每个 key 的流量分片和断点数量限制。

## Claude：基于内容块的 Cache Control

[Claude Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) 支持两种模式：

- 在请求顶层添加 `cache_control`，自动把最后一个可缓存 block 作为断点。
- 在具体内容 block 上添加 `cache_control`，显式声明一个或多个断点。

Claude 按以下顺序构造完整前缀：

```text
tools → system → messages
```

这是一种层级关系。修改工具定义会让其后的 system 和 messages 缓存一起失效；修改 system 至少会让 system 和 messages 失效。

默认缓存类型是 `ephemeral`，TTL 为 5 分钟；也可以设置 1 小时 TTL。5 分钟写入通常按基础输入价的 1.25 倍计费，1 小时写入为 2 倍，读取为基础输入价的 0.1 倍。命中后，5 分钟缓存会被免费刷新。

Claude 对 Agent 工具有较细的规则：可把 breakpoint 放在最后一个工具定义上；Tool Search 动态发现的工具以引用形式追加到消息历史，不改写前面的工具定义；启用服务端工具后，Agent 循环中的服务端工具结果还可以自动形成缓存断点。

这种方案适合工具和系统提示词很大、不同部分更新频率不同的 Agent，但需要精确管理 block 顺序、最多四个断点和不同 TTL 的排列约束。

## Gemini：Implicit Cache 与显式缓存对象

[Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching) 为 Gemini 2.5 及之后模型默认提供 Implicit Caching。调用方无需创建对象，但仍应把重复内容放在 Prompt 开头，并在较短时间内发送相似前缀。不同模型的最小输入门槛不同，当前常见值在 2,048 至 4,096 token 之间。

在旧版 `generateContent` API 中，Gemini 还提供 Explicit Caching：

1. 先上传或提交长内容并创建缓存资源。
2. 指定模型和 TTL，默认 TTL 为 1 小时。
3. 后续请求通过 `cached_content` 引用这个资源。
4. 可以查询、延长 TTL 或删除缓存对象。

显式缓存对象提供明确的生命周期和成本保证，适合对固定视频、音频、长文档或大规模知识背景反复提问。它需要额外的资源管理，而且除了缓存 token 的读取费用，还要考虑缓存存储时间费用。

需要注意 API 差异：当前 Interactions API 只支持 Implicit Caching，不支持手工创建缓存对象。

## 自托管：从自动前缀到多级 KV 存储

自托管模型没有统一的商业 API 行为，缓存能力来自推理框架：

- [vLLM](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) 使用 KV block 哈希实现 Automatic Prefix Caching；PagedAttention 降低动态 KV 分配的碎片。
- [SGLang](https://www.lmsys.org/blog/2024-01-17-sglang/) 使用 RadixAttention，把多请求共享前缀组织为 Radix Tree，并结合 LRU 淘汰。
- [LMCache](https://docs.lmcache.ai/) 把 KV 管理扩展到 CPU、SSD、远程后端和跨实例共享，并支持 Prefill/Decode 分离。

自托管的优点是可以控制容量、淘汰、租户隔离和数据驻留；代价是要自行处理缓存感知路由、跨节点传输、版本兼容、可观测性和存储带宽。

## 差异的本质

### 自动识别还是显式声明

- DeepSeek 和 Gemini Implicit 更偏“自动发现重复前缀”。
- Claude 更偏“调用方标记内容块”。
- OpenAI 新模型同时支持隐式和显式断点。
- Gemini Explicit 把缓存变成可管理资源。

自动方式接入简单，但命中原因更难控制；显式方式工程成本更高，却能稳定表达不同内容的生命周期。

### 内存、磁盘还是缓存对象

- DeepSeek 明确使用分布式磁盘保存压缩 KV。
- OpenAI 较早模型区分内存和扩展保留，新模型由统一 TTL 规则管理断点。
- Claude 文档描述的是 TTL 内保存在内存中的 KV 表示及哈希。
- Gemini 通过显式缓存资源提供可管理的存储生命周期。
- 自托管方案可以组合 GPU、CPU、SSD 和远程存储。

存储越慢、容量越大，缓存调入开销通常越高。是否值得使用磁盘，取决于重新 Prefill 的计算成本和 KV 压缩程度。

### 免费写入还是写入溢价

缓存并不天然省钱。需要考虑：

```text
净收益 = 避免的重复 Prefill 成本
       - 缓存写入成本
       - 缓存存储成本
       - 调入与管理开销
```

DeepSeek 把写入和存储隐藏在自动服务中，按实际命中计费；OpenAI 新模型和 Claude 对写入收取溢价；Gemini Explicit 还需要考虑 TTL 对应的存储费用。复用次数少的内容可能不适合显式缓存。

## 如何选择

### 普通多轮 API 对话

优先使用提供商的自动缓存，稳定 system prompt 和消息序列即可。此时不必为了缓存引入额外基础设施。

### 固定长文档被反复询问

- 希望自动处理：DeepSeek 或支持隐式缓存的模型。
- 希望明确控制边界：OpenAI 显式 breakpoint 或 Claude block breakpoint。
- 希望管理缓存对象和 TTL：Gemini Explicit。

### 长期运行的 Coding Agent

提供商能力只解决服务端存储，Harness 还必须保证工具 Schema、系统提示词和历史序列化稳定。选择时应同时评估缓存读取折扣、工具调用质量、上下文窗口、输出成本和 Harness 的 Prefix Churn。

### 私有化和多租户推理

使用 vLLM 或 SGLang 作为运行时，并在需要跨实例或多级存储时引入 LMCache。缓存键必须包含模型、Tokenizer、适配器、模态输入和租户隔离信息。

## 评测建议

不要只用一轮“热缓存”请求比较提供商。至少测量：

1. 冷启动和连续热请求。
2. 请求间隔小于和大于 TTL。
3. 同前缀高并发时的缓存可见时机。
4. system、tools、历史和动态后缀分别变化时的失效范围。
5. 缓存读取、写入、未命中和输出 token 的真实账单。
6. TTFT、总延迟、吞吐量和答案质量。

提供商的 token 计费口径可能不同，比较时应使用同一任务集、相同上下文结构和足够长的观测周期。

## 常见误区

1. **把所有“自动缓存”视为相同行为**：持久化位置、最小长度和最长匹配规则并不相同。
2. **忽略 API 与模型代际差异**：同一提供商的新旧模型可能使用完全不同的断点和 TTL 参数。
3. **认为磁盘缓存一定更慢**：应比较从磁盘读取压缩 KV 与重新执行长 Prompt Prefill 的成本。
4. **认为显式缓存一定更省钱**：写入溢价和存储费需要足够多的读取才能摊平。
5. **只看官方折扣，不看 Harness 命中率**：前缀每轮变化时，再低的缓存单价也没有意义。

## 公开参考

- [DeepSeek：Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)
- [DeepSeek：Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [OpenAI：Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)
- [Anthropic：Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Anthropic：Tool Use with Prompt Caching](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-use-with-prompt-caching)
- [Google：Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching)
- [Google：Gemini Generate Content Context Caching](https://ai.google.dev/gemini-api/docs/generate-content/caching)
- [vLLM：Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)
- [SGLang：RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/)
- [LMCache Documentation](https://docs.lmcache.ai/)
