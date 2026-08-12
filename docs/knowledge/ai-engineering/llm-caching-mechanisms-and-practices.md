---
title: LLM 缓存机制：原理、流派与工程实践
date: 2026-08-12
tags:
  - LLM
  - KV Cache
  - 推理优化
  - Prompt Cache
description: 从注意力中的 Q、K、V 出发，系统梳理单次生成、跨请求、推理服务和应用层缓存的原理、边界与实践。
---

# LLM 缓存机制：原理、流派与工程实践

## 要解决的问题

LLM 应用里经常同时出现 KV Cache、Prompt Cache、Prefix Cache、Semantic Cache 和 RAG Cache。这些名字都带有“缓存”，但缓存的对象和命中规则完全不同：有的保存 Transformer 的中间张量，有的直接保存最终答案；有的只服务一次生成，有的可以跨请求甚至跨推理实例复用。

理解 LLM 缓存，首先要把推理过程拆成两个阶段：

- **Prefill**：读取全部输入 token，并计算每一层的注意力中间结果。
- **Decode**：每次生成一个新 token，再把它加入上下文，继续生成下一个 token。

缓存优化的核心目标，是避免重复执行已经做过的 Prefill 计算，同时控制 KV 张量带来的显存和存储成本。

## 从 Q、K、V 理解 KV Cache

### Q、K、V 到底是什么

对某一层 Transformer 而言，每个 token 都有一个隐藏状态向量 `h`。模型通过三个训练得到的矩阵，把它投影成 Query、Key 和 Value：

```text
Q = h × Wq
K = h × Wk
V = h × Wv
```

它们不是文本标签，而是由浮点数组成的向量。可以用一个不严格但直观的比喻理解：

- **Query**：当前 token 想查找什么信息。
- **Key**：历史 token 可以通过什么特征被找到。
- **Value**：找到这个历史 token 后，实际取回什么信息。

假设模型正在处理“用户提交了订单”，为了展示计算，暂时把向量缩短为三个数字：

| token | Key | Value |
| --- | --- | --- |
| 用户 | `[0.9, 0.1, 0.2]` | `[0.7, 0.2, 0.1]` |
| 提交 | `[0.2, 0.9, 0.3]` | `[0.1, 0.8, 0.3]` |
| 订单 | `[0.1, 0.4, 0.9]` | `[0.2, 0.3, 0.9]` |

当前生成位置产生一个 Query。它与历史 Key 做点积并经过缩放和 Softmax，得到注意力权重：

```text
score(Q, Ki) = Q · Ki / sqrt(d)
attention = softmax(score)
context = Σ attention_i × Vi
```

如果权重是“用户 10%、提交 25%、订单 65%”，模型就按这个比例混合三个 Value。后续网络再使用这个上下文向量预测下一个 token。

真实模型会在每一层、每个注意力头上执行这套过程。向量通常有数十到数百个维度，而且每一维没有稳定的人类语言含义。

### 为什么只缓存 K 和 V

自回归生成具有因果性：后面的 token 可以关注前面的 token，但前面的 token 不会因为后面新增了内容而改变。因此，历史 token 在每一层算出的 K 和 V 可以直接复用。

例如模型依次生成：

```text
用户 提交 了 订单
```

生成“订单”时，前面“用户、提交、了”的 K/V 已经计算过。模型只需计算新 token 的 Q/K/V，并让新 Query 查询缓存中的历史 Key，再读取相应 Value。随后把“订单”的 K/V 追加到缓存。

KV Cache 保存的是：

```text
每一层 × 每个 KV 头 × 每个历史 token × K/V 向量
```

它通常不保存：

- 原始文本本身；
- 历史 Query；
- 最终答案；
- 可以直接复用的随机采样结果。

因此 KV Cache 会加速计算，但不会要求模型下次产生相同答案。

## 第一类：单次生成内的 KV Cache

没有 KV Cache 时，生成第 `t` 个 token 需要反复计算前面 `t-1` 个 token。使用 KV Cache 后，历史 K/V 直接复用，每一步只处理新增 token。

这是现代自回归 LLM 推理的基础能力，主要改善 Decode 阶段。不过它也带来显著的显存开销。粗略估算公式是：

```text
KV 大小 ≈ 2 × 层数 × token 数 × KV 头数 × head_dim × 每元素字节数
```

其中 `2` 代表 K 和 V。假设某模型有 32 层、32 个 KV 头、`head_dim=128`、上下文为 32K token，并使用 FP16，那么单条序列的 KV 约占 16 GiB。实际占用还会受到批量大小、张量布局、对齐和模型架构影响。

围绕“如何降低 KV 占用”，形成了几条技术路线：

- **MQA（Multi-Query Attention）**：所有 Query 头共享一组 K/V。
- **GQA（Grouped-Query Attention）**：若干 Query 头共享一组 K/V，在质量和内存之间折中。
- **MLA（Multi-head Latent Attention）**：把 K/V 信息压缩到潜在表示，需要使用时再恢复相关表示。
- **KV 量化**：用 FP8、INT8 等较低精度保存缓存。
- **窗口与淘汰**：只保留局部窗口，或删除被判断为不重要的历史 token。
- **KV Offload**：把暂时不用的 KV 从 GPU 转移到 CPU 或更慢的存储。

这些方案改变的是模型架构或推理运行时，不等同于应用侧的 Prompt Cache。

## 第二类：跨请求的 Prefix Cache

### 原理

多轮对话和 Agent 通常会在每次请求中重新发送完整上下文：

```text
请求 1：系统提示词 + 工具定义 + 用户问题
请求 2：请求 1 + 模型工具调用 + 工具结果
请求 3：请求 2 + 下一步操作
```

如果请求 2 的开头与请求 1 完全相同，服务端可以复用请求 1 在 Prefill 阶段产生的 KV，只计算新增后缀。这通常被称为 Prefix Cache、Prompt Cache 或 Context Cache。

多数实现要求从第 0 个 token 开始精确匹配：

```text
[完全相同的前缀] + [本轮动态后缀]
```

“语义相同”并不足够。工具顺序、空格、JSON 字段顺序、图片参数、系统提示词或时间戳改变，都可能让 token 序列不同。

### 如何理解 99.9% 命中率

Prefix Cache 的命中率通常按输入 token 计算，而不是按请求数计算：

```text
命中率 = cached_input_tokens / total_input_tokens
```

如果一轮请求复用了 100,000 个历史 token，只新增 100 个 token，那么 token 命中率约为 99.9%。这不表示请求完全没有计算：动态后缀仍要 Prefill，输出 token 也仍需 Decode。

所以 Prefix Cache 主要改善：

- 输入 token 费用；
- 首 token 延迟（TTFT）；
- Prefill 吞吐量。

当任务的主要耗时来自很长的输出时，收益会明显下降。

## 第三类：推理服务的缓存管理

Prefix Cache 需要运行时解决 KV 的分配、匹配、淘汰和跨设备传输。常见实现思路包括：

### 分页与块哈希

[vLLM](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) 用 PagedAttention 管理非连续的 KV 块，并通过父块哈希、当前块 token 和额外隔离信息识别可复用前缀。它只缓存完整块，适合多轮对话和对同一长文档反复提问。

### Radix Tree

[SGLang RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/) 使用 Radix Tree 组织共享 token 前缀。多条请求路径可以共享树的上半部分，再从分叉点拥有独立 KV，适合 Agent、Few-shot、Tree-of-Thought 和并行采样。

### 分层持久化

[LMCache](https://docs.lmcache.ai/) 把 KV 从单个推理进程中解耦出来，可在 GPU、CPU、本地磁盘和远程存储之间分层保存，并跨请求、会话和推理实例复用。它还支持 Prefill/Decode 分离时的 KV 传输。

这三类方案不是互斥关系：生产系统可以同时采用分页分配、前缀索引和多级存储。

## 第四类：应用层缓存

应用层缓存不一定保存 KV，也不一定执行模型：

| 类型 | 缓存对象 | 命中条件 | 主要风险 |
| --- | --- | --- | --- |
| Exact Response Cache | 最终响应 | 请求规范化后完全相同 | 数据过期、权限范围错误 |
| Semantic Cache | 最终响应或中间结果 | 向量语义相似度超过阈值 | 相似问题不一定有相同答案 |
| RAG Cache | Embedding、检索结果、文档切片 | 文档版本和查询键匹配 | 语料更新后缓存未失效 |
| Tool Cache | 搜索、数据库、编译等工具结果 | 工具参数和环境版本匹配 | 外部状态变化、隐藏副作用 |

其中 Semantic Cache 与 Prefix Cache 的区别尤其重要：Prefix Cache 要求 token 前缀精确相同，但仍重新生成答案；Semantic Cache 可以接受不同措辞，却可能直接返回旧答案。

## 工程实践

### 1. 稳定内容在前，动态内容在后

推荐的请求结构是：

```text
固定系统提示词
固定且顺序稳定的工具定义
固定示例或长文档
只追加的对话历史
本轮用户输入、时间和临时状态
```

不要把当前时间、随机 ID、实时状态放进系统提示词开头。无法冻结的动态信息应尽量靠近末尾。

### 2. 保证序列化确定性

- 固定工具和 JSON 字段顺序。
- 固定换行、模板版本和图片参数。
- 不要每轮扫描文件系统后重新生成顺序不稳定的工具列表。
- 对最终发送载荷的稳定前缀计算哈希，用于定位无意变化。

### 3. 历史尽量只追加

多轮 Agent 应优先追加消息。删除中间消息、改写旧工具结果或重新总结历史，都会改变后续前缀。确实需要压缩时，应把它当成一次明确的“缓存重建点”，而不是每轮重写。

### 4. 分开不同生命周期的内容

长期不变的规则、会话内不变的环境、不断增长的历史和每轮变化的临时状态，应该分区管理。规划模型和执行模型若有不同 system prompt、工具或序列化格式，也应使用独立会话。

### 5. 同时观察读、写和失效

至少记录：

- 缓存读取 token；
- 未命中 token；
- 缓存写入 token及其费用；
- token 加权命中率；
- TTFT 的 P50、P95；
- 淘汰率和缓存占用；
- 发生 Prefix Churn 的字段。

只看命中率可能产生误判。例如频繁写入巨大缓存、只读取一次，即使命中率很高，也未必比直接计算更便宜。

### 6. 做好租户和版本隔离

共享前缀可能产生时间侧信道和错误复用风险。自托管系统应在缓存键中加入租户、模型、Tokenizer、LoRA、工具版本和必要的 cache salt。应用级缓存还必须包含权限范围和数据版本。

## 适用边界

缓存收益最大的工作负载通常具有“长而稳定的输入、短而频繁的增量”：长文档问答、多轮 Agent、代码仓库分析和大量 Few-shot 示例。

以下场景收益较小：

- 输入很短，达不到服务端缓存阈值；
- 每次请求开头都不同；
- 输出远长于输入，主要成本在 Decode；
- 请求间隔超过 TTL；
- 高并发请求同时冷启动，首个缓存尚未完成写入；
- 模型、Tokenizer、工具 Schema 或多模态输入频繁变化。

## 常见错误

1. **把 KV Cache 当成聊天记忆**：KV 是中间张量，不是可以检索和编辑的长期知识库。
2. **认为意思相近就能命中 Prefix Cache**：多数实现要求精确 token 前缀。
3. **把 Prompt Cache 当成答案缓存**：缓存命中后，模型仍会生成新输出。
4. **只优化命中率，不计算写入和存储成本**：缓存必须有足够复用次数才值得。
5. **压缩历史时忽略前缀重写**：摘要能减少后续 token，但会在生成摘要的边界触发一次缓存失效。
6. **跨用户共享缓存键**：任何性能收益都不能替代正确的租户和权限隔离。

## 公开参考

- [vLLM：Automatic Prefix Caching](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/)
- [vLLM：Prefix Caching Design](https://docs.vllm.ai/en/latest/design/prefix_caching/)
- [SGLang：RadixAttention](https://www.lmsys.org/blog/2024-01-17-sglang/)
- [LMCache Documentation](https://docs.lmcache.ai/)
- [DeepSeek：Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)
