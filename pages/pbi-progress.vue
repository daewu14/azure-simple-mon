<template>
  <div>
    <!-- Hero -->
    <UCard class="mb-4" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · Product Delivery</div>
          <h1 class="text-2xl font-bold text-white">PBI Monthly Progress</h1>
          <p class="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
            Pantau progress Product Backlog Item (PBI) berdasarkan target penyelesaian per bulan.
          </p>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
        <UBadge v-if="data" color="neutral" variant="soft">Total Sprint Target: <b class="ml-1">{{ data.targetSprints }}</b></UBadge>
        <UBadge v-if="data" color="neutral" variant="soft">Total PBI: <b class="ml-1">{{ data.pbis?.length || 0 }}</b></UBadge>
      </div>
      <UAlert v-if="data?.warning" color="warning" variant="soft" :description="String(data.warning)" class="mt-3" />
    </UCard>

    <!-- Toolbar -->
    <UCard class="mb-4" :ui="{ body: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Month</span>
          <USelect v-model="selectedMonth" :items="monthOptions" class="w-[140px]" @change="loadData" />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Year</span>
          <USelect v-model="selectedYear" :items="yearOptions" class="w-[100px]" @change="loadData" />
        </div>
        <div class="w-px h-5 bg-slate-800 shrink-0 hidden sm:block" />
        <div class="ml-auto shrink-0">
          <UButton size="sm" variant="ghost" color="neutral" :loading="pending" icon="i-heroicons-arrow-path" @click="loadData">
            Reload
          </UButton>
        </div>
      </div>
    </UCard>

    <!-- Table -->
    <UCard :ui="{ body: { padding: 'p-0 sm:p-0' } }">
      <UTable
        :data="tableRows"
        :columns="columns"
        :loading="pending"
        class="w-full whitespace-nowrap"
      >
        <template #pbi-cell="{ row }">
          <div class="flex items-center gap-2">
            <a :href="row.url" target="_blank" class="text-primary-400 hover:text-primary-300 font-medium text-xs">#{{ row.id }}</a>
            <span class="text-sm text-slate-200 whitespace-normal min-w-[300px]">{{ row.title }}</span>
          </div>
        </template>
        
        <template #state-cell="{ row }">
          <UBadge :color="stateColor(row.state)" variant="subtle" size="xs">{{ row.state }}</UBadge>
        </template>

        <template #target-cell="{ row }">
          <span class="text-sm text-slate-300">{{ formatDate(row.targetDate) }}</span>
          <div class="text-[10px] text-slate-500 mt-0.5 max-w-[200px] truncate" :title="row.iterationPath">
            {{ row.iterationPath.split('\\').pop() }}
          </div>
        </template>

        <template #release-cell="{ row }">
          <div v-if="row.actualReleaseDate">
            <span class="text-sm" :class="row.isLate ? 'text-red-400 font-bold' : 'text-emerald-400'">
              {{ formatDate(row.actualReleaseDate) }}
            </span>
            <div v-if="row.isLate" class="text-[10px] text-red-500 mt-0.5">Terlambat rilis</div>
          </div>
          <div v-else>
            <span class="text-sm text-slate-500">-</span>
            <div v-if="row.isPastDue" class="text-[10px] text-orange-400 mt-0.5">Melewati target</div>
          </div>
        </template>
      </UTable>
      
      <div v-if="!pending && !tableRows.length" class="p-8 text-center text-slate-400">
        Tidak ada PBI untuk target bulan ini.
      </div>
    </UCard>

    <div class="text-slate-600 text-xs text-right mt-3">Generated: {{ data?.generatedAt || '-' }}</div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'PBI Monthly Progress · Sprint Platform Dashboard' })

const { selectedTeam } = useTeam()

const currentMonth = new Date().getMonth() + 1
const currentYear = new Date().getFullYear()

const selectedMonth = ref(String(currentMonth))
const selectedYear = ref(String(currentYear))

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const monthOptions = months.map((m, i) => ({ label: m, value: String(i + 1) }))
const yearOptions = Array.from({ length: 5 }, (_, i) => {
  const y = currentYear - 2 + i
  return { label: String(y), value: String(y) }
})

const data = ref<Record<string, unknown> | null>(null)
const pending = ref(true)

const columns = [
  { id: 'pbi', header: 'Product Backlog Item (PBI)' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'targetDate', id: 'target', header: 'Target (Sprint End)' },
  { accessorKey: 'actualReleaseDate', id: 'release', header: 'Actual Release' }
]

const tableRows = computed(() => {
  if (!data.value || !data.value.pbis) return []
  const pbis = data.value.pbis as Record<string, unknown>[]
  
  return pbis.map(pbi => {
    let isLate = false
    let isPastDue = false
    
    if (pbi.targetDate) {
      const target = new Date(pbi.targetDate as string).getTime()
      
      if (pbi.actualReleaseDate) {
        const actual = new Date(pbi.actualReleaseDate as string).getTime()
        // If released after target date
        if (actual > target + 86400000) isLate = true 
      } else {
        // Not released yet, check if target has passed
        if (Date.now() > target + 86400000) isPastDue = true
      }
    }

    return {
      ...pbi,
      isLate,
      isPastDue
    }
  })
})

function stateColor(state: string) {
  const s = state.toLowerCase()
  if (['done', 'released', 'closed'].includes(s)) return 'emerald'
  if (['new', 'to do'].includes(s)) return 'slate'
  if (['committed', 'active'].includes(s)) return 'blue'
  return 'primary'
}

function formatDate(v: unknown) {
  if (!v) return '-'
  return new Date(v as string).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

async function loadData() {
  pending.value = true
  try {
    data.value = await $fetch('/api/pbi-monthly', {
      query: {
        team: selectedTeam.value,
        month: selectedMonth.value,
        year: selectedYear.value
      }
    }) as Record<string, unknown>
  } finally {
    pending.value = false
  }
}

watch(selectedTeam, () => loadData())

onMounted(() => {
  loadData()
})
</script>
