<template>
  <div>
    <!-- Hero -->
    <UCard class="mb-6 relative overflow-hidden" :ui="{ background: 'bg-gradient-to-br from-slate-900 via-slate-900 to-primary-950/20', ring: 'ring-1 ring-slate-800', body: { padding: 'p-6 sm:p-6' } }">
      <div class="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"></div>
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
    <div class="sticky top-4 z-10 mb-6">
    <UCard :ui="{ background: 'bg-slate-900/80 backdrop-blur-md', ring: 'ring-1 ring-slate-800/60 shadow-lg', body: { padding: 'px-4 py-3 sm:px-5 sm:py-4' } }">
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
  </div>


    <!-- Split Container -->
    <div 
      ref="splitContainer" 
      class="flex flex-col xl:flex-row items-stretch gap-6" 
      :style="{ '--left-width': leftWidth + '%' }"
      :class="isDragging ? 'select-none' : ''"
    >
      <!-- Left Pane -->
      <div class="w-full xl:w-[var(--left-width)] xl:shrink-0">
        <!-- Main Table -->
    <UCard :ui="{ background: 'bg-slate-900', ring: 'ring-1 ring-slate-800', body: { padding: 'p-0 sm:p-0' } }">
      <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none bg-slate-800/30 hover:bg-slate-800/50 transition-colors" @click="isMainTableExpanded = !isMainTableExpanded">
        <h2 class="text-lg font-bold text-white">Detail Product Backlog Item (PBI)</h2>
        <UButton
          variant="ghost"
          size="sm"
          color="neutral"
          icon="i-heroicons-chevron-down"
          :class="['transition-transform duration-300', isMainTableExpanded ? 'rotate-180' : '']"
          @click.stop="isMainTableExpanded = !isMainTableExpanded"
        />
      </div>
      <div v-show="isMainTableExpanded">
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
      </div>
    </UCard>
      </div>

      <!-- Resizer (only visible on xl) -->
      <div 
        class="hidden xl:flex items-center justify-center w-6 -mx-3 cursor-col-resize z-10 group" 
        @mousedown="startDrag"
      >
        <div class="w-1 h-12 bg-slate-700 group-hover:bg-primary-500 rounded-full transition-colors" :class="isDragging ? 'bg-primary-500' : ''"></div>
      </div>

      <!-- Right Pane -->
      <div class="w-full xl:flex-grow xl:w-0">
        <!-- Management Report -->
    <!-- Management Report -->
    <UCard v-if="managementRows.length" :ui="{ background: 'bg-slate-900', ring: 'ring-1 ring-slate-800', body: { padding: 'p-0 sm:p-0' } }">
      <div class="px-5 py-4 border-b border-slate-800 flex items-center justify-between cursor-pointer select-none bg-slate-800/30 hover:bg-slate-800/50 transition-colors" @click="isMgmtTableExpanded = !isMgmtTableExpanded">
        <h2 class="text-lg font-bold text-primary-400">Progress {{ monthOptions.find(m => m.value === selectedMonth)?.label }} {{ selectedYear }} <span v-if="aiGeneratedRows" class="text-xs ml-2 text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 rounded-full">AI Generated</span></h2>
        <div class="flex items-center gap-2">
          <UButton
            v-if="!aiGeneratedRows"
            icon="i-heroicons-sparkles"
            size="xs"
            color="primary"
            variant="soft"
            label="Generate AI Report"
            :loading="aiLoading"
            @click.stop="generateAIReport"
          />
          <UButton
            v-if="aiGeneratedRows"
            icon="i-heroicons-arrow-uturn-left"
            size="xs"
            color="red"
            variant="soft"
            label="Reset"
            @click.stop="resetAIReport"
          />
          <UButton
            variant="ghost"
            size="sm"
            color="neutral"
            icon="i-heroicons-chevron-down"
            :class="['transition-transform duration-300', isMgmtTableExpanded ? 'rotate-180' : '']"
            @click.stop="isMgmtTableExpanded = !isMgmtTableExpanded"
          />
        </div>
      </div>
      <div v-show="isMgmtTableExpanded">
      <UTable
        :data="aiGeneratedRows || managementRows"
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

        <!-- AI Chat Interface -->
        <div v-if="chatHistory.length" class="border-t border-slate-800 bg-slate-950/30">
          <div class="p-4 bg-slate-900/50 border-b border-slate-800 flex items-center gap-2">
            <UIcon name="i-heroicons-chat-bubble-left-ellipsis" class="text-primary-400 w-5 h-5" />
            <h3 class="text-sm font-semibold text-slate-200">AI Report Assistant</h3>
          </div>
          
          <div class="p-4 space-y-4 max-h-[400px] overflow-y-auto">
            <div v-for="(msg, i) in chatHistory" :key="i" class="flex gap-3 text-sm" :class="msg.role === 'user' ? 'flex-row-reverse' : ''">
              <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :class="msg.role === 'user' ? 'bg-primary-500/20 text-primary-400' : 'bg-emerald-500/20 text-emerald-400'">
                <UIcon :name="msg.role === 'user' ? 'i-heroicons-user' : 'i-heroicons-sparkles'" class="w-4 h-4" />
              </div>
              <div class="px-4 py-3 rounded-2xl max-w-[85%]" :class="msg.role === 'user' ? 'bg-primary-500/10 text-slate-200 border border-primary-500/20 rounded-tr-none' : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 rounded-tl-none'">
                <div class="whitespace-pre-wrap leading-relaxed" v-html="formatChatMessage(msg.content)"></div>
                <div v-if="msg.role === 'assistant' && !msg.content && aiLoading" class="flex items-center gap-1 mt-1 text-emerald-500">
                  <div class="w-1.5 h-1.5 bg-current rounded-full animate-bounce"></div>
                  <div class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
                  <div class="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style="animation-delay: 0.4s"></div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="p-4 border-t border-slate-800 bg-slate-900/50">
            <form @submit.prevent="sendChatMessage" class="relative">
              <UInput
                v-model="chatInput"
                placeholder="Berikan instruksi tambahan ke AI..."
                :ui="{ wrapper: 'w-full', base: 'pl-4 pr-12 py-2.5', rounded: 'rounded-full' }"
                :disabled="aiLoading"
              />
              <UButton
                type="submit"
                icon="i-heroicons-paper-airplane"
                color="primary"
                variant="ghost"
                class="absolute right-1 top-1 bottom-1 px-3 rounded-full hover:bg-primary-500/10"
                :loading="aiLoading"
                :disabled="!chatInput.trim() || aiLoading"
              />
            </form>
          </div>
        </div>
      </div>
    </UCard>
      </div>
    </div>

    <div class="text-slate-500 text-xs text-right mt-6">Generated: {{ data?.generatedAt || '-' }}</div>

    <!-- Clarification Modal -->
    <div v-if="isClarificationModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4" @click.self="isClarificationModalOpen = false">
      <div class="w-full max-w-lg animate-[fade-in_0.2s_ease-out]">
        <UCard :ui="{ ring: 'ring-1 ring-slate-800', divide: 'divide-y divide-slate-800', background: 'bg-slate-900', shadow: 'shadow-2xl' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-base font-semibold leading-6 text-white">
              Adjust AI Report
            </h3>
            <UButton color="gray" variant="ghost" icon="i-heroicons-x-mark-20-solid" class="-my-1" @click="isClarificationModalOpen = false" />
          </div>
        </template>
        
        <div class="space-y-4">
          <p class="text-sm text-slate-400">
            Apakah ada hasil pengelompokan yang kurang tepat? Berikan instruksi tambahan agar AI dapat memperbaiki laporannya.
          </p>
          <UTextarea
            v-model="clarificationText"
            placeholder="Contoh: Pisahkan fitur X dan Y menjadi dua baris yang berbeda..."
            :rows="4"
            class="w-full"
          />
        </div>

        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="soft" @click="isClarificationModalOpen = false">Batal</UButton>
            <UButton color="primary" :loading="clarificationLoading" @click="generateAIReport(clarificationText)">Kirim Revisi</UButton>
          </div>
        </template>
      </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

useHead({ title: 'PBI Monthly Progress · Sprint Platform Dashboard' })

const isHeroExpanded = ref(true)
const isMainTableExpanded = ref(true)

const isMgmtTableExpanded = ref(true)

const aiLoading = ref(false)
const aiGeneratedRows = ref<any[] | null>(null)

const chatHistory = ref<{role: 'user'|'assistant', content: string}[]>([])
const chatInput = ref('')

// Function to clean JSON block from chat message for display
function formatChatMessage(content: string) {
  // Strip out markdown JSON blocks from display text
  let text = content.replace(/```json[\s\S]*?```/g, '')
  text = text.replace(/\n{3,}/g, '\n\n') // clean up excessive newlines
  return text.trim() || ''
}

// Extract JSON block from AI response to update the table
function extractAndApplyJSON(content: string) {
  const match = content.match(/```json\n([\s\S]*?)\n```/)
  if (match && match[1]) {
    try {
      const parsed = JSON.parse(match[1])
      if (Array.isArray(parsed)) {
        aiGeneratedRows.value = parsed.map((r, i) => ({ ...r, original: r, id: 'ai-' + i }))
      }
    } catch (e) {
      console.error('Failed to parse streaming JSON:', e)
    }
  }
}

async function sendChatMessage() {
  if (!chatInput.value.trim() || aiLoading.value) return
  
  const userText = chatInput.value
  chatInput.value = ''
  
  chatHistory.value.push({ role: 'user', content: userText })
  await streamAIResponse()
}

async function generateAIReport() {
  if (aiLoading.value) return
  if (chatHistory.value.length === 0) {
    chatHistory.value.push({ role: 'user', content: 'Tolong buatkan laporan manajemen dari data PBI ini.' })
  }
  await streamAIResponse()
}

async function streamAIResponse() {
  aiLoading.value = true
  // Insert placeholder for AI
  const aiMsg = { role: 'assistant', content: '' }
  chatHistory.value.push(aiMsg as any)
  
  try {
    const res = await fetch('/api/generate-ai-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: managementRows.value, chatHistory: chatHistory.value.slice(0, -1) })
    })

    if (!res.body) throw new Error('No stream available')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''
      
      for (const block of lines) {
        const line = block.split('\n').find(l => l.startsWith('data: '))
        if (line && !line.includes('[DONE]')) {
          try {
            const data = JSON.parse(line.slice(6))
            aiMsg.content += data.choices[0].delta?.content || ''
            
            // As we stream, we can attempt to extract JSON if it finishes the block
            extractAndApplyJSON(aiMsg.content)
          } catch (e) { }
        }
      }
    }
    
    // Final extraction
    extractAndApplyJSON(aiMsg.content)

  } catch (err: any) {
    alert('Gagal menghubungi server AI')
  } finally {
    aiLoading.value = false
  }
}

function resetAIReport() {
  aiGeneratedRows.value = null
  chatHistory.value = []
}






const leftWidth = ref(50)
const isDragging = ref(false)
const splitContainer = ref<HTMLElement | null>(null)

function startDrag() {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value || !splitContainer.value) return
  const rect = splitContainer.value.getBoundingClientRect()
  const offsetX = e.clientX - rect.left
  const newWidth = (offsetX / rect.width) * 100
  if (newWidth > 20 && newWidth < 80) {
    leftWidth.value = newWidth
  }
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  localStorage.setItem('pbiSplitWidth', String(leftWidth.value))
}

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
  
  const storedMain = localStorage.getItem('pbiMainExpanded')
  if (storedMain !== null) isMainTableExpanded.value = storedMain === 'true'

  const storedMgmt = localStorage.getItem('pbiMgmtExpanded')
  if (storedMgmt !== null) isMgmtTableExpanded.value = storedMgmt === 'true'

  const storedSplit = localStorage.getItem('pbiSplitWidth')
  if (storedSplit !== null) leftWidth.value = Number(storedSplit)

  loadData()
})

watch(isHeroExpanded, (val) => {
  localStorage.setItem('pbiHeroExpanded', String(val))
})

watch(isMainTableExpanded, (val) => {
  localStorage.setItem('pbiMainExpanded', String(val))
})

watch(isMgmtTableExpanded, (val) => {
  localStorage.setItem('pbiMgmtExpanded', String(val))
// Auto-reset when filters change
watch([selectedMonth, selectedYear, selectedTeam, dateRange], () => {
  resetAIReport()
}, { deep: true })
</script>
