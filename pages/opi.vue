<template>
  <div>

    <!-- Hero -->
    <div class="mb-4">
      <UCard :ui="{ body: { padding: 'p-5 sm:p-5' } }">
        <div class="flex items-start justify-between gap-4 cursor-pointer select-none" @click="isHeroExpanded = !isHeroExpanded">
          <div>
            <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · OPI Board</div>
            <h1 class="text-2xl font-bold text-white">OPI Board</h1>
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
            Menampilkan daftar Story dan Task pada project OPI Board berdasarkan Iterasi atau rentang waktu yang dipilih.
            Klik baris Story untuk expand/collapse task di dalamnya.
          </p>
          <div class="flex flex-wrap gap-2">
            <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
            <UBadge v-if="selectedSprintPath" color="purple" variant="soft">Iteration: <b class="ml-1">{{ sprints.find(s => s.path === selectedSprintPath)?.name || selectedSprintPath.split('\\').pop() }}</b></UBadge>
            <UBadge v-if="data" color="primary" variant="soft">Date Range: <b class="ml-1">{{ data.dateRange }}</b></UBadge>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Toolbar -->
    <UCard class="mb-4" :ui="{ body: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <div class="flex flex-col gap-4">
        <!-- Top Row: Search and Actions -->
        <div class="flex items-center gap-3 w-full">
          <UInput v-model="searchTerm" icon="i-heroicons-magnifying-glass" type="search" placeholder="Cari ID, title, assignee..." size="sm" class="flex-1" />
          <div class="flex items-center gap-2 shrink-0">
            <UButton
              size="sm"
              variant="soft"
              color="red"
              icon="i-heroicons-x-mark"
              :disabled="!(searchTerm || selectedAssignees.length || selectedStates.length)"
              @click="clearFilters"
            >
              Clear
            </UButton>
            <UButton size="sm" variant="ghost" color="neutral" :loading="pending" icon="i-heroicons-arrow-path" @click="refresh">
              Reload
            </UButton>
          </div>
        </div>
        
        <!-- Bottom Row: Advanced Filters -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Iteration</span>
            <USelect v-model="selectedSprintPath" :items="sprintOptions" size="sm" class="w-48" placeholder="All Iterations" />
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">State</span>
            <USelectMenu v-model="selectedStates" :items="stateOptions" multiple placeholder="All States" class="w-[140px] sm:w-[160px]">
              <template #label>
                <span v-if="selectedStates.length" class="truncate block w-full text-left">{{ selectedStates.join(', ') }}</span>
                <span v-else class="text-slate-400">All States</span>
              </template>
            </USelectMenu>
          </div>

          <div class="w-px h-4 bg-slate-800 shrink-0 hidden sm:block" />
          
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Assignee</span>
            <USelectMenu v-model="selectedAssignees" :items="assigneeOptions" multiple placeholder="All Assignees" class="w-[160px] sm:w-[220px]">
              <template #label>
                <span v-if="selectedAssignees.length" class="truncate block w-full text-left">{{ selectedAssignees.join(', ') }}</span>
                <span v-else class="text-slate-400">All Assignees</span>
              </template>
            </USelectMenu>
          </div>

          <div class="w-px h-4 bg-slate-800 shrink-0 hidden lg:block" />
          
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Date</span>
            <UInput type="date" v-model="customStartDate" size="sm" class="w-[120px]" />
            <span class="text-slate-500 text-xs">-</span>
            <UInput type="date" v-model="customEndDate" size="sm" class="w-[120px]" />
          </div>
        </div>
      </div>
    </UCard>

    <!-- Table -->
    <UCard :ui="{ body: { padding: 'p-0 sm:p-0' }, header: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-bold text-white text-sm">OPI Stories & Tasks</h2>
          <span class="text-slate-400 text-xs">{{ filteredStories.length }} Stories shown</span>
        </div>
      </template>
      
      <div v-if="pending" class="p-10 text-center text-slate-400">Loading data...</div>
      <div v-else-if="!filteredStories.length" class="p-10 text-center text-slate-400">Tidak ada data OPI minggu lalu yang sesuai pencarian.</div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[900px]">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/50">
              <th class="w-10 px-3 py-2" />
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">ID</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Type</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Title</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">State</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Assigned To</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Tasks</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="story in filteredStories" :key="story.id">
              <tr
                class="border-b border-slate-800/60 cursor-pointer hover:bg-primary-500/5 transition-colors"
                :class="expandedStories.has(story.id) ? 'bg-primary-500/5' : ''"
                @click="toggleStory(story.id)"
              >
                <td class="px-3 py-2 text-center">
                  <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 transition-transform duration-150 text-slate-400" :class="expandedStories.has(story.id) ? 'rotate-90' : ''" />
                </td>
                <td class="px-3 py-2">
                  <a :href="story.url" target="_blank" class="text-primary-400 hover:text-primary-300 font-bold" @click.stop>#{{ story.id }}</a>
                </td>
                <td class="px-3 py-2 text-slate-400 text-xs">{{ story.type }}</td>
                <td class="px-3 py-2 text-slate-200 max-w-sm">{{ story.title }}</td>
                <td class="px-3 py-2 w-32"><StateBadge :state="story.state" /></td>
                <td class="px-3 py-2 text-slate-300 text-xs w-48">{{ story.assignedTo || '-' }}</td>
                <td class="px-3 py-2 text-xs w-20">
                  <UBadge color="neutral" variant="soft">{{ story.tasks.length }}</UBadge>
                </td>
              </tr>
              <!-- Child Tasks (Expanded) -->
              <tr v-if="expandedStories.has(story.id)" class="bg-slate-900/40 border-b border-slate-800/60">
                <td colspan="7" class="p-0">
                  <div class="px-8 py-3 bg-slate-950/30">
                    <table class="w-full text-xs">
                      <tbody>
                        <tr v-if="!story.tasks.length" class="text-slate-500 italic">
                          <td class="px-3 py-2">Tidak ada child task.</td>
                        </tr>
                        <tr v-for="task in story.tasks" :key="task.id" class="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/30 transition-colors">
                          <td class="px-3 py-2 w-24">
                            <span class="text-slate-500 mr-1">↳</span>
                            <a :href="task.url" target="_blank" class="text-primary-400 hover:text-primary-300 font-medium" @click.stop>#{{ task.id }}</a>
                          </td>
                          <td class="px-3 py-2 text-slate-300">{{ task.title }}</td>
                          <td class="px-3 py-2 w-32"><StateBadge :state="task.state" class="scale-90 origin-left" /></td>
                          <td class="px-3 py-2 w-48 text-slate-400">{{ task.assignedTo || '-' }}</td>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const isHeroExpanded = ref(true)
const searchTerm = ref('')
const expandedStories = ref<Set<number>>(new Set())

const customStartDate = ref('')
const customEndDate = ref('')
const selectedSprintPath = ref('')
const sprints = ref<any[]>([])
const sprintOptions = computed(() => sprints.value.map(s => ({ label: s.name, value: s.path })))

onMounted(async () => {
  try {
    const res = await $fetch<any>('/api/sprints', { query: { team: 'OPI Board Team', project: 'OPI Board' } })
    sprints.value = res.sprints || []
    const current = sprints.value.find((s: any) => s.timeFrame === 'current') || sprints.value[0]
    if (current) selectedSprintPath.value = current.path
  } catch {}
})

const { data, pending, refresh } = useFetch('/api/opi', {
  lazy: true,
  query: computed(() => ({
    startDate: customStartDate.value || undefined,
    endDate: customEndDate.value || undefined,
    sprintPath: selectedSprintPath.value || undefined
  }))
})

const stats = computed(() => {
  if (!data.value?.stats) {
    return [
      { label: 'Total Stories', value: 0 },
      { label: 'Total Tasks', value: 0 },
      { label: 'Completed', value: 0 },
      { label: 'Progress', value: '0%' },
    ]
  }
  const s = data.value.stats
  return [
    { label: 'Total Stories', value: s.totalStories },
    { label: 'Total Tasks', value: s.totalTasks },
    { label: 'Completed', value: s.completedTasks },
    { label: 'Progress', value: `${s.progressPercentage}%` },
  ]
})

const selectedAssignees = ref<string[]>([])

const assigneeOptions = computed(() => {
  if (!data.value?.stories) return []
  const assignees = new Set<string>()
  for (const story of data.value.stories) {
    if (story.assignedTo && story.assignedTo !== '-') assignees.add(story.assignedTo)
    for (const task of story.tasks || []) {
      if (task.assignedTo && task.assignedTo !== '-') assignees.add(task.assignedTo)
    }
  }
  return Array.from(assignees).sort()
})

const selectedStates = ref<string[]>([])

const stateOptions = computed(() => {
  if (!data.value?.stories) return []
  const states = new Set<string>()
  for (const story of data.value.stories) {
    if (story.state) states.add(story.state)
  }
  return Array.from(states).sort()
})

const filteredStories = computed(() => {
  if (!data.value?.stories) return []
  
  let result = data.value.stories

  // State Filter
  if (selectedStates.value.length > 0) {
    result = result.filter((story: any) => selectedStates.value.includes(story.state))
  }

  // Assignee Filter
  if (selectedAssignees.value.length > 0) {
    result = result.map((story: any) => {
      const storyMatches = selectedAssignees.value.includes(story.assignedTo)
      const matchingTasks = (story.tasks || []).filter((task: any) => selectedAssignees.value.includes(task.assignedTo))
      
      if (storyMatches || matchingTasks.length > 0) {
        return { ...story, tasks: storyMatches ? story.tasks : matchingTasks }
      }
      return null
    }).filter(Boolean)
  }
  
  // Search Filter
  if (searchTerm.value) {
    const q = searchTerm.value.toLowerCase()
    result = result.map((story: any) => {
      const sMatch = 
        String(story.id).includes(q) || 
        (story.title || '').toLowerCase().includes(q) || 
        (story.assignedTo || '').toLowerCase().includes(q)
        
      if (sMatch) return story
      
      const matchingTasks = (story.tasks || []).filter((task: any) => 
        String(task.id).includes(q) || 
        (task.title || '').toLowerCase().includes(q) || 
        (task.assignedTo || '').toLowerCase().includes(q)
      )
      
      if (matchingTasks.length > 0) {
        return { ...story, tasks: matchingTasks }
      }
      return null
    }).filter(Boolean)
  }
  
  return result
})

function toggleStory(id: number) {
  const next = new Set(expandedStories.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedStories.value = next
}

function clearFilters() {
  selectedSprintPath.value = ''
  searchTerm.value = ''
  selectedAssignees.value = []
  selectedStates.value = []
}
</script>
