<script setup>
defineProps({ presets: Array })
defineEmits(['apply', 'save', 'rename', 'delete'])
</script>

<template>
  <div class="preset-menu">
    <button class="pm-save" @click="$emit('save')">Save current as preset…</button>
    <div v-for="p in presets" :key="p.name" class="pm-row">
      <button @click="$emit('apply', p)">{{ p.name }} ({{ p.count }})</button>
      <template v-if="!p.builtin">
        <button class="mini" @click="$emit('rename', p)">rename</button>
        <button class="mini" @click="$emit('delete', p)">delete</button>
      </template>
    </div>
  </div>
</template>
