<template>
  <div>
    <useHead><title>Progress Minggu Lalu · Sprint Platform Dashboard</title></useHead>

    <!-- Hero -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-7 mb-5">
      <div class="text-orange-400 text-xs font-black uppercase tracking-widest mb-2">Azure DevOps · Product Delivery</div>
      <h1 class="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">Progress Minggu Lalu</h1>
      <p class="text-slate-400 text-sm leading-relaxed mb-4 max-w-2xl">
        Task yang berada di state <b class="text-slate-200">In Progress</b> selama minggu lalu (Senin–Minggu).
        Durasi dihitung sebagai <b class="text-slate-200">jam kerja</b> Senin–Jumat 09:00–17:00.
      </p>
      <div class="flex flex-wrap gap-2">
        <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
        <UBadge v-if="activeSprint" color="neutral" variant="soft">Sprint: <b class="ml-1">{{ activeSprint?.name }}</b></UBadge>
        <UBadge v-if="data?.range" color="neutral" variant="soft">Range: <b class="ml-1">{{ (data.range as Record<string,string>).label }}</b></UBadge>
      </div>
      <UAlert v-if="data?.warning" color="warning" variant="soft" :description="String(data.warning)" class="mt-3" />
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
      <div v-for="stat in progressStats" :key="stat.label" class="bg-slate-900/70 border border-slate-700/40 rounded-xl p-4">
        <div class="text-2xl font-black text-white">{{ stat.value ?? '-' }}</div>
        <div class="text-slate-400 text-xs mt-1">{{ stat.label }}</div>
      </div>
    </div>


    <!-- Toolbar -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl px-5 py-3 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Sprint</span>
          <select v-model="selectedSprintPath" class="select-dark w-auto" @change="loadProgress">
            <option v-for="s in sprintOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="w-px h-5 bg-slate-700/50 shrink-0 hidden sm:block" />
        <UInput v-model="searchTerm" type="search" placeholder="Cari PBI, task, assignee..." size="sm" class="flex-1 min-w-[180px]" />
        <div class="w-px h-5 bg-slate-700/50 shrink-0 hidden sm:block" />
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Status</span>
          <select v-model="statusFilter" class="select-dark w-auto">
            <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="ml-auto shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" :loading="pending" @click="loadProgress">
            <UIcon name="i-heroicons-arrow-path" class="w-3.5 h-3.5 mr-1" />
            Reload
          </UButton>
        </div>
      </div>
    </div>


    <!-- Table -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-700/40">
        <h2 class="font-black text-white text-base">PBI In Progress Minggu Lalu</h2>
        <span class="text-slate-400 text-sm">{{ filteredGroups.length }} PBI shown</span>
      </div>

      <div v-if="pending" class="p-10 text-center text-slate-400">Loading progress...</div>
      <div v-else-if="!filteredGroups.length" class="p-10 text-center text-slate-400">Belum ada task In Progress minggu lalu.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[1100px]">
          <thead>
            <tr class="border-b border-slate-700/40 bg-slate-950/60">
              <th class="w-12 p-3" />
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Parent PBI</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">PBI Title</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">PBI State</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">PBI Assignee</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Task</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Status</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Overlap Range</th>
              <th class="p-3 text-left text-slate-400 text-xs font-black uppercase tracking-wide">Jam Kerja</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(group, gi) in filteredGroups" :key="gi">
              <tr
                class="border-b border-slate-800/40 cursor-pointer hover:bg-orange-500/5 transition-colors"
                :class="expandedGroups.has(gi) ? 'bg-orange-500/5' : 'bg-slate-950/20'"
                @click="toggleGroup(gi)"
              >
                <td class="p-3 text-center">
                  <span class="text-slate-400 font-black transition-transform duration-150 inline-block" :class="expandedGroups.has(gi) ? 'rotate-90' : ''">›</span>
                </td>
                <td class="p-3">
                  <a v-if="group.pbiId" :href="`${baseUrl}${group.pbiId}`" target="_blank" class="text-orange-400 hover:text-orange-300 font-bold" @click.stop>#{{ group.pbiId }}</a>
                  <span v-else class="text-slate-500">-</span>
                </td>
                <td class="p-3 text-slate-200 max-w-xs">{{ group.pbiTitle }}</td>
                <td class="p-3"><StateBadge :state="String(group.pbiState || '')" /></td>
                <td class="p-3 text-slate-300">{{ group.pbiAssignedTo || '-' }}</td>
                <td class="p-3"><UBadge color="amber" variant="soft">{{ group.taskCount }} task</UBadge></td>
                <td class="p-3">
                  <UBadge v-if="group.stillInProgress" color="sky" variant="soft">{{ group.stillInProgress }} masih In Progress</UBadge>
                  <UBadge v-else color="success" variant="soft">Semua sudah pindah</UBadge>
                </td>
                <td class="p-3 text-slate-400 text-xs">{{ fmtDateTime(String(group.firstOverlapStart)) }} → {{ fmtDateTime(String(group.lastOverlapEnd)) }}</td>
                <td class="p-3"><UBadge color="amber" variant="soft">{{ group.durationHours }} jam</UBadge></td>
              </tr>
              <!-- Task rows -->
              <template v-if="expandedGroups.has(gi)">
                <tr v-for="task in (group.tasks as Record<string,unknown>[])" :key="String(task.taskId)" class="border-b border-slate-800/20 bg-slate-950/40">
                  <td class="p-3" />
                  <td class="p-3" />
                  <td class="p-3" />
                  <td class="p-3" />
                  <td class="p-3" />
                  <td class="p-3 pl-8">
                    <span class="text-slate-500 mr-1">↳</span>
                    <a :href="`${baseUrl}${task.taskId}`" target="_blank" class="text-orange-400 hover:text-orange-300 font-bold" @click.stop>#{{ task.taskId }}</a>
                    <span class="text-slate-300 ml-2 text-xs">{{ task.taskTitle }}</span>
                  </td>
                  <td class="p-3">
                    <StateBadge :state="String(task.taskState || '')" />
                    <UBadge v-if="task.stillInProgress" color="sky" variant="soft" class="ml-1 text-xs">Masih In Progress</UBadge>
                    <UBadge v-else color="success" variant="soft" class="ml-1 text-xs">Sudah pindah</UBadge>
                  </td>
                  <td class="p-3 text-slate-400 text-xs">{{ fmtDateTime(String(task.overlapStart)) }} → {{ fmtDateTime(String(task.overlapEnd)) }}</td>
                  <td class="p-3"><UBadge color="amber" variant="soft">{{ task.durationHours }} jam</UBadge></td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </div>
    </div>

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
