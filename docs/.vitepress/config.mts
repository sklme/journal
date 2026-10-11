import { defineConfig } from 'vitepress'
import { configureMermaid } from './mermaid-markdown.js'
import { createSidebars, navigation } from './navigation.mjs'

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
    lineNumbers: true,
    config: configureMermaid
  },

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: '技术知识库',

    nav: navigation,
    sidebar: createSidebars(),

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
