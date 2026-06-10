<template>
  <div>
    <!-- Hero + Stats -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4 items-start">
      <UCard class="lg:col-span-2" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
        <div class="flex items-start justify-between gap-4 cursor-pointer select-none" @click="isHeroExpanded = !isHeroExpanded">
          <div>
            <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · Product Delivery</div>
            <h1 class="text-2xl font-bold text-white">PBI Ready Release</h1>
          </div>
          <UButton
            icon="i-heroicons-chevron-down"
            color="neutral"
            variant="ghost"
            size="sm"
            :class="['transition-transform duration-300', isHeroExpanded ? 'rotate-180' : '']"
            @click.stop="isHeroExpanded = !isHeroExpanded"
          />
        </div>
        <div :class="['transition-all duration-300 ease-in-out overflow-hidden', isHeroExpanded ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0']">
          <p class="text-slate-400 text-sm mb-3 max-w-xl leading-relaxed">
            List Product Backlog Item yang siap release: PBI Resolved, task On Review Product, atau task Release Plan.
            Klik baris PBI untuk expand/collapse child task.
          </p>
          <div class="flex flex-wrap gap-2">
            <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
            <UBadge v-if="activeSprint" color="neutral" variant="soft">Sprint: <b class="ml-1">{{ activeSprint?.name }}</b></UBadge>
            <UBadge v-if="data?.stats" color="neutral" variant="soft">PBI in sprint: <b class="ml-1">{{ data.stats.pbiInSprint }}</b></UBadge>
          </div>
          <UAlert v-if="data?.warning" color="warning" variant="soft" :description="data.warning" class="mt-3" />
        </div>
      </UCard>

      <div class="grid grid-cols-2 gap-3 h-fit">
        <div v-for="stat in stats" :key="stat.label" class="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center transition-all hover:bg-slate-800/80">
          <div class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 leading-tight">{{ stat.label }}</div>
          <div class="text-2xl font-black text-white leading-none">{{ stat.value ?? '-' }}</div>
        </div>
      </div>
    </div>


    <!-- Toolbar -->
    <UCard class="mb-4" :ui="{ body: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Sprint</span>
          <USelect v-model="selectedSprintPath" :items="sprintOptions" @change="loadData" />
        </div>
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />
        <UInput v-model="searchTerm" icon="i-heroicons-magnifying-glass" type="search" placeholder="Cari ID, title, assignee..." size="sm" class="flex-1 min-w-[180px]" />
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Reason</span>
          <USelect v-model="reasonFilter" :items="reasonOptions" />
        </div>
        <div class="flex items-center gap-2 ml-auto shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" @click="reset">Reset</UButton>
          <UButton size="sm" color="primary" :loading="copying" icon="i-heroicons-clipboard-document" @click="copyPbis">
            Copy PBI List
          </UButton>
        </div>
      </div>
    </UCard>


    <!-- Table -->
    <UCard :ui="{ body: { padding: 'p-0 sm:p-0' }, header: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-white text-sm">PBI Ready Release</h2>
          <span class="text-slate-400 text-xs">{{ filteredPbis.length }} PBI shown</span>
        </div>
      </template>      <div v-if="pending" class="p-10 text-center text-slate-400">Loading data...</div>
      <div v-else-if="!filteredPbis.length" class="p-10 text-center text-slate-400">Tidak ada PBI Ready Release.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[1100px]">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/50">
              <th class="w-10 px-3 py-2" />
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">PBI</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">PBI Title</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">State</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Assigned To</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Reason</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Tasks</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">On Review</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Release Plan</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="pbi in filteredPbis" :key="pbi.pbiId">
              <tr
                class="border-b border-slate-800/60 cursor-pointer hover:bg-primary-500/5 transition-colors"
                :class="expandedPbis.has(pbi.pbiId) ? 'bg-primary-500/5' : ''"
                @click="togglePbi(pbi.pbiId)"
              >
                <td class="px-3 py-2 text-center">
                  <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 transition-transform duration-150 text-slate-400" :class="expandedPbis.has(pbi.pbiId) ? 'rotate-90' : ''" />
                </td>
                <td class="px-3 py-2">
                  <a :href="`${baseWorkItemUrl}${pbi.pbiId}`" target="_blank" class="text-primary-400 hover:text-primary-300 font-bold" @click.stop>#{{ pbi.pbiId }}</a>
                </td>
                <td class="px-3 py-2 text-slate-200 max-w-xs">{{ pbi.pbiTitle }}</td>
                <td class="px-3 py-2"><StateBadge :state="pbi.pbiState" /></td>
                <td class="px-3 py-2 text-slate-300 text-xs">{{ pbi.pbiAssignedTo || '-' }}</td>
                <td class="px-3 py-2"><ReasonBadge :reason="pbi.reason" /></td>
                <td class="px-3 py-2 text-xs">
                  <UBadge color="neutral" variant="soft">{{ pbi.tasks.length }}</UBadge>
                </td>
                <td class="px-3 py-2 text-xs">
                  <UBadge v-if="pbi.reviewTaskCount" color="primary" variant="soft">{{ pbi.reviewTaskCount }}</UBadge>
                  <span v-else class="text-slate-600">-</span>
                </td>
                <td class="px-3 py-2 text-xs">
                  <UBadge v-if="pbi.releasePlanTaskCount" color="purple" variant="soft">{{ pbi.releasePlanTaskCount }}</UBadge>
                  <span v-else class="text-slate-600">-</span>
                </td>
              </tr>
              <!-- Child Tasks (Expanded) -->
              <tr v-if="expandedPbis.has(pbi.pbiId)" class="bg-slate-900/40 border-b border-slate-800/60">
                <td colspan="9" class="p-0">
                  <div class="px-8 py-3 bg-slate-950/30">
                    <table class="w-full text-xs">
                      <tbody>
                        <tr v-for="task in pbi.tasks" :key="task.taskId" class="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition-colors">
                          <td class="px-3 py-2 w-24">
                            <span class="text-slate-500 mr-1">↳</span>
                            <a :href="`${baseWorkItemUrl}${task.taskId}`" target="_blank" class="text-primary-400 hover:text-primary-300 font-medium" @click.stop>#{{ task.taskId }}</a>
                          </td>
                          <td class="px-3 py-2 text-slate-300">{{ task.taskTitle }}</td>
                          <td class="px-3 py-2 w-32"><StateBadge :state="task.taskState" class="scale-90 origin-left" /></td>
                          <td class="px-3 py-2 w-48 text-slate-400">{{ task.taskAssignedTo || '-' }}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="text-slate-600 text-xs text-right mt-3">Generated: {{ data?.generatedAt || '-' }}</div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'PBI Ready Release · Sprint Platform Dashboard' })

const { selectedTeam } = useTeam()
const config = useRuntimeConfig()
const baseWorkItemUrl = `https://dev.azure.com/${config.public.defaultTeam ? '' : ''}` // set via API

const sprints = ref<{ name: string; path: string; timeFrame: string }[]>([])
const selectedSprintPath = ref('')
const data = ref<Record<string, unknown> | null>(null)
const pending = ref(true)
const expandedPbis = ref(new Set<number>())
const searchTerm = ref('')
const reasonFilter = ref('all')
const copying = ref(false)
const activeSprint = computed(() => sprints.value.find((s) => s.path === selectedSprintPath.value))

const reasonOptions = [
  { label: 'Semua reason', value: 'all' },
  { label: 'PBI Resolved', value: 'pbi' },
  { label: 'Task On Review Product', value: 'review' },
  { label: 'Task Release Plan', value: 'plan' },
  { label: 'Kombinasi reason', value: 'combo' },
]

const sprintOptions = computed(() => sprints.value.map((s) => ({ label: s.name + (s.timeFrame ? ` (${s.timeFrame})` : ''), value: s.path })))

const isHeroExpanded = ref(true)
onMounted(() => {
  const stored = localStorage.getItem('dashboardHeroExpanded')
  if (stored !== null) isHeroExpanded.value = stored === 'true'
})
watch(isHeroExpanded, (val) => {
  localStorage.setItem('dashboardHeroExpanded', String(val))
})

const pbis = computed(() => (data.value?.pbis as Record<string, unknown>[]) || [])

const filteredPbis = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  const mode = reasonFilter.value
  return pbis.value.filter((pbi) => {
    const hay = [pbi.pbiId, pbi.pbiTitle, pbi.pbiState, pbi.pbiAssignedTo, pbi.reason, ...(pbi.tasks as { taskTitle: string; taskAssignedTo: string; taskState: string }[] || []).map((t) => `${t.taskTitle} ${t.taskAssignedTo} ${t.taskState}`)].join(' ').toLowerCase()
    const matchTerm = !term || hay.includes(term)
    const reason = String(pbi.reason || '')
    const matchReason = mode === 'all' || (mode === 'pbi' && reason.includes('PBI Resolved')) || (mode === 'review' && reason.includes('On Review Product')) || (mode === 'plan' && reason.includes('Release Plan')) || (mode === 'combo' && reason.includes('+'))
    return matchTerm && matchReason
  })
})

const stats = computed(() => {
  const s = (data.value?.stats as Record<string, number>) || {}
  return [
    { label: 'PBI Ready Release', value: s.readyReleasePbis ?? '-' },
    { label: 'PBI Resolved', value: s.resolvedPbis ?? '-' },
    { label: 'On Review Product', value: s.reviewTasks ?? '-' },
    { label: 'Release Plan', value: s.releasePlanTasks ?? '-' },
  ]
})

function togglePbi(id: number) {
  if (expandedPbis.value.has(id)) expandedPbis.value.delete(id)
  else expandedPbis.value.add(id)
}

async function loadData() {
  pending.value = true
  try {
    data.value = await $fetch('/api/data', { query: { team: selectedTeam.value, sprintPath: selectedSprintPath.value } }) as Record<string, unknown>
  } finally {
    pending.value = false
  }
}

function reset() { searchTerm.value = ''; reasonFilter.value = 'all' }

async function copyPbis() {
  const ado = `https://dev.azure.com/KiriminAja2026/Product%20Delivery/_workitems/edit/`
  const lines = ['PBI Ready Release', ...filteredPbis.value.map((p, i) => `${i + 1}. Product backlog Item ${p.pbiId}:(${ado}${p.pbiId}) ${p.pbiTitle}`)]
  const text = lines.join('\n')

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
    } else {
      // Fallback for non-secure contexts (e.g. HTTP network IP)
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.focus()
      textArea.select()
      const success = document.execCommand('copy')
      textArea.remove()
      if (!success) throw new Error('Fallback copy failed')
    }
    copying.value = true
    setTimeout(() => { copying.value = false }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
    alert('Gagal copy ke clipboard. Pastikan browser mendukung fitur copy atau gunakan localhost/HTTPS.')
  }
}

watch(selectedTeam, () => { loadData() })

onMounted(async () => {
  try {
    const res = await $fetch<{ sprints: typeof sprints.value }>('/api/sprints', { query: { team: selectedTeam.value } })
    sprints.value = res.sprints || []
    const current = sprints.value.find((s) => s.timeFrame === 'current') || sprints.value[0]
    if (current) selectedSprintPath.value = current.path
  } catch {}
  await loadData()
})
</script>
