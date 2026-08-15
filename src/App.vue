<script setup>
import { ref, computed, onMounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import SkillRow from './components/SkillRow.vue'

const skills = ref([])
const search = ref('')
const category = ref('All')
const status = ref('All')
const toast = ref('')

async function refresh() {
  const r = await fetch('/api/skills')
  skills.value = (await r.json()).skills
}

const categories = computed(() =>
  ['All', ...new Set(skills.value.map(s => s.category))].sort())

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return skills.value
    .filter(s => !q || (s.name + ' ' + s.description).toLowerCase().includes(q))
    .filter(s => category.value === 'All' || s.category === category.value)
    .filter(s => status.value === 'All' || (status.value === 'Enabled') === s.enabled)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
})

const enabledCount = computed(() => skills.value.filter(s => s.enabled).length)

async function toggle(skill) {
  const was = skill.enabled
  skill.enabled = !was // optimistic
  try {
    const r = await fetch('/api/skills/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: skill.id })
    })
    if (!r.ok) throw new Error((await r.json()).error)
  } catch (e) {
    skill.enabled = was
    toast.value = e.message
    setTimeout(() => (toast.value = ''), 3000)
  }
  refresh()
}

onMounted(refresh)
</script>

<template>
  <header>
    <h1>Skill Manager</h1>
    <span class="stat">{{ enabledCount }} enabled · {{ skills.length - enabledCount }} disabled</span>
  </header>
  <Toolbar v-model:search="search" v-model:category="category" v-model:status="status" :categories="categories" />
  <main>
    <SkillRow v-for="s in filtered" :key="s.id" :skill="s" @toggle="toggle" />
    <p v-if="!filtered.length" class="empty">No skills match.</p>
  </main>
  <div v-if="toast" class="toast">{{ toast }}</div>
</template>
