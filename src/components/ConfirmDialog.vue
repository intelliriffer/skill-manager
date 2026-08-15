<script setup>
defineProps({ title: String, skills: Array, disabledCount: Number })
defineEmits(['confirm', 'cancel'])
</script>

<template>
  <div class="overlay" @click.self="$emit('cancel')">
    <div class="dialog">
      <h3>{{ title }}</h3>
      <p class="sub">{{ disabledCount }} other skills will be disabled.</p>
      <ul class="dlg-list">
        <li v-for="s in skills" :key="s">{{ s }}</li>
      </ul>
      <div class="actions">
        <button @click="$emit('cancel')">Cancel</button>
        <button class="primary" @click="$emit('confirm')">Apply</button>
      </div>
    </div>
  </div>
</template>
