<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { getTopic } from '../navigation.mjs'

const props = defineProps<{ topic: string; section: string }>()
const section = computed(() => {
  const section = getTopic(props.topic).sections.find((section) => section.id === props.section)
  if (!section) throw new Error('Unknown topic section: ' + props.section)
  return section
})
</script>

<template>
  <ul class="knowledge-article-list">
    <li v-for="article in section.articles" :key="article.link">
      <a :href="withBase(article.link)">{{ article.title }}</a>
      <p>{{ article.description }}</p>
    </li>
  </ul>
</template>
