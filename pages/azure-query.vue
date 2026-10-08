<template>
  <div>
    <UCard class="mb-4" :ui="{ body: { padding: 'p-5 sm:p-5' } }">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="text-primary-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Azure DevOps · Saved Query</div>
          <h1 class="text-2xl font-bold text-white">{{ data?.queryName || 'Azure Query' }}</h1>
          <p class="text-slate-400 text-sm mt-2 max-w-2xl">
            Menampilkan work item dari saved query Azure DevOps. Data diambil melalui server menggunakan PAT yang sudah dikonfigurasi.
          </p>
          <div class="flex flex-wrap gap-2 mt-3">
            <UBadge color="neutral" variant="soft">Project: <b class="ml-1">{{ data?.project || 'Product Delivery' }}</b></UBadge>
            <UBadge v-if="data?.queryPath" color="neutral" variant="soft">Path: <b class="ml-1">{{ data.queryPath }}</b></UBadge>
            <UBadge color="primary" variant="soft">Total: <b class="ml-1">{{ data?.count ?? 0 }}</b></UBadge>
            <UBadge v-if="hasActivatedDateOverride" color="warning" variant="soft">
              Activated: <b class="ml-1">{{ appliedDateLabel }}</b>
            </UBadge>
            <UBadge v-if="data?.assignedToOverride" color="info" variant="soft">
              PBI Assigned To: <b class="ml-1">{{ data.assignedToOverride }}</b>
            </UBadge>
          </div>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            v-if="data?.queryUrl"
            :to="data.queryUrl"
            target="_blank"
            color="neutral"
            variant="soft"
            icon="i-heroicons-arrow-top-right-on-square"
          >
            Buka di Azure DevOps
          </UButton>
        </div>
      </div>
      <UAlert v-if="data?.warning" color="warning" variant="soft" :description="data.warning" class="mt-4" />
    </UCard>

    <UCard class="mb-4" :ui="{ body: { padding: 'p-4 sm:p-5' } }">
      <div class="flex flex-col gap-4">
        <div>
          <h2 class="text-sm font-bold text-white">Override Query</h2>
          <p class="mt-1 text-xs text-slate-500">Sesuaikan periode activated date dan assignee PBI sebelum mengambil data.</p>
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
            <USelect
              v-model="assignedTo"
              :items="assignedToOptions"
              size="sm"
              class="w-full"
              placeholder="Pilih assignee"
            />
          </div>
        </div>

        <div class="flex flex-col-reverse gap-3 border-t border-slate-800/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            <UButton
              size="sm"
              variant="soft"
              color="neutral"
              icon="i-heroicons-calendar-days"
              class="w-full justify-center sm:w-auto"
              :disabled="!activatedStart && !activatedEnd && !hasActivatedDateOverride"
              @click="resetActivatedDate"
            >
              Pakai Tanggal Query
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              color="neutral"
              icon="i-heroicons-user"
              class="w-full justify-center sm:w-auto"
              :disabled="assignedTo.trim() === defaultAssignedTo"
              @click="resetAssignedTo"
            >
              Pakai Default Assignee
            </UButton>
          </div>
          <div class="grid grid-cols-1 gap-2 sm:flex sm:items-center">
            <UButton
              size="sm"
              color="primary"
              :loading="pending"
              icon="i-heroicons-funnel"
              class="w-full justify-center sm:w-auto"
              @click="applyOverrides"
            >
              Terapkan Override
            </UButton>
            <UButton
              size="sm"
              color="primary"
              variant="soft"
              icon="i-heroicons-chart-bar-square"
              class="w-full justify-center sm:w-auto"
              :disabled="pending || !items.length"
              @click="generateSummary"
            >
              Generate Summary
            </UButton>
          </div>
        </div>

        <div class="border-t border-slate-800/60 pt-4 flex items-center gap-3 flex-wrap">
          <UInput
            v-model="searchTerm"
            icon="i-heroicons-magnifying-glass"
            type="search"
            placeholder="Cari ID, title, state, assignee, tag..."
            size="sm"
            class="flex-1 min-w-[240px]"
          />
          <USelect v-model="selectedType" :items="typeOptions" size="sm" class="w-48" />
          <USelect v-model="selectedState" :items="stateOptions" size="sm" class="w-48" />
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            :loading="pending"
            icon="i-heroicons-arrow-path"
            @click="loadData"
          >
            Reload
          </UButton>
        </div>
      </div>
    </UCard>


    <UCard :ui="{ body: { padding: 'p-0 sm:p-0' }, header: { padding: 'px-4 py-3 sm:px-4 sm:py-3' } }">
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-bold text-white text-sm">Work Items</h2>
          <span class="text-slate-400 text-xs">{{ filteredItems.length }} item ditampilkan</span>
        </div>
      </template>

      <div v-if="pending" class="p-10 text-center text-slate-400">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin mr-2 align-middle" />
        Mengambil data query...
      </div>
      <div v-else-if="errorMessage" class="p-10">
        <UAlert color="error" variant="soft" title="Gagal mengambil data" :description="errorMessage" />
      </div>
      <div v-else-if="!filteredItems.length" class="p-10 text-center text-slate-400">
        Tidak ada work item yang sesuai.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm min-w-[1100px]">
          <thead>
            <tr class="border-b border-slate-800 bg-slate-900/50">
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">ID</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Type</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Title</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">State</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Assigned To</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Iteration</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Priority</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Activated</th>
              <th class="px-3 py-2 text-left text-slate-400 text-[10px] font-bold uppercase tracking-wide">Changed</th>

            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id" class="border-b border-slate-800/60 hover:bg-primary-500/5 transition-colors">
              <td class="px-3 py-2">
                <a :href="item.url" target="_blank" rel="noopener noreferrer" class="text-primary-400 hover:text-primary-300 font-bold">#{{ item.id }}</a>
              </td>
              <td class="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{{ item.type || '-' }}</td>
              <td class="px-3 py-2 text-slate-200 min-w-[320px]">
                <a :href="item.url" target="_blank" rel="noopener noreferrer" class="hover:text-primary-300">{{ item.title }}</a>
                <div v-if="item.tags" class="flex flex-wrap gap-1 mt-1.5">
                  <UBadge v-for="tag in splitTags(item.tags)" :key="tag" color="neutral" variant="subtle" size="xs">{{ tag }}</UBadge>
                </div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap"><StateBadge :state="item.state" /></td>
              <td class="px-3 py-2 text-slate-300 text-xs min-w-[180px]">{{ item.assignedTo || '-' }}</td>
              <td class="px-3 py-2 text-slate-400 text-xs min-w-[180px]">{{ lastPath(item.iterationPath) }}</td>
              <td class="px-3 py-2 text-slate-300 text-center">{{ item.priority ?? '-' }}</td>
              <td class="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{{ formatDate(item.activatedDate) }}</td>
              <td class="px-3 py-2 text-slate-400 text-xs whitespace-nowrap">{{ formatDate(item.changedDate) }}</td>

            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="text-slate-600 text-xs text-right mt-3">Generated: {{ formatDate(data?.generatedAt) }}</div>
  </div>
</template>

<script setup lang="ts">
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


interface QueryResponse {
  generatedAt: string
  project?: string
  queryId: string
  queryName: string
  queryPath: string
  queryUrl: string
  activatedDateOverride: {
    start: string
    end: string
  }
  defaultAssignedTo: string
  assignedToOverride: string
  assignedToOptions: string[]
  count: number
  items: QueryItem[]
  warning?: string
}

useHead({ title: 'Azure Query · Sprint Platform Dashboard' })

const data = ref<QueryResponse | null>(null)
const pending = ref(true)
const errorMessage = ref('')
const searchTerm = ref('')
const selectedType = ref('all')
const selectedState = ref('all')

const activatedStart = ref('')
const activatedEnd = ref('')
const assignedTo = ref('')
const defaultAssignedTo = computed(() => data.value?.defaultAssignedTo || '')

const items = computed(() => data.value?.items || [])
const hasActivatedDateOverride = computed(() => Boolean(data.value?.activatedDateOverride?.start || data.value?.activatedDateOverride?.end))
const appliedDateLabel = computed(() => {
  const start = data.value?.activatedDateOverride?.start || 'awal'
  const end = data.value?.activatedDateOverride?.end || 'sekarang'
  return `${start} — ${end}`
})
const typeOptions = computed(() => [
  { label: 'Semua type', value: 'all' },
  ...[...new Set(items.value.map((item) => item.type).filter(Boolean))].sort().map((value) => ({ label: value, value })),
])
const stateOptions = computed(() => [
  { label: 'Semua state', value: 'all' },
  ...[...new Set(items.value.map((item) => item.state).filter(Boolean))].sort().map((value) => ({ label: value, value })),
])
const assignedToOptions = computed(() =>
  (data.value?.assignedToOptions || []).map((value) => ({ label: value, value })),
)


const filteredItems = computed(() => {
  const term = searchTerm.value.trim().toLowerCase()
  return items.value.filter((item) => {
    const haystack = [item.id, item.type, item.title, item.state, item.assignedTo, item.iterationPath, item.areaPath, item.tags].join(' ').toLowerCase()
    return (!term || haystack.includes(term))
      && (selectedType.value === 'all' || item.type === selectedType.value)
      && (selectedState.value === 'all' || item.state === selectedState.value)
  })
})

async function loadData() {
  pending.value = true
  errorMessage.value = ''
  try {
    const response = await $fetch<QueryResponse>('/api/azure-query', {
      query: {
        activatedStart: activatedStart.value || undefined,
        activatedEnd: activatedEnd.value || undefined,
        assignedTo: assignedTo.value.trim() || undefined,
      },
    })
    data.value = response

    assignedTo.value = response.assignedToOverride || response.defaultAssignedTo
    return true
  } catch (error: unknown) {
    const fetchError = error as { data?: { statusMessage?: string; message?: string }; message?: string }
    errorMessage.value = fetchError.data?.statusMessage || fetchError.data?.message || fetchError.message || 'Terjadi kesalahan saat mengambil data Azure DevOps.'
    return false
  } finally {
    pending.value = false
  }
}

function validateOverrides() {
  if (activatedStart.value && activatedEnd.value && activatedStart.value > activatedEnd.value) {
    errorMessage.value = 'Activated Date start tidak boleh lebih besar dari end.'
    return false
  }
  return true
}

async function applyOverrides() {
  if (!validateOverrides()) return
  await loadData()
}

async function resetActivatedDate() {
  activatedStart.value = ''
  activatedEnd.value = ''
  await loadData()
}

async function generateSummary() {
  if (!validateOverrides()) return
  await navigateTo({
    path: '/azure-query-summary',
    query: {
      activatedStart: activatedStart.value || undefined,
      activatedEnd: activatedEnd.value || undefined,
      assignedTo: assignedTo.value.trim() || undefined,
      search: searchTerm.value.trim() || undefined,
      type: selectedType.value !== 'all' ? selectedType.value : undefined,
      state: selectedState.value !== 'all' ? selectedState.value : undefined,
    },
  })
}

async function resetAssignedTo() {
  assignedTo.value = defaultAssignedTo.value
  await loadData()
}


function splitTags(tags: string) {
  return tags.split(';').map((tag) => tag.trim()).filter(Boolean)
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

onMounted(loadData)
</script>
