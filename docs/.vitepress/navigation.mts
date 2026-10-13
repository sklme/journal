import type { DefaultTheme } from 'vitepress'

export type TopicArea = 'ai' | 'development' | 'engineering'
export interface KnowledgeArticle {
  text: string
  title: string
  description: string
  link: string
}
export interface TopicSection {
  id: string
  title: string
  description: string
  articles: KnowledgeArticle[]
}
export interface KnowledgeTopic {
  id: string
  title: string
  area: TopicArea
  description: string
  route: string
  link: string
  sections: TopicSection[]
}

// Articles keep their existing URLs. This catalogue defines their navigation topic.
export const knowledgeTopics: KnowledgeTopic[] = [
  {
    "id": "agent-llm",
    "title": "Agent 与 LLM",
    "area": "ai",
    "description": "理解模型缓存、Agent Runtime、多 Agent 协作与平台控制面。",
    "route": "先理解模型推理与缓存，再阅读 Agent Runtime 和协作边界，最后了解平台与控制面的取舍。",
    "sections": [
      {
        "id": "llm-cache",
        "title": "LLM 缓存与 Agent 推理",
        "description": "从缓存原理到提供商方案，理解 Agent Harness 如何影响推理成本。",
        "articles": [
          {
            "text": "LLM 缓存机制",
            "title": "LLM 缓存机制：原理、流派与工程实践",
            "description": "从注意力中的 Q、K、V 出发，系统梳理单次生成、跨请求、推理服务和应用层缓存的原理、边界与实践。",
            "link": "/knowledge/ai-engineering/llm-caching-mechanisms-and-practices"
          },
          {
            "text": "主流模型方案对比",
            "title": "主流 LLM 的 Prompt Cache 方案与机制对比",
            "description": "对比 DeepSeek、OpenAI、Claude、Gemini 与自托管推理框架的前缀缓存规则、控制方式、生命周期和适用场景。",
            "link": "/knowledge/ai-engineering/llm-provider-prompt-caching-comparison"
          },
          {
            "text": "DeepSeek Harness 优化",
            "title": "DeepSeek Agent Harness 与前缀缓存优化",
            "description": "解释 Agent Harness 如何影响 DeepSeek 前缀缓存，并拆解 Pi、Reasonix、DeepPi 与 pi-deepseek-cache 的具体方案。",
            "link": "/knowledge/ai-engineering/deepseek-agent-harness-prefix-cache-optimization"
          }
        ]
      },
      {
        "id": "structured-decisions",
        "title": "结构化 AI 决策",
        "description": "把自然语言判断组织为可组合、可校准的决策原语。",
        "articles": [
          {
            "text": "Jev 与结构化决策原语",
            "title": "Jev：把 AI 判断拆成可组合的结构化决策原语",
            "description": "理解 TypeSafe AI Jev 如何用 Choice、Score、Noul 和置信度把自然语言判断接入软件，以及 token、可观测性和迭代边界。",
            "link": "/knowledge/ai-engineering/jev-structured-ai-decision-primitives"
          }
        ]
      },
      {
        "id": "collaboration",
        "title": "多 Agent 工程协作",
        "description": "从上下文交接与认知独立性，逐步建立可调度的 Agent Runtime。",
        "articles": [
          {
            "text": "跨机器上下文交接与记忆",
            "title": "跨机器 Agent 上下文交接：任务状态、长期记忆与 Multica 实践",
            "description": "区分会话历史、任务状态、长期记忆和执行调度，解释跨机器 Agent 如何保存、检索并接续工作。",
            "link": "/knowledge/ai-engineering/cross-machine-agent-context-handoff"
          },
          {
            "text": "角色与认知独立性",
            "title": "多 Agent 工程协作：角色之外的认知独立性",
            "description": "从目标、上下文、工具与权限的差异出发，设计能相互制约并稳定收敛的多 Agent 工程流程",
            "link": "/knowledge/ai-engineering/multi-agent-cognitive-independence"
          },
          {
            "text": "Agent Runtime 工程指南",
            "title": "从多角色协作到 Agent Runtime：工程化设计指南",
            "description": "用控制面、执行面、能力面、证据面和治理横切层设计可调度、可验证、可渐进演进的多 Agent 系统",
            "link": "/knowledge/ai-engineering/agent-runtime-engineering-guide"
          }
        ]
      },
      {
        "id": "platforms",
        "title": "Agent 平台与控制面",
        "description": "理解 Agent 管理层、长期记忆、任务边界与控制面的适用范围。",
        "articles": [
          {
            "text": "dot 定位与能力边界",
            "title": "dot 定位与能力边界",
            "description": "从一次关于替代性、记忆和跨设备任务的讨论，理解 dot 的组织价值、执行环境与会话保存边界。",
            "link": "/knowledge/ai-engineering/dot-positioning-and-capability-boundaries"
          },
          {
            "text": "dot 对话记录",
            "title": "dot 对话记录",
            "description": "记录围绕 dot 定位、记忆和任务边界的 28 条对话，保留顺序与公共来源。",
            "link": "/knowledge/ai-engineering/dot-conversation-record"
          },
          {
            "text": "Multica：Agent 管理层与控制面",
            "title": "Multica：Agent 管理层、控制面与适用边界",
            "description": "区分 Agent 控制面、任务内子 Agent 和 workspace Skills，判断什么时候值得引入 Multica。",
            "link": "/knowledge/ai-engineering/multica-agent-control-plane"
          }
        ]
      }
    ],
    "link": "/knowledge/topics/agent-llm/"
  },
  {
    "id": "agent-evaluation",
    "title": "Agent 评测",
    "area": "ai",
    "description": "从成功契约、Trace 和任务集，到可信评测器、受控实验与生产质量闭环。",
    "route": "先读知识体系总览，再按“定义对象 → 建立证据 → 构建任务集 → 设计评测器 → 证明修改有效 → 建立生产闭环”的顺序阅读。",
    "sections": [
      {
        "id": "overview",
        "title": "知识体系总览",
        "description": "先建立完整地图，再选择当前需要深入的部分。",
        "articles": [
          {
            "text": "知识体系总览",
            "title": "Agent 评测工程知识体系：从可观测性到质量基础设施",
            "description": "以定义质量、采集 Trace、构建评测集、受控实验和生产反馈为主线，组织 Agent 评测工程的知识体系与文章路线",
            "link": "/knowledge/ai-engineering/agent-evaluation-engineering-knowledge-roadmap"
          }
        ]
      },
      {
        "id": "evaluation-targets",
        "title": "第一部分 · 理解评测对象",
        "description": "定义评测对象和成功契约，明确一次评测究竟证明了什么。",
        "articles": [
          {
            "text": "为什么 Agent 评测更难",
            "title": "为什么 Agent 评测比搭建 Agent 更难",
            "description": "从非确定性、多步决策、环境状态和多种正确路径出发，解释 Agent 评测为何不能退化为一次输入输出测试",
            "link": "/knowledge/ai-engineering/why-agent-evaluation-is-hard"
          },
          {
            "text": "评测对象的四层边界",
            "title": "Agent 评测对象的四层边界：模型、Harness、系统与产品",
            "description": "区分模型、Agent Harness、完整系统和产品结果，建立能够解释分数变化的 Evaluation Map 与受控实验边界",
            "link": "/knowledge/ai-engineering/agent-evaluation-target-boundaries"
          },
          {
            "text": "Evaluation Contract",
            "title": "没有标准答案，如何用 Evaluation Contract 定义 Agent 成功",
            "description": "用结果、约束、质量、预算、可靠性和风险把模糊任务改写为可执行、可审查、允许多种正确路径的 Agent 评测契约",
            "link": "/knowledge/ai-engineering/agent-evaluation-contract"
          }
        ]
      },
      {
        "id": "observability",
        "title": "第二部分 · 建立可观测性",
        "description": "区分事实记录、质量判断与实验，建立可还原、可复现的证据。",
        "articles": [
          {
            "text": "Trace、Eval 与 Experiment",
            "title": "Trace、Eval、Experiment 与 Monitoring：Agent 质量系统的四个层次",
            "description": "区分 Agent Trace、评测、受控实验与生产监控的职责、数据产物和决策边界，避免用过程指标代替质量判断",
            "link": "/knowledge/ai-engineering/agent-trace-eval-experiment-monitoring-boundaries"
          },
          {
            "text": "Agent Trace Tree",
            "title": "如何设计 Agent Trace Tree：从模型调用到最终状态",
            "description": "设计覆盖模型、工具、Handoff、Guardrail、状态变化与产物证据的 Agent Trace Tree，并处理并发、隐私和版本演进",
            "link": "/knowledge/ai-engineering/agent-trace-tree-design"
          },
          {
            "text": "可复现 Agent 评测实验",
            "title": "如何让 Agent 评测实验可复现",
            "description": "用 Run Manifest、环境快照、Trial 隔离和基础设施失败分类，让 Agent 评测结果可以重跑、解释与公平比较",
            "link": "/knowledge/ai-engineering/reproducible-agent-evaluation-experiments"
          }
        ]
      },
      {
        "id": "datasets",
        "title": "第三部分 · 构建任务集",
        "description": "从真实工作中提取任务，建立有覆盖、有切分、有生命周期的评测集。",
        "articles": [
          {
            "text": "为什么需要自有 Dataset",
            "title": "为什么个人和团队需要自己的 Agent Eval Dataset",
            "description": "解释通用 Benchmark 与自有 Eval Dataset 的边界，并用任务分布、价值和覆盖建立可用于真实决策的最小评测集",
            "link": "/knowledge/ai-engineering/why-build-your-own-agent-eval-dataset"
          },
          {
            "text": "从真实工作到 Eval Case",
            "title": "如何把真实工作转化成 Agent Eval Case",
            "description": "从真实任务、Trace 和失败记录中提炼可复现、无解法泄漏、可稳定判定且能够长期版本化的 Agent Eval Case",
            "link": "/knowledge/ai-engineering/turn-real-work-into-agent-eval-cases"
          },
          {
            "text": "健康评测集分层",
            "title": "一个健康的 Agent 评测集如何分层",
            "description": "用用途、数据切分与来源生命周期三条轴组织 Agent 评测集，并建立去重、防泄漏、抽样、版本和流转规则",
            "link": "/knowledge/ai-engineering/healthy-agent-eval-dataset-layers"
          }
        ]
      },
      {
        "id": "graders",
        "title": "第四部分 · 设计可信评测器",
        "description": "组合确定性判断、模型裁判和轨迹检查，让评分有可信依据。",
        "articles": [
          {
            "text": "确定性 Grader",
            "title": "能用代码判断的，就不要交给 LLM",
            "description": "用结果、状态、不变量、接口契约和资源预算构建可复现的确定性 Agent Grader，并隔离评分证据与执行环境",
            "link": "/knowledge/ai-engineering/deterministic-graders-for-agent-evaluation"
          },
          {
            "text": "可信 LLM-as-Judge",
            "title": "LLM-as-Judge 如何避免成为另一种玄学",
            "description": "把 LLM Judge 作为需要金标校准、偏差测试、版本治理和人工升级的测量仪器，构建可审查的模型评测器",
            "link": "/knowledge/ai-engineering/reliable-llm-as-judge-for-agent-evaluation"
          },
          {
            "text": "Trajectory 评测",
            "title": "Agent Trajectory 应该评什么",
            "description": "区分结果判定与过程评测，用事件、Span 和状态证据检查 Agent 的安全边界、工具行为、错误恢复、Handoff 与终止策略",
            "link": "/knowledge/ai-engineering/what-to-evaluate-in-agent-trajectories"
          }
        ]
      },
      {
        "id": "experiments",
        "title": "第五部分 · 证明修改有效",
        "description": "用重复 Trial、配对实验和多维门槛，把分数变化转化为可解释的发布证据。",
        "articles": [
          {
            "text": "重复 Trial 与统计证据",
            "title": "Agent 是随机的：一次成功说明不了什么",
            "description": "用重复 Trial、pass@k、pass^k、置信区间和完整运行对账，把一次偶然结果变成可解释的 Agent 可靠性证据",
            "link": "/knowledge/ai-engineering/agent-evaluation-with-repeated-trials"
          },
          {
            "text": "公平比较两个 Agent",
            "title": "如何公平比较两个 Agent",
            "description": "用配对 Case、受控变量、随机化执行和预声明分析，判断两个 Agent 的差异是否来自修改本身",
            "link": "/knowledge/ai-engineering/fair-comparison-of-agent-variants"
          },
          {
            "text": "Scorecard 与发布门槛",
            "title": "不要把所有维度压成一个总分",
            "description": "用多维 Scorecard、风险硬门槛、回归预算和分阶段 Release Gate，把 Agent 评测结果转化为可审计的发布决策",
            "link": "/knowledge/ai-engineering/multi-dimensional-agent-scorecards-and-release-gates"
          }
        ]
      },
      {
        "id": "quality-infrastructure",
        "title": "第六部分 · 建立质量基础设施",
        "description": "把生产失败、安全治理和重复评测流程连接成可持续的质量闭环。",
        "articles": [
          {
            "text": "生产失败转化为 Regression Case",
            "title": "如何把生产失败转化成 Regression Case",
            "description": "从生产证据、人工归因、稳定复现到脱敏 Case Family，建立能够长期阻止 Agent 失败复发的闭环",
            "link": "/knowledge/ai-engineering/production-failure-to-regression-case"
          },
          {
            "text": "Trace 安全、隐私与治理",
            "title": "Agent Trace 的安全、隐私与数据治理",
            "description": "用数据最小化、字段分级、分层存储、访问审计和删除血缘，让 Agent Trace 可用于评测而不成为新的安全风险",
            "link": "/knowledge/ai-engineering/agent-telemetry-safety-privacy-and-data-governance"
          },
          {
            "text": "何时建设 Eval 平台",
            "title": "什么时候才值得建设 Agent Eval 平台",
            "description": "从脚本、共享 Runner 到完整质量平台，判断 Agent Eval 何时应该平台化，以及哪些契约必须先于 UI 和基础设施",
            "link": "/knowledge/ai-engineering/when-to-build-an-agent-eval-platform"
          }
        ]
      }
    ],
    "link": "/knowledge/topics/agent-evaluation/"
  },
  {
    "id": "mcp-skills",
    "title": "MCP 与 Skills",
    "area": "ai",
    "description": "管理工具配置、MCP 网关、Skills 生命周期与 Codex 插件。",
    "route": "从配置管理与直接接入开始，再按需求选择 Broker 或 Agent 型网关；Skills 与插件部分可按当前扩展需求查阅。",
    "sections": [
      {
        "id": "mcp",
        "title": "MCP 工程化",
        "description": "按配置生命周期、运行时工具发现、代理执行与业界实践逐步阅读。",
        "articles": [
          {
            "text": "配置管理与同步",
            "title": "MCP 配置管理与同步：不引入运行时网关的控制面方案",
            "description": "在保持 Agent 直连 MCP 的前提下，用统一清单、Profile、Agent Adapter 和 SecretRef 管理并同步配置。",
            "link": "/knowledge/ai-engineering/mcp-configuration-management-and-sync"
          },
          {
            "text": "Codex MCP 与 ToolHive",
            "title": "个人开发者如何管理 Codex MCP：何时需要 ToolHive",
            "description": "从配置分组、会话隔离和运行安全三个维度，判断个人开发者是否需要 ToolHive，并给出 Codex Desktop 的轻量配置方案。",
            "link": "/knowledge/ai-engineering/codex-mcp-management-for-individual-developers"
          },
          {
            "text": "Obsidian 原生 MCP 接入 Codex",
            "title": "Obsidian 原生 MCP 接入 Codex",
            "description": "使用 Local REST API 内置的 MCP 接入 Codex，并按需开放笔记读取和写入工具。",
            "link": "/knowledge/ai-engineering/obsidian-native-mcp-codex"
          },
          {
            "text": "工具网关：基础架构",
            "title": "MCP 工具网关：基础架构与核心契约",
            "description": "用一个路由 Skill 和一个 MCP 工具网关实现工具按需发现、Schema 延迟加载与统一执行。",
            "link": "/knowledge/ai-engineering/mcp-gateway-foundation"
          },
          {
            "text": "Broker 型网关",
            "title": "Broker 型 MCP 网关：检索、校验与转发",
            "description": "让主 Agent 保留任务规划权，由 Broker 按需检索工具、返回 Schema、校验参数并代理执行。",
            "link": "/knowledge/ai-engineering/mcp-gateway-tool-broker"
          },
          {
            "text": "Agent 型网关",
            "title": "Agent 型 MCP 网关：作为第二 Agent 代理规划与执行",
            "description": "分析让 MCP 网关作为第二 Agent 自主规划、多工具执行和返回领域结论的收益、代价与安全边界。",
            "link": "/knowledge/ai-engineering/mcp-gateway-agent-proxy"
          },
          {
            "text": "业界实践",
            "title": "MCP 管理、Tool Broker 与领域 Agent 的业界实践",
            "description": "对照主流 MCP Gateway、延迟加载 Tool Search 和 Agent-as-Tool 实践，提炼配置管理、运行时 Broker 与领域 Agent 的合理边界。",
            "link": "/knowledge/ai-engineering/mcp-management-broker-and-agent-industry-practices"
          }
        ]
      },
      {
        "id": "skills",
        "title": "Agent Skills 管理",
        "description": "理解安装更新模型，再建立版本、分发、作用域与生命周期管理。",
        "articles": [
          {
            "text": "npx skills 安装与更新原理",
            "title": "npx skills 的安装与更新原理：远端解析、目录替换与软链接",
            "description": "解释 Vercel Skills CLI 如何发现、安装和更新 Skill，以及 copy、symlink 与目录替换的实际语义",
            "link": "/knowledge/ai-engineering/npx-skills-installation-and-update-model"
          },
          {
            "text": "分发与生命周期管理",
            "title": "Agent Skills 分发与生命周期管理",
            "description": "从安装器走向 Registry、版本、作用域、审批和本地资产管理的通用方案",
            "link": "/knowledge/ai-engineering/agent-skills-distribution-and-lifecycle-management"
          }
        ]
      },
      {
        "id": "plugins",
        "title": "Codex 插件扩展",
        "description": "了解插件、MCP Server 和对话内 UI 的分工与扩展边界。",
        "articles": [
          {
            "text": "插件开发与 UI 边界",
            "title": "Codex 插件开发：从 MCP Server 到对话内 UI",
            "description": "梳理 Codex 插件的组成、代码库检查插件的实现路径，以及 MCP UI 与原生 Tab 之间的能力边界。",
            "link": "/knowledge/ai-engineering/codex-plugin-development-and-ui-boundaries"
          }
        ]
      }
    ],
    "link": "/knowledge/topics/mcp-skills/"
  },
  {
    "id": "ai-development",
    "title": "AI 研发工具",
    "area": "ai",
    "description": "探索 Agent 原生 API 工具、代码理解、变更审查与多模态应用。",
    "route": "API 工具系列按产品定位、测试工作流、执行架构、Tool 契约和人工审查的顺序阅读；代码理解系列从价值边界进入变更保证体系。",
    "sections": [
      {
        "id": "api-tools",
        "title": "Agent 原生 API 管理",
        "description": "从临时探索走向稳定回归，建立共享执行能力和面向人的审查入口。",
        "articles": [
          {
            "text": "从请求编辑器到能力基础设施",
            "title": "Agent 时代的 API 管理工具：从请求编辑器到能力基础设施",
            "description": "分析 Agent 如何拆解传统 API 客户端的价值，并给出从请求编辑器演进为执行与治理基础设施的产品方向。",
            "link": "/knowledge/ai-engineering/agent-native-api-management-from-client-to-infrastructure"
          },
          {
            "text": "从临时探索到稳定回归",
            "title": "Agent 原生 API 测试：从临时探索到稳定回归",
            "description": "建立临时探索、可复用命令与自动化回归之间的晋升路径，让 Agent 生成的请求转化为稳定测试资产。",
            "link": "/knowledge/ai-engineering/agent-native-api-testing-exploration-to-regression"
          },
          {
            "text": "事实来源、Runner 与多入口",
            "title": "Agent 原生 API 测试架构：事实来源、Runner 与多入口",
            "description": "划分接口契约、测试场景、环境和执行结果的权威来源，并用共享 Runner 支撑 Agent、CLI、UI 与 CI。",
            "link": "/knowledge/ai-engineering/agent-native-api-source-of-truth-and-execution-architecture"
          },
          {
            "text": "API Tool 与安全插件",
            "title": "Agent 原生 API Tool 设计：从任意 HTTP 到安全插件",
            "description": "设计适合 Agent 的 API 插件、工具发现与执行契约，在灵活性、上下文成本和写操作安全之间取得平衡。",
            "link": "/knowledge/ai-engineering/agent-native-api-tools-and-plugin-design"
          },
          {
            "text": "Human UI 审查控制面",
            "title": "Agent 原生 API 工具的 Human UI：从操作台到审查控制面",
            "description": "重新定义 API 工具中的人工界面，使其服务于发现、预览、审批、证据与历史，而不是成为第二份请求事实来源。",
            "link": "/knowledge/ai-engineering/agent-native-api-human-control-surface"
          }
        ]
      },
      {
        "id": "code-review",
        "title": "AI 辅助代码理解",
        "description": "围绕代码地图、意图、实现与证据，理解 AI 辅助研发和变更审查。",
        "articles": [
          {
            "text": "代码知识图谱与人类代码地图",
            "title": "AI 代码知识图谱的价值边界：从 Agent 加速层到人类代码地图",
            "description": "分析 AI 代码知识图谱的价值边界，并设计面向人的渐进式 ChangeGraph Review 系统",
            "link": "/knowledge/ai-engineering/ai-code-knowledge-graph-and-human-first-code-map"
          },
          {
            "text": "Agent 代码审查与渐进式保证",
            "title": "Agent 代码审查的哲学：从黑盒验证到渐进式保证",
            "description": "用黑盒验证、语义变更审查和源码审查构建风险自适应的 Agent 代码保证体系",
            "link": "/knowledge/ai-engineering/agent-code-review-progressive-assurance"
          },
          {
            "text": "Spec、ChangeGraph 与 EvidenceGraph",
            "title": "Spec、ChangeGraph 与 EvidenceGraph：Agent 开发的意图—实现—证据闭环",
            "description": "把 Spec 抽象为意图层，并用实现图和证据图持续发现漂移、完成对齐与验收",
            "link": "/knowledge/ai-engineering/spec-changegraph-evidence-reconciliation"
          },
          {
            "text": "ChangeGraph 社区实践与竞品分析",
            "title": "ChangeGraph 的社区实践与竞品分析：从代码地图到变更保证系统",
            "description": "对比 AI 代码审查、可视化代码地图与代码分析基础设施，提炼面向人的变更保证系统可以复用的能力与差异化方向",
            "link": "/knowledge/ai-engineering/changegraph-community-practices-and-competitive-landscape"
          },
          {
            "text": "ChangeGraph 设计哲学",
            "title": "ChangeGraph 设计哲学：面向人类的 Agent 变更审查系统",
            "description": "定义 ChangeGraph 的服务对象、审查单位、事实边界、分层原则、非目标与产品决策准则",
            "link": "/knowledge/ai-engineering/changegraph-human-centered-review-design-philosophy"
          }
        ]
      },
      {
        "id": "multimodal",
        "title": "AI 视频与多模态应用",
        "description": "了解自动视频流水线，并分析智能剪辑 Agent 的渐进式改造。",
        "articles": [
          {
            "text": "MoneyPrinterTurbo 架构与智能剪辑",
            "title": "MoneyPrinterTurbo 架构拆解：从自动视频拼装到智能剪辑 Agent",
            "description": "拆解 MoneyPrinterTurbo 的入口层、Python 视频流水线、LLM 成本与局限，并设计面向多模态智能剪辑的渐进式改造方案。",
            "link": "/knowledge/ai-engineering/moneyprinterturbo-architecture-and-intelligent-video-editing"
          }
        ]
      }
    ],
    "link": "/knowledge/topics/ai-development/"
  },
  {
    "id": "development-environment",
    "title": "开发环境",
    "area": "development",
    "description": "搭建终端、远程开发机、跨设备会话与容器环境，并按症状排障。",
    "route": "本机从终端工作流开始，远程开发从 MacBook 配置路线开始；容器和 Codex 远程排障按实际需求查阅。",
    "sections": [
      {
        "id": "remote-development",
        "title": "MacBook 远程开发机系列",
        "description": "从供电和网络，到 SSH、屏幕共享、会话接续和重启恢复。",
        "articles": [
          {
            "text": "总览 · 配置路线",
            "title": "将 MacBook 配置为远程开发机：系列总览",
            "description": "按供电、网络与 SSH、屏幕共享、tmux、开发工具和恢复验收的顺序搭建远程开发机，并按症状查阅独立排障文章。",
            "link": "/knowledge/engineering/macbook-remote-development-setup"
          },
          {
            "text": "01 · 供电、熄屏与锁屏",
            "title": "MacBook 远程开发机：供电、熄屏与锁屏",
            "description": "通过 GUI 配置开盖接电、防止闲置睡眠、30 分钟熄屏与立即要求密码，并用系统字段和远程新连接验收。",
            "link": "/knowledge/engineering/macbook-remote-development-power-and-sleep"
          },
          {
            "text": "02 · Tailscale 与 SSH",
            "title": "MacBook 远程开发机：Tailscale 与 SSH",
            "description": "明确服务端与客户端的分工，通过 Tailscale 连接指定 Mac 账户，并从客户端安装公钥、验证密钥认证。",
            "link": "/knowledge/engineering/macbook-remote-development-network-and-ssh"
          },
          {
            "text": "03 · 屏幕共享与 iPhone",
            "title": "MacBook 远程开发机：屏幕共享与 iPhone 接入",
            "description": "通过 GUI 限定屏幕共享账户，使用另一台 Mac 或 iPhone 的 Screens 客户端经 Tailscale 操作桌面，并分别验收认证与外网连接。",
            "link": "/knowledge/engineering/macbook-remote-development-screen-sharing"
          },
          {
            "text": "04 · tmux 与跨设备接续",
            "title": "tmux 实用指南：常用命令、会话管理与远程开发",
            "description": "从日常速查到典型场景，掌握 tmux 会话、窗口、分屏、历史复制和跨设备接续，并理解离开与结束任务的区别。",
            "link": "/knowledge/engineering/tmux-practical-guide"
          },
          {
            "text": "05 · 工具、IDE 与容器",
            "title": "MacBook 远程开发机：开发工具、远程 IDE 与容器",
            "description": "按项目版本建立远端开发环境，通过 Remote SSH 和端口转发编辑与访问项目，并按需选择容器后端。",
            "link": "/knowledge/engineering/macbook-remote-development-tools-and-services"
          },
          {
            "text": "06 · 验收、恢复与维护",
            "title": "MacBook 远程开发机：验收、重启恢复与维护",
            "description": "分层验证配置、外网、熄屏和任务接续，按阶段检查重启恢复，并正确判断 APFS 可用空间与后续维护需求。",
            "link": "/knowledge/engineering/macbook-remote-development-recovery-and-checks"
          },
          {
            "text": "原理 · 无公网 IP 混合组网",
            "title": "无公网 IP 的远程组网：原理、移动端整合与云端混合架构",
            "description": "从 NAT 穿透与加密边界出发，设计云端 HTTPS、家庭 Mac AI 服务和手机 P2P 访问的混合架构，并分析移动端代理整合与验收方法。",
            "link": "/knowledge/engineering/remote-networking-without-public-ip"
          },
          {
            "text": "排障 · Tailscale 与 Clash",
            "title": "macOS 上让 Tailscale 与 Clash TUN 共存：配置实践与原理",
            "description": "从一次实际冲突出发，通过关闭 Tailscale DNS 接管与排除私有网络网段，让远程组网和 Clash TUN 共存，并解释验证结果与适用边界。",
            "link": "/knowledge/engineering/macos-tailscale-clash-tun-coexistence"
          }
        ]
      },
      {
        "id": "terminal-workflow",
        "title": "现代终端工作流",
        "description": "按终端基础、目录导航、文件浏览、阅读、搜索和配置恢复逐步练习。",
        "articles": [
          {
            "text": "01 · 终端基础",
            "title": "用 Ghostty、Fish 和 Starship 创建终端工作流",
            "description": "从工具分工到安装配置，创建具有原生补全、清晰提示符和统一配色的 macOS 终端工作流。",
            "link": "/knowledge/engineering/ghostty-fish-starship-terminal-workflow"
          },
          {
            "text": "02 · 导航与选择",
            "title": "zoxide 与 fzf：Fish 目录导航与交互搜索实践",
            "description": "安装 zoxide 与 fzf 并接入 Fish，使用 z 和 zi 切换目录，通过快捷键选择文件、搜索历史，并用 bat 和 eza 预览候选。",
            "link": "/knowledge/engineering/zoxide-directory-navigation-with-fish"
          },
          {
            "text": "03 · 文件浏览",
            "title": "eza：Fish 文件浏览与目录树实践",
            "description": "使用 Homebrew 安装 eza，为 Fish 配置 ll 和 lt，通过详细列表、目录树、排序与 Git 状态浏览项目文件。",
            "link": "/knowledge/engineering/eza-file-browsing-with-fish"
          },
          {
            "text": "04 · 文件阅读",
            "title": "bat：终端文件阅读与 fzf 预览实践",
            "description": "使用 Homebrew 安装 bat，沿用终端配色，通过语法高亮、分页搜索、指定行读取和 fzf 预览阅读配置与代码。",
            "link": "/knowledge/engineering/bat-file-reading-with-fish"
          },
          {
            "text": "05 · 搜索定位",
            "title": "fd 与 ripgrep：Fish 文件查找与内容搜索实践",
            "description": "使用 Homebrew 安装 fd 和 ripgrep，练习文件查找、内容搜索、隐藏与忽略规则，并组合 fzf 和 bat 筛选预览。",
            "link": "/knowledge/engineering/fd-ripgrep-search-with-fish"
          },
          {
            "text": "06 · 配置同步与恢复",
            "title": "终端配置同步：Git、符号链接与换机恢复",
            "description": "用私有 Git 仓库集中管理终端配置，通过符号链接、本机备份和 Brewfile 实现日常同步、换机恢复与回滚。",
            "link": "/knowledge/engineering/terminal-dotfiles-sync-and-restore"
          },
          {
            "text": "补充 · SSH 退格异常与 terminfo",
            "title": "Ghostty SSH 退格异常：理解 TERM 与 terminfo",
            "description": "理解 xterm、TERM 与 terminfo 的关系，定位并修复 SSH 后的退格和光标显示异常。",
            "link": "/knowledge/engineering/ghostty-ssh-backspace-terminfo"
          }
        ]
      },
      {
        "id": "containers",
        "title": "容器环境",
        "description": "在 macOS 上选择容器后端，并理解 Docker CLI 与 Podman 的连接方式。",
        "articles": [
          {
            "text": "Docker CLI 连接 Podman",
            "title": "macOS 上使用 Docker CLI 连接 Podman",
            "description": "理解 Docker CLI、context、Unix socket 与 Podman 兼容 API 的关系，并在 macOS 上安全切换容器后端",
            "link": "/knowledge/engineering/docker-cli-with-podman-on-macos"
          }
        ]
      },
      {
        "id": "codex-remote",
        "title": "Codex 远程使用与排障",
        "description": "按输入链路和历史会话恢复的具体症状查阅。",
        "articles": [
          {
            "text": "Codex SSH 图片粘贴与输入链路",
            "title": "Codex SSH 图片粘贴：X11 剪贴板与 App Server 输入链路",
            "description": "区分远程 CLI、本地客户端和 App Server 的图片输入链路，定位 X11 剪贴板超时并选择可验证的处理方式。",
            "link": "/knowledge/ai-engineering/codex-ssh-image-clipboard-and-app-server"
          },
          {
            "text": "手机旧会话恢复排障",
            "title": "Codex 手机旧会话无法恢复：分层排查与绕行",
            "description": "以同条件的新旧任务对照区分主机在线、任务执行和历史加载，保留已验证现象、未确认原因及安全接续路径。",
            "link": "/knowledge/ai-engineering/codex-mobile-session-reconnect-troubleshooting"
          }
        ]
      }
    ],
    "link": "/knowledge/topics/development-environment/"
  },
  {
    "id": "engineering-foundations",
    "title": "工程基础",
    "area": "engineering",
    "description": "查阅包版本与发布、Node.js、RPC 并发、云服务与文档工程。",
    "route": "包发布部分用于工具选型与迁移；请求上下文系列从 HTTP 到 RPC 顺序阅读；云服务先理解身份与权限；文档工程用于建设和维护知识站。",
    "sections": [
      {
        "id": "package-releases",
        "title": "包版本与发布",
        "description": "理解变更记录、版本计算与分发的职责，选择可评审、可验证的发布流程。",
        "articles": [
          {
            "text": "pnpm 原生发布与 Changesets",
            "title": "pnpm 原生发布管理：定位、Changesets 差异与选型建议",
            "description": "比较 pnpm 原生发布管理与 Changesets 的配置、预发布和自动化边界，给出接入、迁移与验证建议。",
            "link": "/knowledge/engineering/pnpm-native-release-management-and-changesets"
          }
        ]
      },
      {
        "id": "async-context-rpc",
        "title": "Node.js 异步上下文与 RPC 并发",
        "description": "从状态传播到共享对象竞争、锁与子上下文，通过实验理解并发隔离。",
        "articles": [
          {
            "text": "一：从 HTTP 到 RPC",
            "title": "一：从 HTTP 到 RPC——请求上下文如何传递",
            "description": "区分作用域访问对象、进程内异步状态和跨进程元数据，理解请求隔离与调用路由的边界。",
            "link": "/knowledge/engineering/http-rpc-context"
          },
          {
            "text": "二：AsyncLocalStorage 原理与场景",
            "title": "二：AsyncLocalStorage 的原理、机制与使用场景",
            "description": "通过确定性实验理解异步链传播、共享对象和子 store，并划清 run、enterWith 与 AsyncResource 的边界。",
            "link": "/knowledge/engineering/node-async-local-storage"
          },
          {
            "text": "三：锁与子上下文",
            "title": "三：上下文变化时的并发——锁与子上下文",
            "description": "比较请求内互斥与分支状态隔离，明确锁范围、业务依赖、并发容量和失败处理的边界。",
            "link": "/knowledge/engineering/rpc-context-lock-vs-child-scope"
          },
          {
            "text": "四：RPC 并发与隔离边界",
            "title": "四：RPC 并发改造——把路由隔离放到正确边界",
            "description": "将路由隔离提前到业务操作入口，以通用实验验证上下文边界，并设计有限并发、初始化与性能验收规则。",
            "link": "/knowledge/engineering/rpc-concurrency-isolation-boundaries"
          },
          {
            "text": "五：RPC 上下文并发实验",
            "title": "五：动手实验——验证 RPC 上下文的并发与隔离",
            "description": "用可下载的标准库实验对照共享状态、请求内锁与子上下文，断言并发数、路由隔离、嵌套和失败恢复。",
            "link": "/knowledge/engineering/rpc-context-concurrency-lab"
          }
        ]
      },
      {
        "id": "native-interop",
        "title": "Node.js 原生交互",
        "description": "理解 Node-API、FFI 与原生调用的线程、内存和分发边界。",
        "articles": [
          {
            "text": "Node.js 原生交互：Node-API 与 FFI",
            "title": "Node.js 原生交互全景：内置绑定、Node-API 与 FFI",
            "description": "理解 Node.js 调用原生代码的几条路径，以及线程、内存、性能和二进制分发的边界。",
            "link": "/knowledge/engineering/nodejs-native-interop-node-api-ffi"
          }
        ]
      },
      {
        "id": "cloud-services",
        "title": "云身份、存储与 CDN",
        "description": "先理解临时凭证与角色，再阅读对象存储、回源路径和权限控制。",
        "articles": [
          {
            "text": "AKSK、STS 与 CAM 角色",
            "title": "AKSK、STS 与 CAM 角色：三种临时凭证获取方式",
            "description": "区分云身份、角色授权与请求签名，理解 AKSK、OIDC、SAML 获取临时凭证的流程和边界。",
            "link": "/knowledge/engineering/aksk-sts-cam-oidc-saml"
          },
          {
            "text": "COS：设计、权限与实践",
            "title": "COS：对象存储的设计、权限与工程实践",
            "description": "从 Bucket、Object 和地域模型出发，理解 COS 的权限体系、主要操作、成本边界与常见业务架构。",
            "link": "/knowledge/engineering/cos-object-storage-design-and-practices"
          },
          {
            "text": "CDN 与 COS：配置、回源与权限",
            "title": "CDN 与 COS：CNAME、TLS、回源路径和权限",
            "description": "系统理解 COS 与 CDN 的职责、CNAME 和 TLS、回源路径映射、高级回源、缓存与两段访问鉴权。",
            "link": "/knowledge/engineering/cdn-cos-cname-tls-origin-pull"
          }
        ]
      },
      {
        "id": "documentation",
        "title": "文档工程",
        "description": "建设可维护的知识站，并用 Mermaid 表达流程、时序和关系。",
        "articles": [
          {
            "text": "使用 VitePress 搭建个人知识站",
            "title": "使用 VitePress 搭建个人知识站",
            "description": "使用 TypeScript、VitePress 和自动检查构建可维护的个人技术知识站",
            "link": "/knowledge/engineering/building-a-vitepress-knowledge-site"
          },
          {
            "text": "在文档中使用 Mermaid 图表",
            "title": "在文档中使用 Mermaid 图表",
            "description": "使用 Mermaid 代码块绘制流程图、时序图和关系图，并理解主题切换与渲染边界",
            "link": "/knowledge/engineering/mermaid-diagrams-in-vitepress"
          }
        ]
      }
    ],
    "link": "/knowledge/topics/engineering-foundations/"
  }
]

export function topicArticles(topic: KnowledgeTopic): KnowledgeArticle[] {
  return topic.sections.flatMap((section) => section.articles)
}

export function getTopic(id: string): KnowledgeTopic {
  const topic = knowledgeTopics.find((topic) => topic.id === id)
  if (!topic) throw new Error('Unknown knowledge topic: ' + id)
  return topic
}

function topicLinks(topics: KnowledgeTopic[]): DefaultTheme.SidebarItem[] {
  return topics.map((topic) => ({ text: topic.title, link: topic.link }))
}

const siteLinks: DefaultTheme.SidebarItem = {
  text: '站点',
  items: [
    { text: '全部主题', link: '/knowledge/' },
    { text: '内容日志', link: '/log/' },
    { text: '关于', link: '/about' }
  ]
}

function overviewSidebar(topics = knowledgeTopics): DefaultTheme.SidebarItem[] {
  return [{ text: '主题导航', items: topicLinks(topics) }, siteLinks]
}

function topicSidebar(topic: KnowledgeTopic): DefaultTheme.SidebarItem[] {
  return [
    { text: topic.title, items: [{ text: '主题总览', link: topic.link }] },
    ...topic.sections.map((section) => ({
      text: section.title,
      link: topic.link + '#' + section.id,
      collapsed: true,
      items: section.articles.map(({ text, link }) => ({ text, link }))
    })),
    siteLinks
  ]
}

export function createSidebars(): DefaultTheme.SidebarMulti {
  const result: DefaultTheme.SidebarMulti = {
    '/': overviewSidebar(),
    '/knowledge/ai-engineering/index.md': overviewSidebar(
      knowledgeTopics.filter((topic) => topic.area === 'ai')
    ),
    '/knowledge/engineering/index.md': overviewSidebar(
      knowledgeTopics.filter((topic) => topic.area !== 'ai')
    )
  }
  for (const topic of knowledgeTopics) {
    const sidebar = topicSidebar(topic)
    result[topic.link] = sidebar
    // VitePress selects the sidebar using the source page's relative .md path.
    // Exact article keys prevent similarly named pages from selecting another topic.
    for (const article of topicArticles(topic)) result[article.link + '.md'] = sidebar
  }
  return result
}

function activeMatch(topics: KnowledgeTopic[], extraPaths: string[] = []): string {
  const escape = (path: string) => path.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&')
  return '^(?:' + [
    ...extraPaths,
    ...topics.flatMap((topic) => [topic.link, ...topicArticles(topic).map((article) => article.link)])
  ].map(escape).join('|') + ')$'
}

const aiTopics = knowledgeTopics.filter((topic) => topic.area === 'ai')
const development = getTopic('development-environment')
const foundations = getTopic('engineering-foundations')

export const navigation: DefaultTheme.NavItem[] = [
  { text: '首页', link: '/', activeMatch: '^/$' },
  {
    text: 'AI 工程',
    activeMatch: activeMatch(aiTopics, ['/knowledge/ai-engineering/']),
    items: [
      { text: 'AI 工程总览', link: '/knowledge/ai-engineering/' },
      ...aiTopics.map((topic) => ({
        text: topic.title,
        link: topic.link,
        activeMatch: activeMatch([topic])
      }))
    ]
  },
  { text: development.title, link: development.link, activeMatch: activeMatch([development]) },
  { text: foundations.title, link: foundations.link, activeMatch: activeMatch([foundations]) },
  {
    text: '更多',
    activeMatch: '^/(?:knowledge/|log/|about)$',
    items: [
      { text: '全部主题', link: '/knowledge/' },
      { text: '内容日志', link: '/log/' },
      { text: '关于', link: '/about' }
    ]
  }
]
