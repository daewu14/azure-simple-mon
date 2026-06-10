<template>
  <div>

    <!-- Hero -->
    <UCard class="mb-4" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
      <div class="flex items-start justify-between gap-4 cursor-pointer select-none" @click="isHeroExpanded = !isHeroExpanded">
        <div>
          <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · Product Delivery</div>
          <h1 class="text-2xl font-bold text-white">Timeline Gantt Chart Task</h1>
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
          Monitor perubahan state task: <b class="text-slate-200">In Progress</b> → <b class="text-slate-200">On Review QA</b> → <b class="text-slate-200">On Review Product</b> → <b class="text-slate-200">Release Plan</b> → <b class="text-slate-200">Released</b>.
        </p>
        <div class="flex flex-wrap gap-2">
          <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
          <UBadge v-if="activeSprint" color="neutral" variant="soft">Sprint: <b class="ml-1">{{ activeSprint?.name }}</b></UBadge>
        </div>
        <UAlert v-if="data?.warning" color="warning" variant="soft" :description="String(data.warning)" class="mt-3" />
      </div>
    </UCard>

    <!-- Toolbar -->
    <UCard class="mb-4" :ui="{ body: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Sprint</span>
          <USelect v-model="selectedSprintPath" :items="sprintOptions" @change="loadTimeline" />
        </div>
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />
        <div class="flex items-center gap-2 shrink-0 relative">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">State</span>
          <USelectMenu v-model="selectedStates" :items="allStates" multiple class="min-w-[160px]" :ui="{ container: 'z-[110]' }">
            <template #label>
              <span class="truncate">{{ stateFilterSummary }}</span>
            </template>
          </USelectMenu>
        </div>
        
        <div class="flex items-center gap-2 shrink-0 relative">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Assignee</span>
          <USelectMenu v-model="selectedAssignees" :items="allAssignees" multiple class="min-w-[160px]" :ui="{ container: 'z-[110]' }">
            <template #label>
              <span class="truncate">{{ assigneeFilterSummary }}</span>
            </template>
          </USelectMenu>
        </div>
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />

        <div class="shrink-0 mr-auto">
          <UButton size="sm" variant="ghost" color="red" icon="i-heroicons-x-mark" @click="clearFilters" v-if="selectedStates.length || selectedAssignees.length">
            Clear
          </UButton>
        </div>
<div class="shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" :loading="pending" icon="i-heroicons-arrow-path" @click="loadTimeline">
            Reload
          </UButton>
        </div>
      </div>
    </UCard>


    <!-- Stats -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <div v-for="stat in timelineStats" :key="stat.label" class="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex flex-col justify-center transition-all hover:bg-slate-800/80">
        <div class="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-2 leading-tight">{{ stat.label }}</div>
        <div class="text-2xl font-black text-white leading-none">{{ stat.value ?? '-' }}</div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap gap-4 mb-4 px-1">
      <span v-for="s in stateLegend" :key="s.label" class="flex items-center gap-2 text-slate-400 text-xs">
        <span class="w-3 h-3 rounded-full" :style="{ background: s.color }" />
        {{ s.label }}
      </span>
    </div>

    <!-- Gantt Inline -->
    <div v-show="!isGanttFullscreen" class="bg-slate-900/60 ring-1 ring-slate-800/60 rounded-xl shadow-sm mb-4 flex flex-col">
      <div class="px-4 py-3 sm:px-4 sm:py-3 border-b border-slate-800/60 flex items-center justify-between shrink-0">
        <div>
          <h2 class="font-bold text-white text-sm">Gantt Timeline</h2>
          <p class="text-slate-400 text-xs mt-0.5">Bar dari history/revision Azure DevOps setiap task.</p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-heroicons-arrows-pointing-out"
          @click="isGanttFullscreen = true"
        />
      </div>

      <div class="flex-1 min-h-0 flex flex-col">
        <div v-if="pending" class="p-10 text-center text-slate-400">Loading timeline...</div>
        <div v-else-if="!ganttItems.length" class="p-10 text-center text-slate-400">Belum ada task dengan history timeline untuk filter yang dipilih.</div>
        <div v-else class="overflow-auto flex-1 min-h-0 max-h-[640px]">
          <div class="min-w-[1000px]">
            <!-- Scale header -->
            <div class="grid border-b border-slate-800/40 bg-slate-950/80 sticky top-0 z-10" style="grid-template-columns: 320px 1fr">
              <div class="px-4 py-2 text-slate-400 text-xs font-bold uppercase tracking-wide border-r border-slate-800/40">Task</div>
              <div class="relative px-4 py-2 min-h-[36px]">
                <span v-for="(tick, i) in ticks" :key="i" class="gantt-tick" :style="{ left: tick.pct + '%' }">{{ tick.label }}</span>
              </div>
            </div>
            <!-- Rows -->
            <div v-for="item in ganttItems" :key="item.taskId" :class="['grid border-b border-slate-800/30 hover:bg-primary-500/10 transition-colors cursor-default', item.groupBgClass]" style="grid-template-columns: 320px 1fr">
              <div class="px-3 py-1.5 border-r border-slate-800/40">
                <div class="font-medium text-xs text-slate-200 leading-snug">
                  <a :href="`${baseUrl}${item.taskId}`" target="_blank" class="text-primary-400 hover:text-primary-300">#{{ item.taskId }}</a>
                  {{ item.taskTitle }}
                </div>
                <div class="text-slate-500 text-[10px] mt-0.5">{{ item.taskAssignedTo || '-' }} · {{ item.taskState || '-' }}<span v-if="item.cycleDays != null"> · {{ item.cycleDays }}d cycle</span></div>
              </div>
              <div class="relative min-h-[32px] px-3 py-1.5">
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
    </div>

    <!-- Fullscreen Mode Overlay -->
    <Teleport to="body">
      <transition
        enter-active-class="transition duration-150 ease-out"
        leave-active-class="transition duration-100 ease-in"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div v-if="isGanttFullscreen" class="fixed inset-0 z-[100] flex flex-col bg-slate-950">
          <div class="px-4 py-3 sm:px-4 sm:py-3 border-b border-slate-800/60 flex items-center justify-between shrink-0">
            <div>
              <h2 class="font-bold text-white text-sm">Gantt Timeline</h2>
              <p class="text-slate-400 text-xs mt-0.5">Bar dari history/revision Azure DevOps setiap task.</p>
            </div>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-heroicons-arrows-pointing-in"
              @click="isGanttFullscreen = false"
            />
          </div>

          <div class="px-4 py-2 bg-slate-900 border-b border-slate-800/60 flex items-center gap-3 flex-wrap shrink-0 relative z-50">
            <div class="flex items-center gap-2 shrink-0 relative">
              <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Assignee</span>
              <USelectMenu v-model="selectedAssignees" :items="allAssignees" multiple class="min-w-[160px]" :ui="{ container: 'z-[110]' }">
                <template #label><span class="truncate">{{ assigneeFilterSummary }}</span></template>
              </USelectMenu>
            </div>
            <div class="flex items-center gap-2 shrink-0 relative">
              <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">State</span>
              <USelectMenu v-model="selectedStates" :items="allStates" multiple class="min-w-[160px]" :ui="{ container: 'z-[110]' }">
                <template #label><span class="truncate">{{ stateFilterSummary }}</span></template>
              </USelectMenu>
            </div>
            <UButton size="sm" variant="ghost" color="red" icon="i-heroicons-x-mark" @click="clearFilters" v-if="selectedStates.length || selectedAssignees.length">Clear</UButton>
          </div>

          <div class="flex-1 min-h-0 flex flex-col">
            <div v-if="pending" class="p-10 text-center text-slate-400">Loading timeline...</div>
            <div v-else-if="!ganttItems.length" class="p-10 text-center text-slate-400">Belum ada task dengan history timeline untuk filter yang dipilih.</div>
            <div v-else class="overflow-auto flex-1 h-full min-h-0">
              <div class="min-w-[1000px]">
                <!-- Scale header -->
                <div class="grid border-b border-slate-800/40 bg-slate-950/80 sticky top-0 z-10" style="grid-template-columns: 320px 1fr">
                  <div class="px-4 py-2 text-slate-400 text-xs font-bold uppercase tracking-wide border-r border-slate-800/40">Task</div>
                  <div class="relative px-4 py-2 min-h-[36px]">
                    <span v-for="(tick, i) in ticks" :key="i" class="gantt-tick" :style="{ left: tick.pct + '%' }">{{ tick.label }}</span>
                  </div>
                </div>
                <!-- Rows -->
                <div v-for="item in ganttItems" :key="item.taskId" :class="['grid border-b border-slate-800/30 hover:bg-primary-500/10 transition-colors cursor-default', item.groupBgClass]" style="grid-template-columns: 320px 1fr">
                  <div class="px-3 py-1.5 border-r border-slate-800/40">
                    <div class="font-medium text-xs text-slate-200 leading-snug">
                      <a :href="`${baseUrl}${item.taskId}`" target="_blank" class="text-primary-400 hover:text-primary-300">#{{ item.taskId }}</a>
                      {{ item.taskTitle }}
                    </div>
                    <div class="text-slate-500 text-[10px] mt-0.5">{{ item.taskAssignedTo || '-' }} · {{ item.taskState || '-' }}<span v-if="item.cycleDays != null"> · {{ item.cycleDays }}d cycle</span></div>
                  </div>
                  <div class="relative min-h-[32px] px-3 py-1.5">
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
        </div>
      </transition>
    </Teleport>

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
const selectedAssignees = ref<string[]>([])

const stateFilterSummary = computed(() => {
  if (!selectedStates.value.length || selectedStates.value.length === allStates.value.length) return 'Semua State'
  return `${selectedStates.value.length} state dipilih`
})

const assigneeFilterSummary = computed(() => {
  if (!selectedAssignees.value.length || selectedAssignees.value.length === allAssignees.value.length) return 'Semua Assignee'
  return `${selectedAssignees.value.length} assignee dipilih`
})

const activeSprint = computed(() => sprints.value.find((s) => s.path === selectedSprintPath.value))

const sprintOptions = computed(() => sprints.value.map((s) => ({ label: s.name + (s.timeFrame ? ` (${s.timeFrame})` : ''), value: s.path })))

const isHeroExpanded = ref(true)
const isGanttFullscreen = ref(false)

function clearFilters() {
  selectedStates.value = []
  selectedAssignees.value = []
}

onBeforeRouteLeave(() => {
  if (isGanttFullscreen.value) {
    return false // Mencegah navigasi back router, tidak melakukan aksi apapun
  }
})

const handleEscape = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isGanttFullscreen.value) {
    isGanttFullscreen.value = false
  }
}

onMounted(() => {
  const stored = localStorage.getItem('timelineHeroExpanded')
  if (stored !== null) isHeroExpanded.value = stored === 'true'
  
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
watch(isHeroExpanded, (val) => {
  localStorage.setItem('timelineHeroExpanded', String(val))
})

const allItems = computed(() => (data.value?.items as Record<string, unknown>[]) || [])
const allStates = computed(() => [...new Set(allItems.value.map((i) => String(i.taskState || '')).filter(Boolean))])
const allAssignees = computed(() => [...new Set(allItems.value.map((i) => String(i.taskAssignedTo || '')).filter(Boolean))].sort())

const ganttItems = computed(() => {
  const items = allItems.value.filter((i) => (i.segments as unknown[]).length > 0)
  let filtered = items
  if (selectedStates.value.length) filtered = filtered.filter(i => selectedStates.value.includes(String(i.taskState)))
  if (selectedAssignees.value.length) filtered = filtered.filter(i => selectedAssignees.value.includes(String(i.taskAssignedTo)))

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
