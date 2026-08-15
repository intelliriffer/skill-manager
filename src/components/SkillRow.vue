<script setup>
defineProps({ skill: Object, view: { type: String, default: 'list' } })
defineEmits(['toggle', 'select'])
</script>

<template>
  <div :class="view === 'cards' ? 'card' : 'row'"
    :data-enabled="skill.enabled" @click="$emit('select', skill)">
    <input type="checkbox" class="toggle" :checked="skill.enabled"
      @click.stop @change="$emit('toggle', skill)" />
    <div>
      <div class="meta">
        <span class="name">{{ skill.name }}</span>
        <span class="cat">{{ skill.category }}</span>
      </div>
      <p class="desc" :title="skill.description">{{ skill.description }}</p>
    </div>
  </div>
</template>
