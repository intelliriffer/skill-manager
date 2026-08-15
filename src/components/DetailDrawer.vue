<script setup>
import { ref, watch } from 'vue'
import { marked } from 'marked'

const props = defineProps({ skill: { type: Object, default: null } })
defineEmits(['close'])
const body = ref('')

watch(() => props.skill, async (s) => {
  if (!s) { body.value = ''; return }
  const r = await fetch('/api/skills/content?id=' + encodeURIComponent(s.id))
  const data = await r.json()
  body.value = data.content ? marked.parse(data.content) : '(no content)'
}, { immediate: true })
</script>

<template>
  <aside v-if="skill" class="drawer">
    <button class="close" @click="$emit('close')">✕</button>
    <article class="md" v-html="body"></article>
  </aside>
</template>
