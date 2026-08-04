import { defineConfig } from 'vitepress'

const repositoryUrl = 'https://github.com/sklme/journal'

export default defineConfig({
  title: '开发札记',
  description: '个人技术实践、问题复盘与可复用知识',
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
    siteTitle: '开发札记',

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
