<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import { renderMermaid } from './mermaid-renderer.js'

const props = defineProps<{ code: string }>()
const { isDark } = useData()
const svg = ref('')
const failed = ref(false)
let renderVersion = 0

async function render(): Promise<void> {
  const version = ++renderVersion
  failed.value = false

  try {
    const result = await renderMermaid(props.code, isDark.value)
    if (version === renderVersion) svg.value = result
  } catch {
    if (version === renderVersion) {
      svg.value = ''
      failed.value = true
    }
  }
}

// Keep browser-only rendering out of the static build and hydrate the source first.
onMounted(() => {
  watch([() => props.code, isDark], render, { immediate: true })
})
onUnmounted(() => { renderVersion++ })
</script>

<template>
  <figure class="mermaid-diagram" aria-label="Mermaid 图表">
    <div v-if="svg" class="mermaid-diagram-svg" v-html="svg" />
    <div v-else>
      <p v-if="failed" class="mermaid-diagram-error" role="alert">
        图表渲染失败，请检查 Mermaid 语法。
      </p>
      <pre><code>{{ code }}</code></pre>
    </div>
  </figure>
</template>
