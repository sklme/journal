---
title: DeepSeek Agent Harness 与前缀缓存优化
date: 2026-08-12
tags:
  - DeepSeek
  - Agent Harness
  - Prefix Cache
  - Pi
  - Reasonix
description: 解释 Agent Harness 如何影响 DeepSeek 前缀缓存，并拆解 Pi、Reasonix、DeepPi 与 pi-deepseek-cache 的具体方案。
---

# DeepSeek Agent Harness 与前缀缓存优化

## 要解决的问题

在 Coding Agent 中，模型通常要经历“思考、调用工具、读取结果、继续思考”的循环。每执行一步，Harness 都会把系统提示词、工具定义、历史消息和本轮输入重新发送给模型。

这使 Agent 同时具有两个特征：

- 输入上下文会快速增长，未缓存时非常昂贵；
- 每一轮都继承上一轮的绝大部分前缀，天然适合 Prefix Cache。

InfoQ 文章[《DeepSeek + Pi 王炸组合跑赢 Claude Code？》](https://mp.weixin.qq.com/s/Nmfg5eF6rC7HY3e-zT3CFg)讨论的核心，正是 Harness 如何把这种天然重复转化为接近 100% 的 token 缓存命中率。

文章报告了两个值得区分的数据：

- 一位开发者使用 Pi 调用 DeepSeek V4 Flash，处理接近 10 亿输入 token，报告命中率 99.93%，总费用 2.65 美元；文章估算完全不命中约需 132 美元。
- Composio 在 30 个 Agent 任务上的评测中，Pi 完成 20 个；文章报告 Pi 成功任务平均费用为 0.028 美元，Claude Code 为 0.195 美元。

这些是文章引用的个案和特定评测结果，不是服务等级保证。费用差异还受到模型、上下文长度、工具路径、重试次数和任务成功率影响，不能全部归因于缓存。

## DeepSeek 提供什么，Harness 又提供什么

### DeepSeek：保存并复用前缀 KV

[DeepSeek Context Caching](https://api-docs.deepseek.com/guides/kv_cache/) 默认开启。请求完成后，服务端把部分输入前缀产生的 KV 持久化到磁盘；后续请求若完整匹配这些前缀单元，就可以直接读取 KV，跳过重复 Prefill。

DeepSeek 负责：

- 计算和保存 KV；
- 识别可复用的 token 前缀；
- 在请求边界、公共前缀和固定 token 间隔持久化；
- 返回 `prompt_cache_hit_tokens` 和 `prompt_cache_miss_tokens`；
- 对缓存命中 token 使用较低输入价格。

缓存是 best-effort，而且只处理输入。输出仍需重新生成。

### Harness：决定最终 Prompt 长什么样

Agent Harness 是包裹模型的执行框架。它负责：

- 拼接 system prompt；
- 加载并序列化工具 Schema；
- 保存和裁剪消息历史；
- 执行工具并写入工具结果；
- 注入工作目录、日期、环境和项目说明；
- 压缩超长上下文；
- 选择模型并发起下一轮请求。

因此最终缓存命中率由两层共同决定：

```text
DeepSeek 服务端：有没有能力保存并读取 KV
                  ×
Agent Harness：下一轮是否真的发送相同 token 前缀
```

DeepSeek 可以提供极低的缓存读取价格，但如果 Harness 每轮都改写开头，缓存仍然无法命中。

## 为什么 Agent 前缀容易失效

典型 Agent 请求可以抽象成：

```text
[系统提示词]
[工具定义]
[环境与项目说明]
[历史 user/assistant/tool 消息]
[本轮动态输入]
```

以下行为会造成 Prefix Churn：

- 在 system prompt 中写入当前日期、时间或随机 ID；
- 每轮重新扫描并以不稳定顺序输出工具；
- 工具 JSON Schema 的字段顺序变化；
- 在开头更新当前工作目录、Git 状态或任务进度；
- 删除或改写历史中间位置的工具结果；
- 每轮重新生成不同措辞的对话摘要；
- 规划模型和执行模型的消息交错进入同一会话；
- 切换模型、Tokenizer、Thinking 配置或多模态参数。

一个很小的前部变化，会让其后数万 token 都无法继续作为同一前缀匹配。这解释了为什么缓存优化不是简单地“打开一个开关”。

## Pi：提供可编程的轻量 Harness

[Pi](https://pi.dev/) 把自己定位为 minimal agent harness。它并不实现 DeepSeek 的服务端缓存，而是提供足够开放的上下文工程接口：

- 可以替换或追加 system prompt；
- 可以通过扩展控制进入上下文的消息；
- 可以自定义上下文压缩策略；
- 可以动态管理工具和 Skills；
- 可以在发送模型前检查或重写最终载荷；
- 可以控制不同模型和 Provider。

Pi 的默认系统提示词较小，内置工作流也相对克制。对于偏速度和成本的模型，这会减少工具选择、额外说明和无效步骤产生的上下文噪声。

Pi 的缓存优势更准确的表述是：它为“稳定前缀、追加历史、动态后缀”提供了较好的改造基础。具体命中率仍取决于安装的扩展、Skills、工具数量和会话管理方式。

## Reasonix：把缓存稳定性作为循环不变量

[Reasonix](https://github.com/esengine/deepseek-reasonix) 是直接围绕 DeepSeek API 设计的终端 Coding Agent。其公开架构把上下文分成三个区域：

```text
IMMUTABLE PREFIX
system + tool specs + few-shot
会话开始后固定，并记录哈希

APPEND-ONLY LOG
user、assistant、tool 消息只按顺序追加

VOLATILE SCRATCH
临时思考和计划不直接进入稳定上游上下文
```

### 具体解决办法

1. **固定前缀**：系统提示词、工具 Schema 和示例在会话启动时计算一次，之后不重排、不重写。
2. **历史只追加**：工具调用和结果按声明顺序写入，即使工具并行执行，也维持确定的历史顺序。
3. **隔离临时状态**：短期计划、推理草稿和瞬时状态不注入前部稳定区。
4. **压缩大工具结果**：工具结果在当轮被模型完整读取后，后续轮次可以看到压缩版本，必要时重新读取源文件。压缩会成为一次明确的缓存重建点，但减少之后每轮携带的 token。
5. **命中率可见**：按轮次和会话统计 `hit / (hit + miss)`，同时显示实际成本。
6. **模型分层**：普通步骤优先使用更便宜的 Flash 模型，复杂步骤再升级；辅助摘要和修复不必使用最贵模型。

Reasonix 的关键价值不是一条神奇指令，而是让上下文数据结构围绕缓存约束设计。它也有明显边界：高度针对 DeepSeek 的缓存经济性和工具调用特性，不是通用 Provider 抽象。

## DeepPi：把 Reasonix 风格移植到 Pi

[DeepPi](https://github.com/christopherarter/deep-pi) 是 Pi 的第三方扩展，只在直连受支持的 DeepSeek 模型时启用。它试图保留 Pi 的可扩展性，同时加入 DeepSeek 专用优化。

当前公开说明列出的能力包括：

- 稳定可缓存的请求前缀；
- 从 Pi 实际 usage 数据统计缓存读取、未缓存输入和费用；
- 诊断本地 Prefix Churn；
- 对重复失败和批量重试设置循环保护；
- 用哈希验证编辑目标，减少错误修改造成的付费重试；
- 对其他 Provider 和模型保持休眠，避免改变无关会话行为。

原文引用社区使用者的 `99.7%–99.9%` 命中率。DeepPi 当前 README 已明确说明不保证固定命中率：即使本地前缀完全稳定，Provider 的过期、淘汰和后端状态仍可能产生 miss。

## pi-deepseek-cache：观测、前缀保护与确定性压缩

[pi-deepseek-cache](https://pi.dev/packages/pi-deepseek-cache) 也是 Pi 的 DeepSeek 前缀缓存扩展，方案可以分成三层：

### P1：命中率观测

从 Pi 的消息结束事件中累计缓存读取、输入、写入和轮次数，持久化统计数据，并提供 `/cache-stats` 和 `/cache-graph` 查看会话趋势。

### P2：Prefix Guard

在 Context Hook 中过滤标记为 `volatile-scratch` 的消息，避免临时内容进入上游 Prompt 并改变字节前缀。

### P3：Cache-friendly Compaction

在会话压缩前使用低随机性的 DeepSeek 模型生成摘要，并以 SHA-256 对历史输入建立摘要缓存。相同历史可以直接复用字节一致的摘要，减少“信息相同但措辞变化”造成的缓存失效。

原文还讨论了两个通用做法：启动会话时冻结日期和工作目录等动态字段；为最终前缀计算 SHA-256，定位究竟是哪一段发生变化。即使具体扩展版本调整了功能分层，这两个做法仍然适用于任何需要精确前缀匹配的 Harness。

## Composio：评测工具，不是缓存实现

Composio 在原文中承担的是 Agent Benchmark 角色：让多个 Harness 使用同一模型完成需要工具调用的任务，并比较成功率、成本和耗时。

它不能提高 DeepSeek 缓存命中率。它帮助回答的是另一个问题：同一个模型放进不同 Harness，实际完成任务的路径是否更短、更稳定、更便宜。

文章还列出了 Oh My Pi、Prime Agent、Claude Code、Codex、Deep Agents、Hermes Agent 和 OpenCode 等参测 Harness。这些名称在该段落中属于对照组，不应被误认为 DeepSeek 缓存插件。一次评测排名也不能直接证明某个 Harness 的通用能力，因为安装配置、工具集合、超时规则和失败计分都会影响结果。

## 一套可落地的 DeepSeek 优化顺序

### 第一步：先做观测

记录每轮：

```text
hit_tokens
miss_tokens
hit_rate = hit / (hit + miss)
input_cost
output_cost
time_to_first_token
```

再对最终序列化后的 Prompt 分区计算哈希：system、tools、environment 和 history。只有知道哪一段变化，才能针对性修复。

### 第二步：固定会话级前缀

- system prompt 在会话启动时生成一次。
- 工具 Schema 使用固定排序和规范化 JSON 序列化。
- 项目说明使用有版本的稳定快照。
- 日期、时间、Git 状态和实时指标移到动态后缀。
- 避免在每轮开头重复输出当前工作目录。

### 第三步：让历史 Append-only

新消息只追加到历史末尾。并行工具可以并行执行，但写回历史的顺序必须确定。不要因为 UI 展示、日志清理或内部状态更新而改写已经发送过的消息。

### 第四步：把压缩设计成显式边界

上下文不能无限增长。推荐在达到阈值时：

1. 删除或截断已经失去价值的巨大工具输出。
2. 使用低随机性设置生成结构化摘要。
3. 对输入历史和摘要结果建立内容哈希。
4. 把压缩后的会话视为一个新的缓存 epoch。
5. 在下一个 epoch 内继续保持 Append-only。

这样会接受一次明确的 miss，换取后续更短、更稳定的请求。

### 第五步：隔离不同角色和模型

Planner、Executor、Reviewer 如果拥有不同 system prompt 和工具，应使用独立会话。子 Agent 也应拥有自己的稳定前缀，而不是把多个角色的动态提示轮流插到同一上下文开头。

### 第六步：优化任务成本，而非只追逐命中率

一个 99.9% 命中的 Agent 如果频繁走错路径、重复调用工具或输出极长，仍可能比 95% 命中但一次完成任务的 Agent 更贵。最终应同时观察：

- 任务成功率；
- 完成任务的总输入和输出 token；
- 工具调用次数和失败重试；
- 缓存读写费用；
- 端到端耗时。

## 最小结构示例

下面是一个缓存友好的逻辑结构，不绑定具体 SDK：

```ts
type Session = {
  stablePrefix: Message[]
  appendOnlyHistory: Message[]
}

function buildRequest(session: Session, currentInput: Message) {
  return {
    model: 'deepseek-model',
    messages: [
      ...session.stablePrefix,
      ...session.appendOnlyHistory,
      currentInput
    ]
  }
}
```

`stablePrefix` 在会话启动后冻结；工具执行结果只追加到 `appendOnlyHistory`；当前时间等瞬时信息只属于 `currentInput`。真正实现时还应固定工具排序、序列化方式和模型参数。

## 适用边界与风险

- DeepSeek 的缓存是 best-effort，不应把 100% 命中作为正确性前提。
- Prefix Cache 不等于长期记忆，过期后仍需重新 Prefill。
- 确定性摘要只能减少无意变化，不能保证摘要完整保留关键事实。
- 压缩旧工具输出会降低上下文成本，也可能丢失以后需要的证据；必须支持按需重读。
- 第三方 Pi 扩展可以执行代码并改变 Agent 行为，安装前应审查源码、依赖和权限。
- 文章中的价格和模型名称会变化，实施时应核对 [DeepSeek 官方价格](https://api-docs.deepseek.com/quick_start/pricing/)。

## 常见误区

1. **认为 Pi 缓存了模型结果**：缓存实际由 DeepSeek 服务端完成，Pi 负责让请求形状稳定。
2. **把 99.93% 理解成 99.93% 请求零计算**：这是输入 token 命中率，新增后缀和输出仍需计算。
3. **把 Benchmark 全部归因于缓存**：Harness 的工具选择、上下文噪声和错误恢复同样重要。
4. **为了命中率永不压缩历史**：无限增长会增加存储、调入和模型注意力负担。
5. **每轮生成一份新摘要**：摘要措辞变化会反复重写前缀，可能比不摘要更糟。

## 公开参考

- [InfoQ：DeepSeek + Pi 王炸组合跑赢 Claude Code？](https://mp.weixin.qq.com/s/Nmfg5eF6rC7HY3e-zT3CFg)
- [DeepSeek：Context Caching](https://api-docs.deepseek.com/guides/kv_cache/)
- [DeepSeek：Context Caching on Disk](https://api-docs.deepseek.com/news/news0802/)
- [DeepSeek：Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing/)
- [Pi Coding Agent](https://pi.dev/)
- [Reasonix Architecture](https://github.com/esengine/deepseek-reasonix/blob/v1/docs/ARCHITECTURE.md)
- [DeepPi](https://github.com/christopherarter/deep-pi)
- [pi-deepseek-cache](https://pi.dev/packages/pi-deepseek-cache)
