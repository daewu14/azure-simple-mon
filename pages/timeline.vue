<template>
  <div>
    <useHead><title>Timeline Gantt Chart · Sprint Platform Dashboard</title></useHead>

    <!-- Hero -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-7 mb-5">
      <div class="text-orange-400 text-xs font-black uppercase tracking-widest mb-2">Azure DevOps · Product Delivery</div>
      <h1 class="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">Timeline Gantt Chart Task</h1>
      <p class="text-slate-400 text-sm leading-relaxed mb-4 max-w-2xl">
        Monitor perubahan state task: <b class="text-slate-200">In Progress</b> → <b class="text-slate-200">On Review QA</b> → <b class="text-slate-200">On Review Product</b> → <b class="text-slate-200">Release Plan</b> → <b class="text-slate-200">Released</b>.
      </p>
      <div class="flex flex-wrap gap-2">
        <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
        <UBadge v-if="activeSprint" color="neutral" variant="soft">Sprint: <b class="ml-1">{{ activeSprint?.name }}</b></UBadge>
      </div>
      <UAlert v-if="data?.warning" color="warning" variant="soft" :description="String(data.warning)" class="mt-3" />
    </div>

    <!-- Toolbar -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl px-5 py-3 mb-5">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Sprint</span>
          <select v-model="selectedSprintPath" class="select-dark w-auto" @change="loadTimeline">
            <option v-for="s in sprintOptions" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="w-px h-5 bg-slate-700/50 shrink-0 hidden sm:block" />
        <div class="flex items-center gap-2 shrink-0 relative" data-state-dropdown>
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">State</span>
          <button
            type="button"
            class="select-dark w-auto min-w-[160px] flex items-center justify-between gap-2"
            style="background-image:none; padding-right:0.75rem;"
            @click="stateDropdownOpen = !stateDropdownOpen"
          >
            <span class="truncate text-sm">{{ stateFilterSummary }}</span>
            <svg class="w-4 h-4 flex-shrink-0 text-slate-400 transition-transform duration-150" :class="stateDropdownOpen ? 'rotate-180' : ''" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor">
              <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
            </svg>
          </button>
          <div v-if="stateDropdownOpen" class="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl p-2 min-w-[200px]">
            <div class="flex gap-2 pb-2 mb-2 border-b border-slate-700/40">
              <button type="button" class="flex-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/60 rounded-lg px-2 py-1.5" @click="selectAllStates">Pilih Semua</button>
              <button type="button" class="flex-1 text-xs font-bold text-slate-300 hover:text-white bg-slate-800/60 rounded-lg px-2 py-1.5" @click="clearAllStates">Kosongkan</button>
            </div>
            <label v-for="state in allStates" :key="state" class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-800/60 cursor-pointer text-slate-200 text-sm">
              <input type="checkbox" :value="state" :checked="selectedStates.includes(state)" class="accent-orange-500 w-4 h-4" @change="toggleState(state)" />
              {{ state }}
            </label>
          </div>
        </div>
        <div class="ml-auto shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" :loading="pending" @click="loadTimeline">
            <UIcon name="i-heroicons-arrow-path" class="w-3.5 h-3.5 mr-1" />
            Reload
          </UButton>
        </div>
      </div>
    </div>


    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
      <div v-for="stat in timelineStats" :key="stat.label" class="bg-slate-900/70 border border-slate-700/40 rounded-xl p-4">
        <div class="text-2xl font-black text-white">{{ stat.value ?? '-' }}</div>
        <div class="text-slate-400 text-xs mt-1">{{ stat.label }}</div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-4 mb-4 px-1">
      <span v-for="s in stateLegend" :key="s.label" class="flex items-center gap-2 text-slate-400 text-xs">
        <span class="w-3 h-3 rounded-full" :style="{ background: s.color }" />
        {{ s.label }}
      </span>
    </div>

    <!-- Gantt -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl overflow-hidden">
      <div class="px-5 py-4 border-b border-slate-700/40">
        <h2 class="font-black text-white">Gantt Timeline</h2>
        <p class="text-slate-400 text-xs mt-1">Bar dari history/revision Azure DevOps setiap task.</p>
      </div>
      <div v-if="pending" class="p-10 text-center text-slate-400">Loading timeline...</div>
      <div v-else-if="!ganttItems.length" class="p-10 text-center text-slate-400">Belum ada task dengan history timeline untuk filter yang dipilih.</div>
      <div v-else class="overflow-auto max-h-[640px]">
        <div class="min-w-[1000px]">
          <!-- Scale header -->
          <div class="grid border-b border-slate-800/40 bg-slate-950/80 sticky top-0 z-10" style="grid-template-columns: 320px 1fr">
            <div class="px-4 py-3 text-slate-400 text-xs font-black uppercase tracking-wide border-r border-slate-800/40">Task</div>
            <div class="relative px-4 py-3 min-h-[44px]">
              <span v-for="(tick, i) in ticks" :key="i" class="gantt-tick" :style="{ left: tick.pct + '%' }">{{ tick.label }}</span>
            </div>
          </div>
          <!-- Rows -->
          <div v-for="item in ganttItems" :key="item.taskId" :class="['grid border-b border-slate-800/30 hover:bg-orange-500/10 transition-colors cursor-default', item.groupBgClass]" style="grid-template-columns: 320px 1fr">
            <div class="px-4 py-3 border-r border-slate-800/40">
              <div class="font-bold text-sm text-slate-200 leading-snug">
                <a :href="`${baseUrl}${item.taskId}`" target="_blank" class="text-orange-400 hover:text-orange-300">#{{ item.taskId }}</a>
                {{ item.taskTitle }}
              </div>
              <div class="text-slate-500 text-xs mt-1">{{ item.taskAssignedTo || '-' }} · {{ item.taskState || '-' }}<span v-if="item.cycleDays != null"> · {{ item.cycleDays }}d cycle</span></div>
            </div>
            <div class="relative min-h-[56px] px-4 py-3">
              <div
                v-for="(seg, si) in item.segments"
                :key="si"
                class="gantt-bar"
                :class="`gantt-bar-${stateClass(seg.state)}`"
                :style="{ left: segLeft(seg) + '%', width: Math.max(0.5, segWidth(seg)) + '%' }"
                :title="`${seg.state}: ${fmtDate(seg.start)} - ${fmtDate(seg.end)}`"
              >
                <span class="gantt-bar-label">{{ seg.state }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-slate-600 text-xs text-right mt-3">Generated: {{ data?.generatedAt || '-' }}</div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Timeline Gantt Chart · Sprint Platform Dashboard' })

const { selectedTeam } = useTeam()
const baseUrl = 'https://dev.azure.com/KiriminAja2026/Product%20Delivery/_workitems/edit/'

const sprints = ref<{ name: string; path: string; timeFrame: string }[]>([])
const selectedSprintPath = ref('')
const data = ref<Record<string, unknown> | null>(null)
const pending = ref(true)
const selectedStates = ref<string[]>([])
const stateDropdownOpen = ref(false)

const stateFilterSummary = computed(() => {
  if (!selectedStates.value.length || selectedStates.value.length === allStates.value.length) return 'Semua State'
  if (selectedStates.value.length === 1) return selectedStates.value[0]
  return `${selectedStates.value.length} State dipilih`
})

function toggleState(state: string) {
  const idx = selectedStates.value.indexOf(state)
  if (idx === -1) selectedStates.value.push(state)
  else selectedStates.value.splice(idx, 1)
}
function selectAllStates() { selectedStates.value = [...allStates.value] }
function clearAllStates() { selectedStates.value = [] }

// Close dropdown when clicking outside
if (import.meta.client) {
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-state-dropdown]')) stateDropdownOpen.value = false
  })
}

const activeSprint = computed(() => sprints.value.find((s) => s.path === selectedSprintPath.value))

const sprintOptions = computed(() => sprints.value.map((s) => ({ label: s.name + (s.timeFrame ? ` (${s.timeFrame})` : ''), value: s.path })))

const allItems = computed(() => (data.value?.items as Record<string, unknown>[]) || [])
const allStates = computed(() => [...new Set(allItems.value.map((i) => String(i.taskState || '')).filter(Boolean))])

const ganttItems = computed(() => {
  const items = allItems.value.filter((i) => (i.segments as unknown[]).length > 0)
  const filtered = selectedStates.value.length
    ? items.filter((i) => selectedStates.value.includes(String(i.taskState)))
    : items

  // Sort by assignee so they are grouped together
  const sorted = [...filtered].sort((a, b) => {
    const aName = String(a.taskAssignedTo || 'Unassigned').toLowerCase()
    const bName = String(b.taskAssignedTo || 'Unassigned').toLowerCase()
    if (aName === bName) return String(a.taskId).localeCompare(String(b.taskId))
    return aName.localeCompare(bName)
  })

  // Assign alternating background classes based on assignee group
  let currentAssignee = null
  let colorIndex = 0

  return sorted.map((item) => {
    const assignee = String(item.taskAssignedTo || 'Unassigned')
    if (assignee !== currentAssignee) {
      currentAssignee = assignee
      colorIndex = 1 - colorIndex
    }
    return {
      ...item,
      groupBgClass: colorIndex === 0 ? 'bg-transparent' : 'bg-white/5'
    }
  })
})

const stateLegend = [
  { label: 'In Progress', color: '#38bdf8' },
  { label: 'On Review QA', color: '#fbbf24' },
  { label: 'On Review Product', color: '#c084fc' },
  { label: 'Release Plan', color: '#fb7185' },
  { label: 'Released', color: '#34d399' },
]

const timelineStats = computed(() => {
  const s = (data.value?.stats as Record<string, unknown>) || {}
  return [
    { label: 'Total task', value: s.totalTasks },
    { label: 'Task ada timeline', value: s.tasksWithTimeline },
    { label: 'Task released', value: s.releasedTasks },
    { label: 'Avg cycle days', value: s.avgCycleDays },
  ]
})

// Gantt scale/ticks
const timeRange = computed(() => {
  const segs = ganttItems.value.flatMap((i) => (i.segments as { start: string; end: string }[]))
  if (!segs.length) return { min: Date.now(), max: Date.now() + 1 }
  const min = Math.min(...segs.map((s) => new Date(s.start).getTime()))
  const max = Math.max(...segs.map((s) => new Date(s.end).getTime()))
  return { min, max: max > min ? max : min + 1 }
})

const ticks = computed(() =>
  Array.from({ length: 5 }, (_, i) => ({
    pct: i * 25,
    label: new Date(timeRange.value.min + (timeRange.value.max - timeRange.value.min) * i / 4).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
  }))
)

function pct(v: number) { return Math.max(0, Math.min(100, v)) }
function segLeft(seg: { start: string }) { return pct(((new Date(seg.start).getTime() - timeRange.value.min) / (timeRange.value.max - timeRange.value.min)) * 100) }
function segWidth(seg: { start: string; end: string }) { return pct(((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / (timeRange.value.max - timeRange.value.min)) * 100) }
function stateClass(state: string) {
  if (state === 'In Progress') return 'progress'
  if (state === 'On Review QA') return 'qa'
  if (state === 'On Review Product') return 'product'
  if (state === 'Release Plan') return 'plan'
  return 'released'
}
function fmtDate(v: string) { return new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }

async function loadTimeline() {
  pending.value = true
  try {
    data.value = await $fetch('/api/timeline', { query: { team: selectedTeam.value, sprintPath: selectedSprintPath.value } }) as Record<string, unknown>
  } finally {
    pending.value = false
  }
}

watch(selectedTeam, () => loadTimeline())

onMounted(async () => {
  try {
    const res = await $fetch<{ sprints: typeof sprints.value }>('/api/sprints', { query: { team: selectedTeam.value } })
    sprints.value = res.sprints || []
    const current = sprints.value.find((s) => s.timeFrame === 'current') || sprints.value[0]
    if (current) selectedSprintPath.value = current.path
  } catch {}
  await loadTimeline()
})
</script>
