<template>
  <div>
    <useHead><title>PBI Ready Release · Sprint Platform Dashboard</title></useHead>

    <!-- Hero + Stats -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
      <div class="lg:col-span-2 bg-slate-900/70 border border-slate-700/40 rounded-2xl p-7">
        <div class="text-orange-400 text-xs font-black uppercase tracking-widest mb-2">Azure DevOps · Product Delivery</div>
        <h1 class="text-3xl md:text-4xl font-black text-white tracking-tight mb-3">PBI Ready Release</h1>
        <p class="text-slate-400 text-sm leading-relaxed mb-4 max-w-xl">
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

      <div class="grid grid-cols-2 gap-3">
        <div v-for="stat in stats" :key="stat.label" class="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4">
          <div class="text-2xl font-black text-white">{{ stat.value }}</div>
          <div class="text-slate-400 text-xs mt-1">{{ stat.label }}</div>
        </div>
      </div>
    </div>


    <!-- Toolbar -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl px-5 py-3 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Sprint</span>
          <select v-model="selectedSprintPath" class="select-dark w-auto" @change="loadData">
            <option v-for="s in sprintOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="w-px h-5 bg-slate-700/50 shrink-0 hidden sm:block" />
        <UInput v-model="searchTerm" type="search" placeholder="Cari ID, title, assignee, state, reason..." size="sm" class="flex-1 min-w-[180px]" />
        <div class="w-px h-5 bg-slate-700/50 shrink-0 hidden sm:block" />
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Reason</span>
          <select v-model="reasonFilter" class="select-dark w-auto">
            <option v-for="o in reasonOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="flex items-center gap-2 ml-auto shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" @click="reset">Reset</UButton>
          <UButton size="sm" color="primary" :loading="copying" @click="copyPbis">
            <UIcon name="i-heroicons-clipboard-document" class="w-3.5 h-3.5 mr-1" />
            Copy PBI List
          </UButton>
        </div>
      </div>
    </div>


    <!-- Table -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
        <h2 class="font-black text-white text-base">PBI Ready Release</h2>
        <span class="text-slate-400 text-sm">{{ filteredPbis.length }} PBI shown</span>
      </div>

      <div v-if="pending" class="p-10 text-center text-slate-400">Loading data...</div>
      <div v-else-if="!filteredPbis.length" class="p-10 text-center text-slate-400">Tidak ada PBI Ready Release.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[1100px]">
          <thead>
            <tr class="border-b border-slate-700/40 bg-slate-950/60">
              <th class="w-12 p-3" />
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">PBI</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">PBI Title</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">State</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Assigned To</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Reason</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Tasks</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">On Review</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Release Plan</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="pbi in filteredPbis" :key="pbi.pbiId">
              <tr
                class="border-b border-slate-800/40 cursor-pointer hover:bg-orange-500/5 transition-colors"
                :class="expandedPbis.has(pbi.pbiId) ? 'bg-orange-500/5' : ''"
                @click="togglePbi(pbi.pbiId)"
              >
                <td class="p-3 text-center">
                  <span class="inline-block transition-transform duration-150 text-slate-400 font-black" :class="expandedPbis.has(pbi.pbiId) ? 'rotate-90' : ''">›</span>
                </td>
                <td class="p-3">
                  <a :href="`${baseWorkItemUrl}${pbi.pbiId}`" target="_blank" class="text-orange-400 hover:text-orange-300 font-bold" @click.stop>#{{ pbi.pbiId }}</a>
                </td>
                <td class="p-3 text-slate-200 max-w-xs">{{ pbi.pbiTitle }}</td>
                <td class="p-3"><StateBadge :state="pbi.pbiState" /></td>
                <td class="p-3 text-slate-300">{{ pbi.pbiAssignedTo || '-' }}</td>
                <td class="p-3"><ReasonBadge :reason="pbi.reason" /></td>
                <td class="p-3"><UBadge color="sky" variant="soft">{{ pbi.taskCount }}</UBadge></td>
                <td class="p-3"><UBadge color="sky" variant="soft">{{ pbi.reviewTaskCount }}</UBadge></td>
                <td class="p-3"><UBadge color="sky" variant="soft">{{ pbi.releasePlanTaskCount }}</UBadge></td>
              </tr>
              <!-- Task expand row -->
              <tr v-if="expandedPbis.has(pbi.pbiId)" :key="`${pbi.pbiId}-tasks`" class="bg-slate-950/40">
                <td colspan="9" class="px-6 py-4">
                  <div class="text-slate-400 text-xs font-black uppercase tracking-wider mb-3">Task dari PBI #{{ pbi.pbiId }}</div>
                  <div v-if="!pbi.tasks?.length" class="text-slate-500 text-sm italic border border-dashed border-slate-700/50 rounded-xl p-4">
                    Belum ada child task untuk PBI ini.
                  </div>
                  <div v-else class="grid gap-2">
                    <div v-for="task in pbi.tasks" :key="task.taskId" class="grid grid-cols-[120px_1fr_160px_200px] gap-3 items-start p-3 bg-slate-900/60 border border-slate-700/30 rounded-xl">
                      <a :href="`${baseWorkItemUrl}${task.taskId}`" target="_blank" class="text-orange-400 hover:text-orange-300 font-bold text-sm" @click.stop>#{{ task.taskId }}</a>
                      <div class="text-slate-200 text-sm leading-snug">{{ task.taskTitle }}</div>
                      <StateBadge :state="task.taskState" />
                      <div class="text-slate-300 text-sm">{{ task.taskAssignedTo || '-' }}</div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

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
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    copying.value = true
    setTimeout(() => { copying.value = false }, 2000)
  } catch {}
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
