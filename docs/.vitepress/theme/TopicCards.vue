<script setup lang="ts">
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { knowledgeTopics, topicArticles, type TopicArea } from '../navigation.mjs'

const props = defineProps<{ area?: TopicArea; excludeArea?: TopicArea }>()
const topics = computed(() => knowledgeTopics.filter((topic) =>
  (!props.area || topic.area === props.area) &&
  (!props.excludeArea || topic.area !== props.excludeArea)
))
</script>

<template>
  <div class="knowledge-topic-grid">
    <a v-for="topic in topics" :key="topic.id" :href="withBase(topic.link)" class="knowledge-topic-card">
      <span class="knowledge-topic-count">{{ topicArticles(topic).length }} 篇文章</span>
      <span class="knowledge-topic-title">{{ topic.title }}</span>
      <span class="knowledge-topic-description">{{ topic.description }}</span>
      <span class="knowledge-topic-action" aria-hidden="true">进入主题 →</span>
    </a>
  </div>
</template>
