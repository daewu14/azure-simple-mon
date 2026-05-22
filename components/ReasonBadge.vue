<template>
  <UBadge :color="color" variant="soft">{{ reason || '-' }}</UBadge>
</template>

<script setup lang="ts">
const props = defineProps<{ reason: string }>()
const color = computed(() => {
  const r = props.reason || ''
  if (r.includes('+')) return 'violet'
  if (r.includes('Resolved')) return 'success'
  if (r.includes('Release Plan')) return 'error'
  return 'sky'
})
</script>
