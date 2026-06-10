<template>
  <div class="min-h-screen bg-slate-950 font-sans">
    <div class="flex">
      <!-- Sidebar -->
      <aside
        class="sticky top-0 h-screen flex-shrink-0 transition-all duration-300 flex flex-col gap-4 p-3 border-r border-slate-800/60 bg-slate-950/80 backdrop-blur-xl z-40"
        :class="collapsed ? 'w-[72px]' : 'w-64'"
      >
        <!-- Brand -->
        <div class="flex items-center gap-3 px-1 pb-4 border-b border-slate-800/60 relative">
          <div class="w-8 h-8 rounded bg-primary-500/20 border border-primary-500/30 flex items-center justify-center font-black text-primary-400 text-xs flex-shrink-0">
            PD
          </div>
          <div v-if="!collapsed" class="overflow-hidden">
            <div class="font-bold text-white text-sm leading-tight">Platform Sprint</div>
          </div>
          <UButton
            variant="ghost"
            color="neutral"
            size="2xs"
            class="absolute right-0 top-0"
            :class="collapsed ? 'static ml-auto mt-0' : ''"
            :icon="collapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'"
            @click="collapsed = !collapsed"
          />
        </div>

        <!-- Team Selector -->
        <div v-if="!collapsed" class="pb-3 border-b border-slate-800/60">
          <label class="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1.5 block">Team</label>
          <USelectMenu
            v-model="currentTeam"
            :items="teams"
            @change="onTeamChange"
          />
        </div>

        <!-- Nav -->
        <nav class="flex-1 overflow-y-auto">
          <div v-if="!collapsed" class="text-slate-600 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">Features</div>
          <UNavigationMenu
            orientation="vertical"
            :items="[navLinks]"
            class="data-[orientation=vertical]:w-full"
            :ui="{ link: 'truncate' }"
          />
        </nav>

        <!-- Footer -->
        <div class="border-t border-slate-800/60 pt-3 flex flex-col gap-1">
          <UButton
            variant="ghost"
            color="neutral"
            block
            class="justify-start"
            :icon="isFullscreen ? 'i-heroicons-arrows-pointing-in' : 'i-heroicons-arrows-pointing-out'"
            @click="toggleFullscreen"
          >
            <span v-if="!collapsed">{{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}</span>
          </UButton>
          <UButton
            variant="ghost"
            color="red"
            block
            class="justify-start"
            icon="i-heroicons-arrow-right-on-rectangle"
            @click="logout"
          >
            <span v-if="!collapsed">Logout</span>
          </UButton>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0 p-4">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const { selectedTeam, setTeam, defaultTeam } = useTeam()

const collapsed = ref(false)
const teams = ref<string[]>([defaultTeam])
const currentTeam = ref(selectedTeam.value)

const teamQuery = computed(() => ({ team: selectedTeam.value }))

const navLinks = computed(() => [
  { label: 'Welcome Wizard', icon: 'i-heroicons-home', to: { path: '/', query: teamQuery.value } },
  { label: 'PBI Ready Release', icon: 'i-heroicons-rocket-launch', to: { path: '/dashboard', query: teamQuery.value } },
  { label: 'Timeline Gantt', icon: 'i-heroicons-chart-bar', to: { path: '/timeline', query: teamQuery.value } },
  { label: 'Progress Minggu Lalu', icon: 'i-heroicons-calendar-days', to: { path: '/progress', query: teamQuery.value } },
  { label: 'OPI Board', icon: 'i-heroicons-clipboard-document-list', to: { path: '/opi', query: teamQuery.value } },
])

function onTeamChange() {
  setTeam(currentTeam.value)
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
}

const isFullscreen = ref(false)

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {
      collapsed.value = true
    }).catch((err) => console.error(err))
  } else {
    document.exitFullscreen()
  }
}

onMounted(async () => {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = !!document.fullscreenElement
  })
  try {
    const saved = localStorage.getItem('platformSidebarCollapsed')
    if (saved === '1') collapsed.value = true
  } catch {}
  watch(collapsed, (v) => {
    try { localStorage.setItem('platformSidebarCollapsed', v ? '1' : '0') } catch {}
  })

  try {
    const data = await $fetch<{ teams: string[] }>('/api/teams')
    if (data.teams?.length) teams.value = data.teams
  } catch {}

  currentTeam.value = selectedTeam.value
})

watch(selectedTeam, (v) => { currentTeam.value = v })
</script>
