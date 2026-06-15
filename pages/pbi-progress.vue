<template>
  <div>
    <!-- Hero -->
    <UCard class="mb-4" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
      <div class="flex items-start justify-between gap-4 cursor-pointer select-none" @click="isHeroExpanded = !isHeroExpanded">
        <div>
          <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · Product Delivery</div>
          <h1 class="text-2xl font-bold text-white">PBI Monthly Progress</h1>
        </div>
        <UButton
          variant="ghost"
          size="sm"
          icon="i-heroicons-chevron-down"
          :class="['transition-transform duration-300', isHeroExpanded ? 'rotate-180' : '']"
          @click.stop="isHeroExpanded = !isHeroExpanded"
        />
      </div>
      <div :class="['transition-all duration-300 ease-in-out overflow-hidden', isHeroExpanded ? 'max-h-[500px] opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0']">
        <p class="text-slate-400 text-sm mb-3 max-w-2xl leading-relaxed">
          Pantau progress Product Backlog Item (PBI) berdasarkan target penyelesaian per bulan.
        </p>
        <div class="flex flex-wrap gap-2">
          <UBadge v-if="data" color="neutral" variant="soft">Team: <b class="ml-1">{{ data.team }}</b></UBadge>
          <UBadge v-if="data" color="neutral" variant="soft">Total Sprint Target: <b class="ml-1">{{ data.targetSprints }}</b></UBadge>
          <UBadge v-if="data" color="neutral" variant="soft">Total PBI: <b class="ml-1">{{ data.pbis?.length || 0 }}</b></UBadge>
        </div>
        <UAlert v-if="data?.warning" color="warning" variant="soft" :description="String(data.warning)" class="mt-3" />
      </div>
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
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-slate-500 text-xs font-semibold whitespace-nowrap">Actual Release</span>
          <UPopover :popper="{ placement: 'bottom-start' }">
            <UButton icon="i-heroicons-calendar-days" :label="dateRangeLabel" size="sm" variant="soft" color="neutral" />
            <template #content>
              <div class="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                <ClientOnly>
                  <VDatePicker v-model.range="dateRange" color="blue" is-dark />
                </ClientOnly>
              </div>
            </template>
          </UPopover>
          <UButton v-if="dateRange.start || dateRange.end" size="xs" variant="ghost" color="red" icon="i-heroicons-x-mark" @click="dateRange = { start: null, end: null }" />
        </div>
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
        <template #id-cell="{ row }">
          <div class="flex items-center gap-2">
            <a :href="row.original.url" target="_blank" class="text-primary-400 hover:text-primary-300 font-medium text-xs">#{{ row.original.id }}</a>
            <span class="text-sm text-slate-200 whitespace-normal min-w-[300px]">{{ row.original.title }}</span>
          </div>
        </template>
        
        <template #state-cell="{ row }">
          <UBadge :color="stateColor(row.original.state)" variant="subtle" size="xs">{{ row.original.state }}</UBadge>
        </template>

        <template #targetDate-cell="{ row }">
          <span class="text-sm text-slate-300">{{ formatDate(row.original.targetDate) }}</span>
          <div class="text-[10px] text-slate-500 mt-0.5 max-w-[200px] truncate" :title="row.original.iterationPath">
            {{ row.original.iterationPath.split('\\').pop() }}
          </div>
        </template>

        <template #actualReleaseDate-cell="{ row }">
          <div v-if="row.original.actualReleaseDate">
            <span class="text-sm" :class="row.original.isLate ? 'text-red-400 font-bold' : 'text-emerald-400'">
              {{ formatDate(row.original.actualReleaseDate) }}
            </span>
            <div v-if="row.original.isLate" class="text-[10px] text-red-500 mt-0.5">Terlambat rilis</div>
          </div>
          <div v-else>
            <span class="text-sm text-slate-500">-</span>
            <div v-if="row.original.isPastDue" class="text-[10px] text-orange-400 mt-0.5">Melewati target</div>
          </div>
        </template>
      </UTable>

      
      <div v-if="!pending && !tableRows.length" class="p-8 text-center text-slate-400">
        Tidak ada PBI untuk target bulan ini.
      </div>
    </UCard>

    <!-- Management Report -->
    <UCard v-if="managementRows.length" class="mb-4" :ui="{ body: { padding: 'p-0 sm:p-0' } }">
      <div class="px-5 py-4 border-b border-slate-800">
        <h2 class="text-xl font-bold text-primary-400">Progress {{ monthOptions.find(m => m.value === selectedMonth)?.label }} {{ selectedYear }}</h2>
      </div>
      <UTable
        :data="managementRows"
        :columns="managementColumns"
        class="w-full whitespace-normal"
      >
        <template #feature-cell="{ row }">
          <span class="text-sm text-slate-200">{{ row.original.feature }}</span>
        </template>
        <template #state-cell="{ row }">
          <UBadge 
            :color="row.original.state === 'Released' ? 'emerald' : row.original.state === 'Blocking' ? 'red' : 'blue'" 
            variant="soft" 
            size="xs"
          >
            {{ row.original.state }}
          </UBadge>
        </template>
        <template #target-cell="{ row }">
          <span class="text-sm text-slate-300">{{ row.original.target }}</span>
        </template>
      </UTable>
    </UCard>

    <div class="text-slate-600 text-xs text-right mt-3">Generated: {{ data?.generatedAt || '-' }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

useHead({ title: 'PBI Monthly Progress · Sprint Platform Dashboard' })

const isHeroExpanded = ref(true)

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

const dateRange = ref({ start: null, end: null })

const dateRangeLabel = computed(() => {
  if (dateRange.value.start && dateRange.value.end) {
    const s = new Date(dateRange.value.start).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    const e = new Date(dateRange.value.end).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    return `${s} - ${e}`
  }
  return 'Select Date Range'
})

const columns = [
  { accessorKey: 'id', header: 'Product Backlog Item (PBI)' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'targetDate', header: 'Target (Sprint End)' },
  { accessorKey: 'actualReleaseDate', header: 'Actual Release' }
]

const managementColumns = [
  { accessorKey: 'feature', header: 'Feature' },
  { accessorKey: 'state', header: 'State' },
  { accessorKey: 'target', header: 'Target' }
]

const managementRows = computed(() => {
  return tableRows.value.map(row => {
    let mgmtState = 'Processing'
    const s = String(row.state || '').toLowerCase()
    
    if (['done', 'closed', 'released'].includes(s)) {
      mgmtState = 'Released'
    } else if (row.isPastDue) {
      mgmtState = 'Blocking'
    } else {
      mgmtState = 'Processing'
    }

    return {
      id: row.id,
      feature: row.title,
      state: mgmtState,
      target: formatDate(row.targetDate)
    }
  })
})

const tableRows = computed(() => {
  if (!data.value || !data.value.pbis) return []
  let pbis = data.value.pbis as Record<string, unknown>[]
  
  if (dateRange.value.start) {
    const start = new Date(dateRange.value.start).getTime()
    pbis = pbis.filter(pbi => {
      if (!pbi.actualReleaseDate) return false
      return new Date(pbi.actualReleaseDate as string).getTime() >= start
    })
  }
  
  if (dateRange.value.end) {
    const end = new Date(dateRange.value.end).getTime() + 86399999 // end of day
    pbis = pbis.filter(pbi => {
      if (!pbi.actualReleaseDate) return false
      return new Date(pbi.actualReleaseDate as string).getTime() <= end
    })
  }
  
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

const stateColor = (state: string) => {
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
  const stored = localStorage.getItem('pbiHeroExpanded')
  if (stored !== null) isHeroExpanded.value = stored === 'true'
  loadData()
})

watch(isHeroExpanded, (val) => {
  localStorage.setItem('pbiHeroExpanded', String(val))
})
</script>
