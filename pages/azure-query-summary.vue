<template>
  <div>
    <UCard class="mb-4" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="text-primary-500 mb-1.5 text-[10px] font-bold uppercase tracking-widest">Azure DevOps · Summary</div>
          <h1 class="text-2xl font-bold text-white">Summary Ketepatan Waktu</h1>
          <p class="mt-2 max-w-3xl text-sm text-slate-400">
            Task dinilai menggunakan Resolved Date, atau Closed Date jika Resolved Date kosong. Task dinyatakan On Time jika tanggal selesai tidak melewati End Sprint.
          </p>
          <div class="mt-3 flex flex-wrap gap-2">
            <UBadge color="neutral" variant="soft">Query: <b class="ml-1">{{ data?.queryName || 'Sprint Workaround' }}</b></UBadge>
            <UBadge v-if="appliedDateLabel" color="warning" variant="soft">Activated: <b class="ml-1">{{ appliedDateLabel }}</b></UBadge>
            <UBadge v-if="data?.assignedToOverride" color="info" variant="soft">PBI Assigned To: <b class="ml-1">{{ data.assignedToOverride }}</b></UBadge>
          </div>
        </div>
        <UButton to="/azure-query" color="neutral" variant="soft" icon="i-heroicons-arrow-left">
          Kembali ke Sprint Workaround
        </UButton>
      </div>
      <UAlert v-if="data?.warning" color="warning" variant="soft" :description="data.warning" class="mt-4" />
    </UCard>

    <UCard class="mb-4" :ui="{ body: { padding: 'p-4 sm:p-5' } }">
      <div class="flex flex-col gap-4">
        <div>
          <h2 class="text-sm font-bold text-white">Filter Summary</h2>
          <p class="mt-1 text-xs text-slate-500">Filter dibawa dari halaman Sprint Workaround dan dapat disesuaikan kembali di halaman ini.</p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div class="min-w-0">
            <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Activated Date Start</label>
            <UInput v-model="activatedStart" type="date" size="sm" class="w-full" />
          </div>
          <div class="min-w-0">
            <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Activated Date End</label>
            <UInput v-model="activatedEnd" type="date" size="sm" class="w-full" />
          </div>
          <div class="min-w-0 sm:col-span-2 xl:col-span-1">
            <label class="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">PBI Assigned To</label>
            <USelect v-model="assignedTo" :items="assignedToOptions" size="sm" class="w-full" placeholder="Pilih assignee" />
          </div>
        </div>

        <div class="flex flex-col-reverse gap-3 border-t border-slate-800/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <UButton size="sm" variant="soft" color="neutral" icon="i-heroicons-calendar-days" class="w-full justify-center sm:w-auto" :disabled="!activatedStart && !activatedEnd" @click="resetActivatedDate">
              Pakai Tanggal Query
            </UButton>
            <UButton size="sm" variant="soft" color="neutral" icon="i-heroicons-user" class="w-full justify-center sm:w-auto" :disabled="assignedTo === defaultAssignedTo" @click="resetAssignedTo">
              Pakai Default Assignee
            </UButton>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:flex sm:items-center">
            <UButton size="sm" color="success" variant="soft" :loading="exporting" :disabled="pending || !!errorMessage || !filteredDetailItems.length" icon="i-heroicons-arrow-down-tray" class="w-full justify-center sm:w-auto" @click="exportExcel">
              Export Excel
            </UButton>
            <UButton size="sm" color="primary" :loading="pending" icon="i-heroicons-funnel" class="w-full justify-center sm:w-auto" @click="applyFilters">
              Terapkan Filter
            </UButton>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 border-t border-slate-800/60 pt-4 md:grid-cols-2 xl:grid-cols-4">
          <UInput v-model="searchTerm" icon="i-heroicons-magnifying-glass" type="search" placeholder="Cari ID, title, assignee..." size="sm" class="w-full" />
          <USelect v-model="selectedType" :items="typeOptions" size="sm" class="w-full" />
          <USelect v-model="selectedState" :items="stateOptions" size="sm" class="w-full" />
          <USelect v-model="selectedTimeliness" :items="timelinessOptions" size="sm" class="w-full" />
        </div>
      </div>
    </UCard>

    <div v-if="pending" class="mb-4 rounded-lg border border-slate-800 bg-slate-900/40 p-10 text-center text-slate-400">
      <UIcon name="i-heroicons-arrow-path" class="mr-2 h-5 w-5 animate-spin align-middle" />
      Mengambil data summary...
    </div>
    <UAlert v-else-if="errorMessage" color="error" variant="soft" title="Gagal mengambil data" :description="errorMessage" class="mb-4" />

    <template v-else>
      <div class="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div class="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-500">Total Task</div>
          <div class="mt-2 text-2xl font-bold text-white">{{ summary.total }}</div>
        </div>
        <div class="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div class="text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Dievaluasi</div>
          <div class="mt-2 text-2xl font-bold text-white">{{ summary.evaluated }}</div>
        </div>
        <div class="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div class="text-[10px] font-bold uppercase tracking-wide text-emerald-400">On Time</div>
          <div class="mt-2 text-2xl font-bold text-emerald-300">{{ summary.onTime }}</div>
          <div class="mt-1 text-xs text-emerald-500/80">{{ formatPercent(summary.onTime, summary.evaluated) }}</div>
        </div>
        <div class="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div class="text-[10px] font-bold uppercase tracking-wide text-red-400">Tidak On Time</div>
          <div class="mt-2 text-2xl font-bold text-red-300">{{ summary.notOnTime }}</div>
          <div class="mt-1 text-xs text-red-500/80">{{ formatPercent(summary.notOnTime, summary.evaluated) }}</div>
        </div>
        <div class="col-span-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 lg:col-span-1">
          <div class="text-[10px] font-bold uppercase tracking-wide text-amber-400">Tidak Dapat Ditentukan</div>
          <div class="mt-2 text-2xl font-bold text-amber-300">{{ summary.undetermined }}</div>
          <div class="mt-1 text-xs text-amber-500/80">Tanggal selesai/sprint kosong</div>
        </div>
      </div>

      <UCard class="mb-4" :ui="{ body: { padding: 'p-0 sm:p-0' }, header: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
        <template #header>
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-bold text-white">Ringkasan per Assigned To</h2>
              <p class="mt-1 text-xs text-slate-500">Breakdown seluruh Task hasil query.</p>
            </div>
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[760px] text-sm">
            <thead class="bg-slate-900/70">
              <tr>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Assigned To</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Work Item</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">On Time</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">Tidak</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">Tidak Dapat Ditentukan</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">Total Dievaluasi</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">% On Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in summary.byAssignee" :key="row.assignedTo" class="border-t border-slate-800/70">
                <td class="px-3 py-2 font-medium text-slate-200">{{ row.assignedTo }}</td>
                <td class="px-3 py-2 text-center text-slate-300">{{ row.total }}</td>
                <td class="px-3 py-2 text-center font-semibold text-emerald-400">{{ row.onTime }}</td>
                <td class="px-3 py-2 text-center font-semibold text-red-400">{{ row.notOnTime }}</td>
                <td class="px-3 py-2 text-center font-semibold text-amber-400">{{ row.undetermined }}</td>
                <td class="px-3 py-2 text-center text-slate-300">{{ row.evaluated }}</td>
                <td class="px-3 py-2 text-center font-semibold text-primary-400">{{ formatPercent(row.onTime, row.evaluated) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>

      <UCard :ui="{ body: { padding: 'p-0 sm:p-0' }, header: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
        <template #header>
          <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 class="text-sm font-bold text-white">Detail On Time</h2>
              <p class="mt-1 text-xs text-slate-500">Kolom detail mengikuti data pada Excel referensi.</p>
            </div>
            <span class="text-xs text-slate-400">{{ filteredDetailItems.length }} dari {{ detailItems.length }} Task</span>
          </div>
        </template>

        <div v-if="!filteredDetailItems.length" class="p-10 text-center text-slate-400">Tidak ada Task yang sesuai dengan filter.</div>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[2100px] text-sm">
            <thead>
              <tr class="border-b border-slate-800 bg-slate-900/50">
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">ID</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Work Item Type</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Title</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Assigned To</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">State</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Activated Date</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Resolved Date</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Closed Date</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Changed Date</th>
                <th class="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">Remaining Work</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Sprint</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">Start Sprint</th>
                <th class="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400">End Sprint</th>
                <th class="sticky right-0 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-slate-400 bg-slate-900">On Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in filteredDetailItems" :key="item.id" class="border-b border-slate-800/60 hover:bg-primary-500/5">
                <td class="px-3 py-2"><a :href="item.url" target="_blank" rel="noopener noreferrer" class="font-bold text-primary-400 hover:text-primary-300">#{{ item.id }}</a></td>
                <td class="px-3 py-2 text-xs text-slate-400">{{ item.type }}</td>
                <td class="min-w-[360px] px-3 py-2 text-slate-200"><a :href="item.url" target="_blank" rel="noopener noreferrer" class="hover:text-primary-300">{{ item.title }}</a></td>
                <td class="min-w-[190px] px-3 py-2 text-xs text-slate-300">{{ item.assignedTo || '-' }}</td>
                <td class="px-3 py-2 whitespace-nowrap"><StateBadge :state="item.state" /></td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{{ formatDate(item.activatedDate) }}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{{ formatDate(item.resolvedDate) }}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{{ formatDate(item.closedDate) }}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{{ formatDate(item.changedDate) }}</td>
                <td class="px-3 py-2 text-center text-slate-300">{{ item.remainingWork ?? '-' }}</td>
                <td class="min-w-[190px] px-3 py-2 text-xs text-slate-400">{{ lastPath(item.iterationPath) }}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{{ formatDateOnly(item.sprintStartDate) }}</td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-400">{{ formatDateOnly(item.sprintFinishDate) }}</td>
                <td class="sticky right-0 px-3 py-2 whitespace-nowrap bg-slate-950/95">
                  <UBadge :color="timelinessColor(item.timeliness)" variant="soft" size="xs">{{ timelinessLabel(item.timeliness) }}</UBadge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </template>

    <div class="mt-3 text-right text-xs text-slate-600">Generated: {{ formatDate(data?.generatedAt) }}</div>
  </div>
</template>

<script setup lang="ts">
type TimelinessStatus = 'onTime' | 'notOnTime' | 'undetermined'

type BadgeColor = 'success' | 'error' | 'warning'

interface QueryItem {
  id: number
  type: string
  title: string
  state: string
  assignedTo: string
  iterationPath: string
  areaPath: string
  tags: string
  priority: number | null
  activatedDate: string | null
  resolvedDate: string | null
  closedDate: string | null
  remainingWork: number | null
  sprintStartDate: string | null
  sprintFinishDate: string | null
  createdDate: string | null
  changedDate: string | null
  url: string
}

interface DetailItem extends QueryItem {
  timeliness: TimelinessStatus
}

interface SummaryRow {
  assignedTo: string
  total: number
  evaluated: number
  onTime: number
  notOnTime: number
  undetermined: number
}

interface QueryResponse {
  generatedAt: string
  queryId: string
  queryName: string
  queryPath: string
  queryUrl: string
  activatedDateOverride: { start: string; end: string }
  defaultAssignedTo: string
  assignedToOverride: string
  assignedToOptions: string[]
  count: number
  items: QueryItem[]
  warning?: string
}

useHead({ title: 'Summary On Time · Sprint Platform Dashboard' })

const route = useRoute()
const router = useRouter()
const data = ref<QueryResponse | null>(null)
const pending = ref(true)
const exporting = ref(false)
const errorMessage = ref('')
const activatedStart = ref(queryString(route.query.activatedStart))
const activatedEnd = ref(queryString(route.query.activatedEnd))
const assignedTo = ref(queryString(route.query.assignedTo))
const searchTerm = ref(queryString(route.query.search))
const selectedType = ref(queryString(route.query.type) || 'all')
const selectedState = ref(queryString(route.query.state) || 'all')
const selectedTimeliness = ref(queryString(route.query.timeliness) || 'all')
const appliedAzureFilters = ref({ activatedStart: '', activatedEnd: '', assignedTo: '' })

const defaultAssignedTo = computed(() => data.value?.defaultAssignedTo || 'Rizqi Sarasajati')
const assignedToOptions = computed(() => (data.value?.assignedToOptions || ['Rizqi Sarasajati', 'Puji Juli Hervianto', 'Meutya']).map((value) => ({ label: value, value })))
const detailItems = computed<DetailItem[]>(() => (data.value?.items || [])
  .filter((item) => item.type === 'Task')
  .map((item) => ({ ...item, timeliness: getTimeliness(item) })))
const typeOptions = computed(() => [
  { label: 'Semua type', value: 'all' },
  ...[...new Set((data.value?.items || []).map((item) => item.type).filter(Boolean))].sort().map((value) => ({ label: value, value })),
])
const stateOptions = computed(() => [
  { label: 'Semua state', value: 'all' },
  ...[...new Set((data.value?.items || []).map((item) => item.state).filter(Boolean))].sort().map((value) => ({ label: value, value })),
])
const timelinessOptions = [
  { label: 'Semua status On Time', value: 'all' },
  { label: 'On Time', value: 'onTime' },
  { label: 'Tidak On Time', value: 'notOnTime' },
  { label: 'Tidak Dapat Ditentukan', value: 'undetermined' },
]
const appliedDateLabel = computed(() => {
  if (!data.value?.activatedDateOverride.start && !data.value?.activatedDateOverride.end) return ''
  return `${data.value.activatedDateOverride.start || 'awal'} — ${data.value.activatedDateOverride.end || 'sekarang'}`
})
const summarySourceItems = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  return detailItems.value.filter((item) => {
    const haystack = [item.id, item.type, item.title, item.state, item.assignedTo, item.iterationPath, item.areaPath, item.tags].join(' ').toLowerCase()
    return (!term || haystack.includes(term))
      && (selectedType.value === 'all' || item.type === selectedType.value)
      && (selectedState.value === 'all' || item.state === selectedState.value)
  })
})
const filteredDetailItems = computed(() => summarySourceItems.value.filter((item) =>
  selectedTimeliness.value === 'all' || item.timeliness === selectedTimeliness.value,
))
const summary = computed(() => {
  const rows = new Map<string, SummaryRow>()
  let onTime = 0
  let notOnTime = 0
  let undetermined = 0

  for (const item of summarySourceItems.value) {
    const assigned = item.assignedTo || 'Unassigned'
    const row = rows.get(assigned) || { assignedTo: assigned, total: 0, evaluated: 0, onTime: 0, notOnTime: 0, undetermined: 0 }
    row.total += 1
    if (item.timeliness === 'onTime') {
      row.onTime += 1
      row.evaluated += 1
      onTime += 1
    } else if (item.timeliness === 'notOnTime') {
      row.notOnTime += 1
      row.evaluated += 1
      notOnTime += 1
    } else {
      row.undetermined += 1
      undetermined += 1
    }
    rows.set(assigned, row)
  }

  return {
    total: summarySourceItems.value.length,
    evaluated: onTime + notOnTime,
    onTime,
    notOnTime,
    undetermined,
    byAssignee: [...rows.values()].sort((a, b) => a.assignedTo.localeCompare(b.assignedTo)),
  }
})

function queryString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function validateFilters() {
  if (activatedStart.value && activatedEnd.value && activatedStart.value > activatedEnd.value) {
    errorMessage.value = 'Activated Date start tidak boleh lebih besar dari end.'
    return false
  }
  return true
}

async function loadData() {
  pending.value = true
  errorMessage.value = ''
  try {
    const requestedFilters = {
      activatedStart: activatedStart.value,
      activatedEnd: activatedEnd.value,
      assignedTo: assignedTo.value,
    }
    const response = await $fetch<QueryResponse>('/api/azure-query', {
      query: {
        activatedStart: requestedFilters.activatedStart || undefined,
        activatedEnd: requestedFilters.activatedEnd || undefined,
        assignedTo: requestedFilters.assignedTo || undefined,
      },
    })
    data.value = response
    assignedTo.value = response.assignedToOverride || response.defaultAssignedTo
    appliedAzureFilters.value = { ...requestedFilters, assignedTo: assignedTo.value }
    return true
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
    errorMessage.value = fetchError.data?.statusMessage || fetchError.data?.message || fetchError.message || 'Terjadi kesalahan saat mengambil data Azure DevOps.'
    return false
  } finally {
    pending.value = false
  }
}

async function applyFilters() {
  if (!validateFilters()) return false
  await router.replace({
    query: {
      activatedStart: activatedStart.value || undefined,
      activatedEnd: activatedEnd.value || undefined,
      assignedTo: assignedTo.value || undefined,
      search: searchTerm.value.trim() || undefined,
      type: selectedType.value !== 'all' ? selectedType.value : undefined,
      state: selectedState.value !== 'all' ? selectedState.value : undefined,
      timeliness: selectedTimeliness.value !== 'all' ? selectedTimeliness.value : undefined,
    },
  })
  return await loadData()
}

async function resetActivatedDate() {
  activatedStart.value = ''
  activatedEnd.value = ''
  await applyFilters()
}

async function resetAssignedTo() {
  assignedTo.value = defaultAssignedTo.value
  await applyFilters()
}

function getTimeliness(item: QueryItem): TimelinessStatus {
  const completedAt = parseDate(item.resolvedDate || item.closedDate)
  const sprintEnd = sprintEndOfDay(item.sprintFinishDate)
  if (!completedAt || !sprintEnd) return 'undetermined'
  return completedAt.getTime() <= sprintEnd.getTime() ? 'onTime' : 'notOnTime'
}

function parseDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function sprintEndOfDay(value?: string | null) {
  if (!value) return null
  const datePart = value.slice(0, 10)
  const date = new Date(`${datePart}T23:59:59.999Z`)
  return Number.isFinite(date.getTime()) ? date : null
}

function timelinessLabel(status: TimelinessStatus) {
  if (status === 'onTime') return 'On Time'
  if (status === 'notOnTime') return 'Tidak'
  return 'Tidak Dapat Ditentukan'
}

function timelinessColor(status: TimelinessStatus): BadgeColor {
  if (status === 'onTime') return 'success'
  if (status === 'notOnTime') return 'error'
  return 'warning'
}

function formatPercent(value: number, total: number) {
  if (!total) return '0%'
  return new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 1 }).format(value / total)
}

function lastPath(path: string) {
  return path?.split('\\').pop() || '-'
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatDateOnly(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

async function exportExcel() {
  if (!validateFilters()) return
  exporting.value = true
  errorMessage.value = ''
  try {
    await router.replace({
      query: {
        activatedStart: activatedStart.value || undefined,
        activatedEnd: activatedEnd.value || undefined,
        assignedTo: assignedTo.value || undefined,
        search: searchTerm.value.trim() || undefined,
        type: selectedType.value !== 'all' ? selectedType.value : undefined,
        state: selectedState.value !== 'all' ? selectedState.value : undefined,
        timeliness: selectedTimeliness.value !== 'all' ? selectedTimeliness.value : undefined,
      },
    })

    if (hasDirtyAzureFilters()) {
      const loaded = await loadData()
      if (!loaded) return
    }

    const items = filteredDetailItems.value
    const generatedAt = data.value?.generatedAt || new Date().toISOString()
    const workbook = createSummaryWorkbook(items, generatedAt)
    const blob = new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Platform_Sprint_Workaround_Summary_${fileDate(new Date())}.xlsx`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : 'Gagal export Excel.'
  } finally {
    exporting.value = false
  }
}

function createSummaryWorkbook(items: DetailItem[], generatedAt: string) {
  const sheet1Rows = [
    ['ID', 'Work Item Type', 'Title', 'Assigned To', 'State', 'Activated Date', 'Resolved Date', 'Closed Date', 'Changed Date', 'Remaining Work', 'Sprint', 'Start Sprint', 'End Sprint', 'On Time'],
    ...items.map((item) => [
      item.id,
      item.type,
      item.title,
      item.assignedTo || '',
      item.state,
      excelDateTime(item.activatedDate),
      excelDateTime(item.resolvedDate),
      excelDateTime(item.closedDate),
      excelDateTime(item.changedDate),
      item.remainingWork ?? '',
      lastPath(item.iterationPath),
      excelDateOnly(item.sprintStartDate),
      excelDateOnly(item.sprintFinishDate),
      timelinessLabel(item.timeliness),
    ]),
  ]

  const exportSummary = summarizeItems(items)
  const assigneeRows = exportSummary.byAssignee.length ? exportSummary.byAssignee : []
  const summaryRows = [
    ['Ringkasan Ketepatan Waktu — Platform Sprint Workaround'],
    [`Generated: ${excelDateTime(generatedAt)} | Activated: ${appliedDateLabel.value || 'Tanggal Query'} | PBI Assigned To: ${assignedTo.value || defaultAssignedTo.value}`],
    [],
    ['Ringkasan Keseluruhan (Data Dievaluasi)'],
    ['Status', 'Jumlah', 'Persentase'],
    ['On Time', exportSummary.onTime, ratio(exportSummary.onTime, exportSummary.evaluated)],
    ['Tidak', exportSummary.notOnTime, ratio(exportSummary.notOnTime, exportSummary.evaluated)],
    ['Tidak Dapat Ditentukan', exportSummary.undetermined, ''],
    ['Total Dievaluasi', exportSummary.evaluated, exportSummary.evaluated ? 1 : 0],
    [],
    ['Breakdown per Assigned To'],
    ['Assigned To', 'Total Work Item', 'On Time', 'Tidak', 'Tidak Dapat Ditentukan', 'Total Dievaluasi', '% On Time'],
    ...assigneeRows.map((row) => [row.assignedTo, row.total, row.onTime, row.notOnTime, row.undetermined, row.evaluated, ratio(row.onTime, row.evaluated)]),
    ['Total', exportSummary.total, exportSummary.onTime, exportSummary.notOnTime, exportSummary.undetermined, exportSummary.evaluated, ratio(exportSummary.onTime, exportSummary.evaluated)],
  ]

  const files: Record<string, string | Uint8Array> = {
    '[Content_Types].xml': contentTypesXml(),
    '_rels/.rels': rootRelsXml(),
    'docProps/app.xml': appXml(),
    'docProps/core.xml': coreXml(generatedAt),
    'xl/workbook.xml': workbookXml(),
    'xl/_rels/workbook.xml.rels': workbookRelsXml(),
    'xl/styles.xml': stylesXml(),
    'xl/worksheets/sheet1.xml': worksheetXml(sheet1Rows, {
      name: 'Sheet1',
      widths: [10, 22, 80, 32, 18, 22, 22, 22, 22, 16, 30, 16, 16, 24],
      autoFilter: `A1:N${Math.max(sheet1Rows.length, 1)}`,
      freezePane: 'A2',
      hyperlinks: items.map((item, index) => ({ ref: cellRef(3, index + 2), target: item.url })),
      rowStyle: (row, col, value) => row === 1 ? 1 : col === 3 ? 7 : col === 14 ? statusStyle(String(value)) : 0,
    }),
    'xl/worksheets/_rels/sheet1.xml.rels': worksheetRelsXml(items.map((item) => item.url)),
    'xl/worksheets/sheet2.xml': worksheetXml(summaryRows, {
      name: 'Ringkasan On Time',
      widths: [32, 18, 16, 16, 26, 18, 16],
      merges: ['A1:G1', 'A2:G2', 'A4:G4', 'A11:G11'],
      autoFilter: `A12:G${summaryRows.length}`,
      rowStyle: (row, col, value) => {
        if ([1, 4, 11].includes(row)) return 2
        if ([5, 12].includes(row)) return 1
        if ((col === 3 && row >= 6 && row <= 9) || (col === 7 && row >= 13)) return 6
        if (String(value) === 'On Time') return 3
        if (String(value) === 'Tidak') return 4
        if (String(value) === 'Tidak Dapat Ditentukan') return 5
        return 0
      },
    }),
  }

  return zipFiles(files)
}

function summarizeItems(items: DetailItem[]) {
  const rows = new Map<string, SummaryRow>()
  let onTime = 0
  let notOnTime = 0
  let undetermined = 0

  for (const item of items) {
    const assigned = item.assignedTo || 'Unassigned'
    const row = rows.get(assigned) || { assignedTo: assigned, total: 0, evaluated: 0, onTime: 0, notOnTime: 0, undetermined: 0 }
    row.total += 1
    if (item.timeliness === 'onTime') {
      row.onTime += 1
      row.evaluated += 1
      onTime += 1
    } else if (item.timeliness === 'notOnTime') {
      row.notOnTime += 1
      row.evaluated += 1
      notOnTime += 1
    } else {
      row.undetermined += 1
      undetermined += 1
    }
    rows.set(assigned, row)
  }

  return {
    total: items.length,
    evaluated: onTime + notOnTime,
    onTime,
    notOnTime,
    undetermined,
    byAssignee: [...rows.values()].sort((a, b) => a.assignedTo.localeCompare(b.assignedTo)),
  }
}

function ratio(value: number, total: number) {
  return total ? value / total : ''
}

function excelDateTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date).replace(/:/g, '.')
}

function excelDateOnly(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(date)
}

function fileDate(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}_${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`
}

function statusStyle(status: string) {
  if (status === 'On Time') return 3
  if (status === 'Tidak') return 4
  if (status === 'Tidak Dapat Ditentukan') return 5
  return 0
}

type WorksheetOptions = {
  name: string
  widths: number[]
  merges?: string[]
  autoFilter?: string
  freezePane?: string
  hyperlinks?: Array<{ ref: string; target: string }>
  rowStyle?: (row: number, col: number, value: unknown) => number
}

function worksheetXml(rows: unknown[][], options: WorksheetOptions) {
  const dimension = `${cellRef(1, 1)}:${cellRef(Math.max(options.widths.length, maxColumns(rows)), Math.max(rows.length, 1))}`
  const cols = options.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('')
  const sheetRows = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1
    const cells = row.map((value, colIndex) => cellXml(value, cellRef(colIndex + 1, rowNumber), options.rowStyle?.(rowNumber, colIndex + 1, value) ?? 0)).join('')
    return `<row r="${rowNumber}">${cells}</row>`
  }).join('')
  const pane = options.freezePane === 'A2' ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>' : ''
  const merges = options.merges?.length ? `<mergeCells count="${options.merges.length}">${options.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>` : ''
  const autoFilter = options.autoFilter ? `<autoFilter ref="${options.autoFilter}"/>` : ''
  const hyperlinks = options.hyperlinks?.length ? `<hyperlinks>${options.hyperlinks.map((link, index) => `<hyperlink ref="${link.ref}" r:id="rId${index + 1}"/>`).join('')}</hyperlinks>` : ''
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="${dimension}"/><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><cols>${cols}</cols><sheetData>${sheetRows}</sheetData>${autoFilter}${merges}${hyperlinks}</worksheet>`
}

function maxColumns(rows: unknown[][]) {
  return Math.max(1, ...rows.map((row) => row.length))
}

function cellXml(value: unknown, ref: string, style = 0) {
  const styleAttr = style ? ` s="${style}"` : ''
  if (value === null || value === undefined || value === '') return `<c r="${ref}"${styleAttr}/>`
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${xmlEscape(String(value))}</t></is></c>`
}

function cellRef(col: number, row: number) {
  let label = ''
  let n = col
  while (n > 0) {
    const mod = (n - 1) % 26
    label = String.fromCharCode(65 + mod) + label
    n = Math.floor((n - mod) / 26)
  }
  return `${label}${row}`
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
}

function workbookXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/><sheet name="Ringkasan On Time" sheetId="2" r:id="rId2"/></sheets></workbook>`
}

function workbookRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
}

function worksheetRelsXml(targets: string[]) {
  const rels = targets.map((target, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xmlEscape(target)}" TargetMode="External"/>`).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><u/><sz val="11"/><color rgb="FF0563C1"/><name val="Calibri"/></font></fonts><fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF5B9BD5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE2F0D9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFC7CE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFEB9C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9E2F3"/></left><right style="thin"><color rgb="FFD9E2F3"/></right><top style="thin"><color rgb="FFD9E2F3"/></top><bottom style="thin"><color rgb="FFD9E2F3"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="10" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Azure Simple Mon</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>2</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="2" baseType="lpstr"><vt:lpstr>Sheet1</vt:lpstr><vt:lpstr>Ringkasan On Time</vt:lpstr></vt:vector></TitlesOfParts></Properties>`
}

function coreXml(generatedAt: string) {
  const date = new Date(generatedAt)
  const iso = Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>Azure Simple Mon</dc:creator><cp:lastModifiedBy>Azure Simple Mon</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`
}

function hasDirtyAzureFilters() {
  return activatedStart.value !== appliedAzureFilters.value.activatedStart
    || activatedEnd.value !== appliedAzureFilters.value.activatedEnd
    || assignedTo.value !== appliedAzureFilters.value.assignedTo
}

function xmlEscape(value: string) {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function zipFiles(files: Record<string, string | Uint8Array>) {
  const encoder = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0
  const entries = Object.entries(files)

  for (const [name, content] of entries) {
    const nameBytes = encoder.encode(name)
    const data = typeof content === 'string' ? encoder.encode(content) : content
    const crc = crc32(data)
    const local = new Uint8Array(30 + nameBytes.length)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, 0, true)
    localView.setUint16(12, 0, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, data.length, true)
    localView.setUint32(22, data.length, true)
    localView.setUint16(26, nameBytes.length, true)
    local.set(nameBytes, 30)
    localParts.push(local, data)

    const central = new Uint8Array(46 + nameBytes.length)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, 0, true)
    centralView.setUint16(14, 0, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, data.length, true)
    centralView.setUint32(24, data.length, true)
    centralView.setUint16(28, nameBytes.length, true)
    centralView.setUint32(42, offset, true)
    central.set(nameBytes, 46)
    centralParts.push(central)
    offset += local.length + data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, entries.length, true)
  endView.setUint16(10, entries.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  return concatBytes([...localParts, ...centralParts, end])
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(data: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

onMounted(loadData)
</script>
