<script setup>
import { ref, computed, onMounted } from 'vue'
import Toolbar from './components/Toolbar.vue'
import SkillRow from './components/SkillRow.vue'
import DetailDrawer from './components/DetailDrawer.vue'
import PresetMenu from './components/PresetMenu.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'

const skills = ref([])
const search = ref('')
const category = ref('All')
const status = ref('All')
const toast = ref('')
const selected = ref(null)
const presets = ref([])
const dialogPreset = ref(null)
const menuOpen = ref(false)
const theme = ref(
  localStorage.getItem('sm-theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
)
const view = ref(localStorage.getItem('sm-view') || 'list')
function setView(v) {
  view.value = v
  localStorage.setItem('sm-view', v)
}
document.documentElement.dataset.theme = theme.value
function setTheme(t) {
  theme.value = t
  document.documentElement.dataset.theme = t
  localStorage.setItem('sm-theme', t)
}

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

async function refreshPresets() {
  const r = await fetch('/api/presets')
  presets.value = (await r.json()).presets
}

const dialogNames = computed(() => {
  if (!dialogPreset.value) return []
  const wanted = new Set(dialogPreset.value.skills)
  return skills.value.filter(s => wanted.has(s.id)).map(s => s.name)
})
const dialogTitle = computed(() => `Apply preset "${dialogPreset.value?.name ?? ''}"?`)
const dialogDisabledCount = computed(() => {
  if (!dialogPreset.value) return 0
  const wanted = new Set(dialogPreset.value.skills)
  return skills.value.filter(s => !wanted.has(s.id)).length
})

function askApply(preset) {
  menuOpen.value = false
  dialogPreset.value = preset
}

async function doApply() {
  const p = dialogPreset.value
  dialogPreset.value = null
  const r = await fetch('/api/presets/apply', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preset: p.name })
  })
  if (!r.ok) toast.value = (await r.json()).error
  refresh()
  refreshPresets()
}

async function savePreset() {
  const name = prompt('Preset name:')
  if (!name) return
  const r = await fetch('/api/presets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, skills: skills.value.filter(s => s.enabled).map(s => s.id) })
  })
  if (!r.ok) toast.value = (await r.json()).error
  menuOpen.value = false
  refreshPresets()
}

async function renamePreset(p) {
  const name = prompt('New name:', p.name)
  if (!name) return
  const r = await fetch('/api/presets/' + encodeURIComponent(p.name), {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  if (!r.ok) toast.value = (await r.json()).error
  refreshPresets()
}

async function deletePreset(p) {
  if (!confirm(`Delete preset "${p.name}"?`)) return
  const r = await fetch('/api/presets/' + encodeURIComponent(p.name), { method: 'DELETE' })
  if (!r.ok && r.status !== 204) toast.value = (await r.json()).error
  refreshPresets()
}

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

onMounted(() => { refresh(); refreshPresets() })
</script>

<template>
  <header>
    <h1>Skill Manager</h1>
    <div class="header-right">
      <span class="stat">{{ enabledCount }} enabled · {{ skills.length - enabledCount }} disabled</span>
      <button class="theme-btn" :title="view === 'list' ? 'Switch to cards' : 'Switch to list'" @click="setView(view === 'list' ? 'cards' : 'list')">
        {{ view === 'list' ? '▦' : '☰' }}
      </button>
      <div class="menu-wrap">
        <button class="theme-btn" @click="menuOpen = !menuOpen">Presets ▾</button>
        <PresetMenu v-if="menuOpen" :presets="presets"
          @apply="askApply" @save="savePreset" @rename="renamePreset" @delete="deletePreset" />
      </div>
      <button class="theme-btn" @click="setTheme(theme === 'dark' ? 'light' : 'dark')">
        {{ theme === 'dark' ? '☀' : '🌙' }}
      </button>
    </div>
  </header>
  <Toolbar v-model:search="search" v-model:category="category" v-model:status="status" :categories="categories" />
  <main :class="{ cards: view === 'cards' }">
    <SkillRow v-for="s in filtered" :key="s.id" :skill="s" :view="view" @toggle="toggle" @select="selected = $event" />
    <p v-if="!filtered.length" class="empty">No skills match.</p>
  </main>
  <DetailDrawer :skill="selected" @close="selected = null" />
  <ConfirmDialog v-if="dialogPreset"
    :title="dialogTitle"
    :skills="dialogNames" :disabled-count="dialogDisabledCount"
    @confirm="doApply" @cancel="dialogPreset = null" />
  <div v-if="toast" class="toast">{{ toast }}</div>
</template>
