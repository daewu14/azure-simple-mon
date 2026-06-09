<template>
  <div>
    <useHead><title>Progress Minggu Lalu · Sprint Platform Dashboard</title></useHead>

    <!-- Hero -->
    <UCard class="mb-4" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
      <div class="flex items-start justify-between gap-4 cursor-pointer select-none" @click="isHeroExpanded = !isHeroExpanded">
        <div>
          <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · Product Delivery</div>
          <h1 class="text-2xl font-bold text-white">Sprint Progress Tracker</h1>
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
        <p class="text-slate-400 text-sm mb-3 max-w-2xl leading-relaxed">
          Monitor PBI dan Task harian dari anggota tim. Progress harian dihitung berdasarkan capacity jam kerja.
        </p>
        <div class="flex flex-wrap gap-2">
          <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
          <UBadge v-if="activeSprint" color="neutral" variant="soft">Sprint: <b class="ml-1">{{ activeSprint?.name }}</b></UBadge>
        </div>
        <UAlert v-if="data?.warning" color="warning" variant="soft" :description="String(data.warning)" class="mt-3" />
      </div>
    </UCard>

    <!-- Stats -->
    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mb-4">
      <div v-for="stat in progressStats" :key="stat.label" class="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 flex flex-col justify-center transition-all hover:bg-slate-800/80">
        <div class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 leading-tight">{{ stat.label }}</div>
        <div class="text-2xl font-black text-white leading-none">{{ stat.value ?? '-' }}</div>
      </div>
    </div>


    <!-- Toolbar -->
    <UCard class="mb-4" :ui="{ body: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Sprint</span>
          <USelect v-model="selectedSprintPath" :items="sprintOptions" @change="loadProgress" />
        </div>
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />
        <UInput v-model="searchTerm" icon="i-heroicons-magnifying-glass" type="search" placeholder="Cari PBI, task, assignee..." size="sm" class="flex-1 min-w-[180px]" />
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Status</span>
          <USelect v-model="statusFilter" :items="statusOptions" />
        </div>
        <div class="ml-auto shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" :loading="pending" icon="i-heroicons-arrow-path" @click="loadProgress">
            Reload
          </UButton>
        </div>
      </div>
    </UCard>


    <!-- Table -->
    <UCard :ui="{ body: { padding: 'p-0 sm:p-0' }, header: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-white text-sm">PBI In Progress Minggu Lalu</h2>
          <span class="text-slate-400 text-xs">{{ filteredGroups.length }} PBI shown</span>
        </div>
      </template>

      <div v-if="pending" class="p-10 text-center text-slate-400">Loading progress...</div>
      <div v-else-if="!filteredGroups.length" class="p-10 text-center text-slate-400">Belum ada task In Progress minggu lalu.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[1100px]">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/50">
              <th class="w-10 px-3 py-2" />
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Parent PBI</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">PBI Title</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">PBI State</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">PBI Assignee</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Task</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Status</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Overlap Range</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Jam Kerja</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, gi) in filteredGroups" :key="gi">
              <tr
                class="border-b border-slate-800/60 cursor-pointer hover:bg-primary-500/5 transition-colors"
                :class="expandedGroups.has(gi) ? 'bg-primary-500/5' : ''"
                @click="toggleGroup(gi)"
              >
                <td class="px-3 py-2 text-center">
                  <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 transition-transform duration-150 text-slate-400" :class="expandedGroups.has(gi) ? 'rotate-90' : ''" />
                </td>
                <td class="px-3 py-2">
                  <a v-if="group.pbiId" :href="`${baseUrl}${group.pbiId}`" target="_blank" class="text-primary-400 hover:text-primary-300 font-bold" @click.stop>#{{ group.pbiId }}</a>
                  <span v-else class="text-slate-500">-</span>
                </td>
                <td class="px-3 py-2 text-slate-200 max-w-xs">{{ group.pbiTitle }}</td>
                <td class="px-3 py-2"><StateBadge :state="String(group.pbiState || '')" /></td>
                <td class="px-3 py-2 text-slate-300 text-xs">{{ group.pbiAssignedTo || '-' }}</td>
                <td class="px-3 py-2"><UBadge color="amber" variant="soft">{{ group.taskCount }} task</UBadge></td>
                <td class="px-3 py-2 text-xs">
                  <UBadge v-if="group.stillInProgress" color="sky" variant="soft">{{ group.stillInProgress }} masih In Progress</UBadge>
                  <UBadge v-else color="success" variant="soft">Semua sudah pindah</UBadge>
                </td>
                <td class="px-3 py-2 text-slate-400 text-[11px] whitespace-nowrap">{{ fmtDateTime(String(group.firstOverlapStart)) }} → {{ fmtDateTime(String(group.lastOverlapEnd)) }}</td>
                <td class="px-3 py-2"><UBadge color="amber" variant="soft">{{ fmtDuration(group.durationHours) }}</UBadge></td>
              </tr>
              <!-- Task rows -->
              <template v-if="expandedGroups.has(gi)">
                <tr v-for="task in (group.tasks as Record<string,unknown>[])" :key="String(task.taskId)" class="border-b border-slate-800/40 bg-slate-900/40">
                  <td class="px-3 py-2" />
                  <td class="px-3 py-2" />
                  <td class="px-3 py-2" />
                  <td class="px-3 py-2" />
                  <td class="px-3 py-2 text-slate-400 text-xs">{{ task.taskAssignedTo || '-' }}</td>
                  <td class="px-3 py-2 pl-6">
                    <span class="text-slate-500 mr-1">↳</span>
                    <a :href="`${baseUrl}${task.taskId}`" target="_blank" class="text-primary-400 hover:text-primary-300 font-medium" @click.stop>#{{ task.taskId }}</a>
                    <span class="text-slate-300 ml-2 text-xs">{{ task.taskTitle }}</span>
                  </td>
                  <td class="px-3 py-2">
                    <StateBadge :state="String(task.taskState || '')" class="scale-90 origin-left" />
                    <UBadge v-if="task.stillInProgress" color="sky" variant="soft" class="ml-1 text-[10px] mb-1">Masih In Progress</UBadge>
                    <UBadge v-else color="success" variant="soft" class="ml-1 text-[10px] mb-1">Sudah pindah</UBadge>
                    <div class="mt-1 flex items-center gap-1 flex-wrap">
                      <span v-if="task.effortPoint" class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">Effort Point: {{ task.effortPoint }}</span>
                      <template v-if="task.isWithinTarget !== null">
                        <span v-if="task.isWithinTarget" class="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400">Dalam Target</span>
                        <span v-else class="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">Melebihi Target</span>
                      </template>
                    </div>
                  </td>
                  <td class="px-3 py-2 text-slate-400 text-[11px] whitespace-nowrap">{{ fmtDateTime(String(task.overlapStart)) }} → {{ fmtDateTime(String(task.overlapEnd)) }}</td>
                  <td class="px-3 py-2"><UBadge color="amber" variant="soft">{{ fmtDuration(task.durationHours) }}</UBadge></td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="text-slate-600 text-xs text-right mt-3">Generated: {{ data?.generatedAt || '-' }}</div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Progress Minggu Lalu · Sprint Platform Dashboard' })

const { selectedTeam } = useTeam()
const baseUrl = 'https://dev.azure.com/KiriminAja2026/Product%20Delivery/_workitems/edit/'

const sprints = ref<{ name: string; path: string; timeFrame: string }[]>([])
const selectedSprintPath = ref('')
const data = ref<Record<string, unknown> | null>(null)
const pending = ref(true)
const expandedGroups = ref(new Set<number>())
const searchTerm = ref('')
const statusFilter = ref('all')
const isHeroExpanded = ref(true)
onMounted(() => {
  const stored = localStorage.getItem('progressHeroExpanded')
  if (stored !== null) isHeroExpanded.value = stored === 'true'
})
watch(isHeroExpanded, (val) => {
  localStorage.setItem('progressHeroExpanded', String(val))
})
const activeSprint = computed(() => sprints.value.find((s) => s.path === selectedSprintPath.value))

const sprintOptions = computed(() => sprints.value.map((s) => ({ label: s.name + (s.timeFrame ? ` (${s.timeFrame})` : ''), value: s.path })))

const statusOptions = [
  { label: 'Semua', value: 'all' },
  { label: 'Ada task masih In Progress', value: 'still' },
  { label: 'Semua task sudah pindah', value: 'moved' },
]

const groups = computed(() => (data.value?.pbiGroups as Record<string, unknown>[]) || [])

const filteredGroups = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  const mode = statusFilter.value
  return groups.value.filter((g) => {
    const hay = [g.pbiId, g.pbiTitle, g.pbiState, g.pbiAssignedTo, ...(g.tasks as Record<string, unknown>[] || []).map((t) => `${t.taskId} ${t.taskTitle} ${t.taskAssignedTo} ${t.taskState}`)].join(' ').toLowerCase()
    const matchTerm = !term || hay.includes(term)
    const matchStatus = mode === 'all' || (mode === 'still' && (g.stillInProgress as number) > 0) || (mode === 'moved' && !(g.stillInProgress as number))
    return matchTerm && matchStatus
  })
})

const progressStats = computed(() => {
  const s = (data.value?.stats as Record<string, unknown>) || {}
  return [
    { label: 'Task scanned', value: s.totalTasksScanned },
    { label: 'Task In Progress minggu lalu', value: s.inProgressTasks },
    { label: 'Masih In Progress', value: s.stillInProgress },
    { label: 'Total jam kerja', value: s.totalHours },
    { label: 'Avg jam / task', value: s.avgHours },
    { label: 'Assignee', value: s.assignees },
    { label: 'Total Effort Point', value: s.totalEffort },
  ]
})

function toggleGroup(gi: number) {
  if (expandedGroups.value.has(gi)) expandedGroups.value.delete(gi)
  else expandedGroups.value.add(gi)
}

function fmtDateTime(v: string) {
  if (!v) return '-'
  return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtDuration(hours: unknown) {
  const h = Number(hours) || 0
  if (h > 0 && h < 1) {
    const m = Math.round(h * 60)
    return `${h} jam (${m} menit)`
  }
  return `${h} jam`
}

async function loadProgress() {
  pending.value = true
  expandedGroups.value.clear()
  try {
    data.value = await $fetch('/api/progress', { query: { team: selectedTeam.value, sprintPath: selectedSprintPath.value } }) as Record<string, unknown>
  } finally {
    pending.value = false
  }
}

watch(selectedTeam, () => loadProgress())

onMounted(async () => {
  try {
    const res = await $fetch<{ sprints: typeof sprints.value }>('/api/sprints', { query: { team: selectedTeam.value } })
    sprints.value = res.sprints || []
    const current = sprints.value.find((s) => s.timeFrame === 'current') || sprints.value[0]
    if (current) selectedSprintPath.value = current.path
  } catch {}
  await loadProgress()
})
</script>
