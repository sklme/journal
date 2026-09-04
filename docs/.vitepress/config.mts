import { defineConfig } from 'vitepress'

const repositoryUrl = 'https://github.com/sklme/journal'

export default defineConfig({
  title: '技术知识库',
  description: '聚焦 AI 工程与工程实践的个人技术知识库',
  lang: 'zh-CN',
  base: '/journal/',
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  ignoreDeadLinks: false,

  head: [
    ['meta', { name: 'theme-color', content: '#0f766e' }],
    ['meta', { name: 'referrer', content: 'strict-origin-when-cross-origin' }]
  ],

  markdown: {
    lineNumbers: true
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: '技术知识库',

    nav: [
      { text: '知识库', link: '/knowledge/' },
      { text: '内容日志', link: '/log/' },
      { text: '关于', link: '/about' }
    ],

    sidebar: {
      '/knowledge/': [
        {
          text: '知识库',
          items: [
            { text: '知识库首页', link: '/knowledge/' },
            {
              text: 'AI 工程',
              link: '/knowledge/ai-engineering/',
              collapsed: false,
              items: [
                {
                  text: 'LLM 缓存与 Agent 推理',
                  link: '/knowledge/ai-engineering/#llm-缓存与-agent-推理',
                  collapsed: false,
                  items: [
                    {
                      text: 'LLM 缓存机制',
                      link: '/knowledge/ai-engineering/llm-caching-mechanisms-and-practices'
                    },
                    {
                      text: '主流模型方案对比',
                      link: '/knowledge/ai-engineering/llm-provider-prompt-caching-comparison'
                    },
                    {
                      text: 'DeepSeek Harness 优化',
                      link: '/knowledge/ai-engineering/deepseek-agent-harness-prefix-cache-optimization'
                    }
                  ]
                },
                {
                  text: 'Agent 评测工程',
                  link: '/knowledge/ai-engineering/#agent-评测工程',
                  collapsed: false,
                  items: [
                    {
                      text: '知识体系总览',
                      link: '/knowledge/ai-engineering/agent-evaluation-engineering-knowledge-roadmap'
                    },
                    {
                      text: '第一部分 · 理解评测对象',
                      collapsed: false,
                      items: [
                        {
                          text: '为什么 Agent 评测更难',
                          link: '/knowledge/ai-engineering/why-agent-evaluation-is-hard'
                        },
                        {
                          text: '评测对象的四层边界',
                          link: '/knowledge/ai-engineering/agent-evaluation-target-boundaries'
                        },
                        {
                          text: 'Evaluation Contract',
                          link: '/knowledge/ai-engineering/agent-evaluation-contract'
                        }
                      ]
                    },
                    {
                      text: '第二部分 · 建立可观测性',
                      collapsed: false,
                      items: [
                        {
                          text: 'Trace、Eval 与 Experiment',
                          link: '/knowledge/ai-engineering/agent-trace-eval-experiment-monitoring-boundaries'
                        },
                        {
                          text: 'Agent Trace Tree',
                          link: '/knowledge/ai-engineering/agent-trace-tree-design'
                        },
                        {
                          text: '可复现 Agent 评测实验',
                          link: '/knowledge/ai-engineering/reproducible-agent-evaluation-experiments'
                        }
                      ]
                    },
                    {
                      text: '第三部分 · 构建任务集',
                      collapsed: false,
                      items: [
                        {
                          text: '为什么需要自有 Dataset',
                          link: '/knowledge/ai-engineering/why-build-your-own-agent-eval-dataset'
                        },
                        {
                          text: '从真实工作到 Eval Case',
                          link: '/knowledge/ai-engineering/turn-real-work-into-agent-eval-cases'
                        },
                        {
                          text: '健康评测集分层',
                          link: '/knowledge/ai-engineering/healthy-agent-eval-dataset-layers'
                        }
                      ]
                    },
                    {
                      text: '第四部分 · 设计可信评测器',
                      collapsed: false,
                      items: [
                        {
                          text: '确定性 Grader',
                          link: '/knowledge/ai-engineering/deterministic-graders-for-agent-evaluation'
                        },
                        {
                          text: '可信 LLM-as-Judge',
                          link: '/knowledge/ai-engineering/reliable-llm-as-judge-for-agent-evaluation'
                        },
                        {
                          text: 'Trajectory 评测',
                          link: '/knowledge/ai-engineering/what-to-evaluate-in-agent-trajectories'
                        }
                      ]
                    }
                  ]
                },
                {
                  text: 'MCP 工程化',
                  link: '/knowledge/ai-engineering/#mcp-工程化',
                  collapsed: false,
                  items: [
                    {
                      text: '配置管理与同步',
                      link: '/knowledge/ai-engineering/mcp-configuration-management-and-sync'
                    },
                    {
                      text: 'Codex MCP 与 ToolHive',
                      link: '/knowledge/ai-engineering/codex-mcp-management-for-individual-developers'
                    },
                    {
                      text: '工具网关：基础架构',
                      link: '/knowledge/ai-engineering/mcp-gateway-foundation'
                    },
                    {
                      text: 'Broker 型网关',
                      link: '/knowledge/ai-engineering/mcp-gateway-tool-broker'
                    },
                    {
                      text: 'Agent 型网关',
                      link: '/knowledge/ai-engineering/mcp-gateway-agent-proxy'
                    },
                    {
                      text: '业界实践',
                      link: '/knowledge/ai-engineering/mcp-management-broker-and-agent-industry-practices'
                    }
                  ]
                },
                {
                  text: 'Agent 原生 API 管理',
                  link: '/knowledge/ai-engineering/#agent-原生-api-管理',
                  collapsed: false,
                  items: [
                    {
                      text: '从请求编辑器到能力基础设施',
                      link: '/knowledge/ai-engineering/agent-native-api-management-from-client-to-infrastructure'
                    },
                    {
                      text: '从临时探索到稳定回归',
                      link: '/knowledge/ai-engineering/agent-native-api-testing-exploration-to-regression'
                    },
                    {
                      text: '事实来源、Runner 与多入口',
                      link: '/knowledge/ai-engineering/agent-native-api-source-of-truth-and-execution-architecture'
                    },
                    {
                      text: 'API Tool 与安全插件',
                      link: '/knowledge/ai-engineering/agent-native-api-tools-and-plugin-design'
                    },
                    {
                      text: 'Human UI 审查控制面',
                      link: '/knowledge/ai-engineering/agent-native-api-human-control-surface'
                    }
                  ]
                },
                {
                  text: '多 Agent 工程协作',
                  link: '/knowledge/ai-engineering/#多-agent-工程协作',
                  collapsed: false,
                  items: [
                    {
                      text: '角色与认知独立性',
                      link: '/knowledge/ai-engineering/multi-agent-cognitive-independence'
                    },
                    {
                      text: 'Agent Runtime 工程指南',
                      link: '/knowledge/ai-engineering/agent-runtime-engineering-guide'
                    }
                  ]
                },
                {
                  text: 'AI 辅助代码理解',
                  link: '/knowledge/ai-engineering/#ai-辅助代码理解',
                  collapsed: false,
                  items: [
                    {
                      text: '代码知识图谱与人类代码地图',
                      link: '/knowledge/ai-engineering/ai-code-knowledge-graph-and-human-first-code-map'
                    },
                    {
                      text: 'Agent 代码审查与渐进式保证',
                      link: '/knowledge/ai-engineering/agent-code-review-progressive-assurance'
                    },
                    {
                      text: 'Spec、ChangeGraph 与 EvidenceGraph',
                      link: '/knowledge/ai-engineering/spec-changegraph-evidence-reconciliation'
                    },
                    {
                      text: 'ChangeGraph 社区实践与竞品分析',
                      link: '/knowledge/ai-engineering/changegraph-community-practices-and-competitive-landscape'
                    },
                    {
                      text: 'ChangeGraph 设计哲学',
                      link: '/knowledge/ai-engineering/changegraph-human-centered-review-design-philosophy'
                    }
                  ]
                },
                {
                  text: 'AI 视频与多模态工作流',
                  link: '/knowledge/ai-engineering/#ai-视频与多模态工作流',
                  collapsed: false,
                  items: [
                    {
                      text: 'MoneyPrinterTurbo 架构与智能剪辑',
                      link: '/knowledge/ai-engineering/moneyprinterturbo-architecture-and-intelligent-video-editing'
                    }
                  ]
                },
                {
                  text: 'Agent Skills 管理',
                  link: '/knowledge/ai-engineering/#agent-skills-管理',
                  collapsed: false,
                  items: [
                    {
                      text: 'npx skills 安装与更新原理',
                      link: '/knowledge/ai-engineering/npx-skills-installation-and-update-model'
                    },
                    {
                      text: '分发与生命周期管理',
                      link: '/knowledge/ai-engineering/agent-skills-distribution-and-lifecycle-management'
                    }
                  ]
                },
                {
                  text: 'Multica：Agent 管理层与控制面',
                  link: '/knowledge/ai-engineering/multica-agent-control-plane'
                }
              ]
            },
            {
              text: '工程实践',
              link: '/knowledge/engineering/',
              collapsed: false,
              items: [
                {
                  text: '使用 VitePress 搭建个人知识站',
                  link: '/knowledge/engineering/building-a-vitepress-knowledge-site'
                },
                {
                  text: 'Docker CLI 连接 Podman',
                  link: '/knowledge/engineering/docker-cli-with-podman-on-macos'
                }
              ]
            }
          ]
        }
      ],
      '/log/': [
        {
          text: '内容日志',
          items: [{ text: '全部内容', link: '/log/' }]
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: repositoryUrl }],

    editLink: {
      pattern: `${repositoryUrl}/edit/main/docs/:path`,
      text: '在 GitHub 上编辑此页'
    },

    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'medium',
        timeStyle: 'short'
      }
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '没有找到相关内容',
                resetButtonTitle: '清除查询',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭'
                }
              }
            }
          }
        }
      }
    },

    outline: {
      level: [2, 3],
      label: '本页内容'
    },

    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    returnToTopLabel: '返回顶部',
    sidebarMenuLabel: '目录',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',

    footer: {
      message: '只记录可以公开分享的内容',
      copyright: '© 2026 sklme'
    }
  }
})
