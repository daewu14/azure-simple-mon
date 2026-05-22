<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 font-sans">
    <div class="flex">
      <!-- Sidebar -->
      <aside
        class="sticky top-0 h-screen flex-shrink-0 transition-all duration-300 flex flex-col gap-4 p-4 border-r border-slate-800/60 bg-slate-950/80 backdrop-blur-xl z-40"
        :class="collapsed ? 'w-20' : 'w-72'"
      >
        <!-- Brand -->
        <div class="flex items-center gap-3 px-1 pb-4 border-b border-slate-800/60 relative">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/30 to-amber-400/20 border border-orange-500/30 flex items-center justify-center font-black text-orange-400 text-sm flex-shrink-0">
            PD
          </div>
          <div v-if="!collapsed" class="overflow-hidden">
            <div class="font-black text-white text-sm leading-tight">Platform Sprint</div>
            <div class="text-slate-500 text-xs mt-0.5">Azure DevOps Monitor</div>
          </div>
          <button
            class="absolute right-0 top-0 w-7 h-7 rounded-lg bg-slate-800/70 border border-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/70 transition-colors"
            :class="collapsed ? 'static ml-auto mt-0' : ''"
            @click="collapsed = !collapsed"
          >
            <UIcon :name="collapsed ? 'i-heroicons-chevron-right' : 'i-heroicons-chevron-left'" class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Team Selector -->
        <div v-if="!collapsed" class="flex flex-col gap-1.5 pb-3 border-b border-slate-800/60">
          <label class="text-slate-500 text-[10px] font-black uppercase tracking-widest">Team</label>
          <select
            v-model="currentTeam"
            class="w-full bg-slate-800/80 border border-slate-700/60 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 cursor-pointer"
            @change="onTeamChange"
          >
            <option v-for="t in teams" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>

        <!-- Nav -->
        <nav class="flex flex-col gap-1.5 flex-1">
          <div v-if="!collapsed" class="text-slate-600 text-[10px] font-black uppercase tracking-widest px-2 mb-1">Features</div>
          <NuxtLink
            v-for="item in navItems"
            :key="item.href"
            :to="{ path: item.href, query: teamQuery }"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-150 group"
            :class="isActive(item.href)
              ? 'bg-orange-500/15 border-orange-500/30 text-orange-300'
              : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:border-slate-700/50 hover:text-slate-200'"
          >
            <span class="text-base flex-shrink-0">{{ item.icon }}</span>
            <div v-if="!collapsed" class="overflow-hidden">
              <div class="font-bold text-sm leading-tight">{{ item.label }}</div>
              <div class="text-xs mt-0.5 opacity-70">{{ item.desc }}</div>
            </div>
          </NuxtLink>
        </nav>

        <!-- Footer: hanya logout -->
        <div class="border-t border-slate-800/60 pt-3">
          <button
            class="flex items-center gap-2 text-red-400/80 hover:text-red-300 text-xs font-bold transition-colors px-1 w-full"
            @click="logout"
          >
            <UIcon name="i-heroicons-arrow-right-on-rectangle" class="w-4 h-4 flex-shrink-0" />
            <span v-if="!collapsed">Logout</span>
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 min-w-0 p-6">
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

const navItems = [
  { href: '/', icon: '🏠', label: 'Welcome Wizard', desc: 'Home & panduan fitur' },
  { href: '/dashboard', icon: '🚀', label: 'PBI Ready Release', desc: 'Expandable PBI & Task' },
  { href: '/timeline', icon: '📈', label: 'Timeline Gantt', desc: 'History state task' },
  { href: '/progress', icon: '🗓️', label: 'Progress Minggu Lalu', desc: 'Task In Progress last week' },
]

const teamQuery = computed(() => ({ team: selectedTeam.value }))

function isActive(href: string) {
  if (href === '/') return route.path === '/'
  return route.path.startsWith(href)
}

function onTeamChange() {
  setTeam(currentTeam.value)
}

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  router.push('/login')
}

onMounted(async () => {
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
