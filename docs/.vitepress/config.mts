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
                  text: '多 Agent 工程协作',
                  link: '/knowledge/ai-engineering/#多-agent-工程协作',
                  collapsed: false,
                  items: [
                    {
                      text: '角色与认知独立性',
                      link: '/knowledge/ai-engineering/multi-agent-cognitive-independence'
                    }
                  ]
                },
                {
                  text: 'Agent Skills 分发与生命周期管理',
                  link: '/knowledge/ai-engineering/agent-skills-distribution-and-lifecycle-management'
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
