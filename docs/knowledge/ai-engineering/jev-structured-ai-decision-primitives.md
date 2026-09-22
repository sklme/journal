---
title: Jev：把 AI 判断拆成可组合的结构化决策原语
date: 2026-09-22
tags:
  - AI 模型
  - Agent
  - 结构化输出
  - 决策工作流
description: 理解 TypeSafe AI Jev 如何用 Choice、Score、Noul 和置信度把自然语言判断接入软件，以及 token、可观测性和迭代边界。
---

# Jev：把 AI 判断拆成可组合的结构化决策原语

## 要解决的问题

普通 LLM 的接口是“输入状态，生成一段文字”。当软件只需要一个部门、一个等级、一个风险标记或一条流程分支时，使用文字模型会引入额外工作：解析输出、校验 Schema、处理格式漂移、重试失败调用，并承担模型生成多余文字的延迟和成本。

Jev 是 TypeSafe AI 的第一个 System One 模型，目标是把这类模糊判断直接接入程序。它不面向聊天或写作，而是让程序提交状态和类型化问题，再拿到代码可以直接消费的结构化答案。

## 核心原理

### 从状态和问题得到类型化答案

Jev 提供三种基本问题类型：

| 类型 | 要回答的问题 | 典型结果 |
| --- | --- | --- |
| `Choice` | 从预先声明的选项中选哪一个？ | 部门、意图、工具或模型路由 |
| `Score` | 状态处于评分标准的哪一档？ | 严重程度、风险、情绪或优先级 |
| `Noul` | 某个命题为真的概率是多少？ | 是否紧急、是否包含敏感信息、是否需要人工审核 |

同一请求可以包含多个问题。每个问题针对同一份状态独立判断，结果包含选项概率、分数或真假概率；`Choice` 和 `Score` 还会返回 `confidence`。程序再把这些结果交给阈值、规则、状态机或其他模型。

这和把复杂问题拆成二元逻辑有相似之处，但不能把 Jev 简化为二进制计算。二进制运算通常是确定性的，Jev 的小单元仍然要理解文本和业务语义，并输出概率；`Choice` 可以有多个候选，`Score` 是有序等级，`Noul` 只是其中一种原语。更准确的类比是：Jev 提供面向语义判断的、带不确定性的类型化谓词，代码负责组合它们。

### 复杂度从生成过程转移到工作流

Jev 并不是“不分析”。它仍然需要读取输入状态并完成语义判断，只是把内部计算封装起来，不返回自然语言理由或思维过程。节省主要来自输出空间和调用形态：答案的结构预先固定，不必逐 token 生成一段解释、猜测字段名或反复修复格式；多个窄问题也可以在一次调用中并行评估。

因此，输入 token 并不会消失。传入很长的状态仍然要被读取，token 计费和模型内部计算也不是同一件事。TypeSafe 公布的低延迟、低价格和并行采样数据是其自有任务和环境下的厂商结果，不应直接外推到所有任务。

### 置信度提供控制信号，不提供理由

概率分布集中在一个选项上时，答案更确定；分布平坦时，说明候选之间难以区分、输入不足或问题定义不清。可以按风险设置不同阈值：低风险的只读动作允许较低阈值，高风险或不可逆动作要求更高阈值，低于阈值则转人工、补充信息或调用其他模型。

置信度是总体统计意义上的不确定性信号，不是单条判断的正确性证明，也不是解释。它回答“模型有多确定”，不回答“模型依据了哪一句话”。`Noul` 返回真假概率，但没有单独的 `confidence` 字段。

### 用原子问题定位 bad case

不要让一个问题同时承担事实抽取、政策理解、风险判断和最终动作。例如退款流程可以拆成：

```text
refund_requested     = 用户是否明确要求退款？
duplicate_charge     = 订单是否存在重复扣款？
policy_allows_refund = 当前政策是否允许该类退款？
```

最后由代码组合：

```text
if refund_requested and duplicate_charge and policy_allows_refund:
    route_to_refund_review()
```

出现 bad case 时，记录原始状态、问题定义、候选标准、模型版本、完整概率分布、置信度、最终代码分支和真实结果。这样可以区分几类问题：输入状态缺字段、问题定义含糊、候选项互相重叠、模型判断错误、阈值过低，或代码组合规则错误。

迭代时应建立自己的标注集，按置信度区间检查真实准确率，查看混淆选项，并针对失败类型修改问题定义、状态组织、候选项和阈值。高风险动作不要因为一次高置信度结果就自动执行。

## 最小示例

```json
{
  "state": {
    "message": "我被重复扣款了，请退还其中一笔。",
    "order": { "charge_count": 2 },
    "policy": "重复扣款可以退款。"
  },
  "questions": {
    "refund_requested": {
      "type": "noul",
      "instructions": "用户是否明确要求退款？"
    },
    "issue_type": {
      "type": "choice",
      "instructions": "这条请求属于哪一类？",
      "criteria": {
        "refund": "用户要求退回款项",
        "information": "用户只是在询问信息",
        "other": "不属于前两类"
      }
    },
    "frustration": {
      "type": "score",
      "instructions": "用户的情绪处于哪个等级？",
      "criteria": ["平静", "不满", "强烈愤怒"]
    }
  }
}
```

模型返回结构化答案后，业务代码可以把退款请求、订单事实和政策判断组合起来；需要对用户解释时，再由普通 LLM 或固定模板生成说明。

## 适用边界

Jev 适合答案空间可以提前定义、每个判断都能收敛成一个窄问题的场景：分类、路由、风险检测、评分、排序、Agent 工具选择、LLM 输入输出守卫，以及高频实时决策。

它不适合直接承担写文章、聊天、写代码、开放式方案设计、需要长篇推理的任务，也不能替代权限校验、金额计算、日期比较和其他本来就应该由确定性代码完成的逻辑。Jev 的类型安全只保证返回值落在声明的结构中，不保证选中的值一定正确。

当前公开案例包括 TypeSafe 自己的实时 DOOM 和 Wikipedia race 演示，以及通过 Cloudflare Workers AI 和 Vercel AI Gateway 提供的托管接入。社区还出现了浏览器动作选择、Agent/模型路由、上下文压缩、代码检查和实时游戏控制等原型；这些公开项目主要说明使用方向，不能直接当成大规模生产部署证据。

## 常见错误

- 把 Jev 当成普通聊天模型，期待它返回理由、报告或代码。
- 把一个复杂问题压成一个最终 Boolean，导致 bad case 无法定位到具体判断。
- 只记录最终答案，不记录概率分布、问题定义、模型版本和真实结果。
- 把 `confidence` 当成正确性证明，或给所有动作使用同一个阈值。
- 把精确计算、权限判断和不可违反的业务规则交给模型，而不是交给代码。
- 把“不会返回未声明的类型”误解成“不会判断错误”。
- 不给 `Choice` 保留 `other` 或 `unknown`，强迫模型在不合适的选项中选择。

## 公开参考

- [Introducing System One Models & Jev](https://typesafe.ai/blog/introducing-system-one-models-and-jev)
- [TypeSafe AI Introduction](https://docs.typesafe.ai/introduction)
- [TypeSafe AI Primitives](https://docs.typesafe.ai/primitives)
- [TypeSafe AI Confidence](https://docs.typesafe.ai/confidence)
- [TypeSafe AI Patterns](https://docs.typesafe.ai/patterns)
- [Cloudflare Workers AI：Jev](https://developers.cloudflare.com/ai/models/typesafe/jev/)
- [Vercel AI Gateway：Jev](https://vercel.com/ai-gateway/models/jev)
