<script setup>
defineProps({ categories: Array })
// NOTE: models must be assigned to consts — an unassigned defineModel(name)
// registers `name` as a prop binding, which makes v-model="name" fail to compile.
const search = defineModel('search')
const category = defineModel('category')
const status = defineModel('status')
</script>

<template>
  <div class="toolbar">
    <input v-model="search" type="search" placeholder="Search skills…" />
    <select v-model="category">
      <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
    </select>
    <select v-model="status">
      <option>All</option>
      <option>Enabled</option>
      <option>Disabled</option>
    </select>
  </div>
</template>
