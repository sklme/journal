import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import MermaidDiagram from './MermaidDiagram.vue'
import TopicCards from './TopicCards.vue'
import TopicArticles from './TopicArticles.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('MermaidDiagram', MermaidDiagram)
    app.component('TopicCards', TopicCards)
    app.component('TopicArticles', TopicArticles)
  }
} satisfies Theme
