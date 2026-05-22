<template>
  <UBadge :color="color" variant="soft">{{ state || '-' }}</UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{ state: string }>()
const color = computed(() => {
  const s = props.state || ''
  if (s === 'Resolved' || s === 'Released' || s === 'Done' || s === 'Closed') return 'success'
  if (s === 'In Progress') return 'sky'
  if (s.includes('Review') || s === 'Release Plan') return 'violet'
  return 'neutral'
})
</script>
