<template>
  <div>
    <useHead><title>Welcome Wizard · Sprint Platform Dashboard</title></useHead>

    <!-- Hero -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-8 mb-6 relative overflow-hidden">
      <div class="absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
      <div class="text-orange-400 text-xs font-black uppercase tracking-widest mb-3">Welcome Wizard · Azure DevOps</div>
      <h1 class="text-4xl md:text-5xl font-black text-white tracking-tight leading-none mb-4">
        Mulai dari sini untuk<br />monitoring Platform Sprint.
      </h1>
      <p class="text-slate-400 text-base leading-relaxed max-w-2xl mb-6">
        Gunakan sidebar untuk akses fitur per kebutuhan: PBI Ready Release yang bisa expand task per PBI,
        timeline Gantt untuk melihat perjalanan state task, atau Progress Minggu Lalu untuk melihat task yang
        sempat In Progress minggu lalu.
      </p>
      <div class="flex flex-wrap gap-3">
        <UButton to="/dashboard" color="primary" class="font-black">Buka PBI Ready Release →</UButton>
        <UButton to="/timeline" variant="outline" color="neutral" class="font-bold">Buka Timeline Gantt →</UButton>
        <UButton to="/progress" variant="outline" color="neutral" class="font-bold">Progress Minggu Lalu →</UButton>
      </div>
    </div>

    <!-- Feature cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
      <div v-for="f in features" :key="f.href" class="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6 flex flex-col hover:border-orange-500/30 transition-colors">
        <div class="text-2xl mb-4">{{ f.icon }}</div>
        <h2 class="text-lg font-black text-white mb-2">{{ f.title }}</h2>
        <p class="text-slate-400 text-sm leading-relaxed flex-1 mb-4">{{ f.desc }}</p>
        <UButton :to="f.href" variant="link" color="primary" class="font-bold p-0">Masuk {{ f.title }} →</UButton>
      </div>
    </div>

    <!-- Quick Start -->
    <div class="bg-slate-900/70 border border-slate-700/40 rounded-2xl p-6">
      <h2 class="text-lg font-black text-white mb-3">Quick Start</h2>
      <ol class="text-slate-300 text-sm leading-loose list-decimal list-inside space-y-1">
        <li>Pilih fitur dari sidebar kiri.</li>
        <li>Pilih sprint dari dropdown, default akan mencoba current sprint atau Sprint 9.</li>
        <li>Gunakan search/filter untuk menemukan PBI, task, assignee, state, atau reason.</li>
        <li>Klik baris PBI di halaman Ready Release untuk expand/collapse list task.</li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: 'Welcome Wizard · Sprint Platform Dashboard' })

const features = [
  { href: '/dashboard', icon: '🚀', title: 'PBI Ready Release', desc: 'Menarik Product Backlog Item yang siap release berdasarkan PBI Resolved, task On Review Product, atau task Release Plan.' },
  { href: '/timeline', icon: '📈', title: 'Timeline Gantt', desc: 'Monitoring history state task: In Progress, On Review QA, On Review Product, Release Plan, sampai Released.' },
  { href: '/progress', icon: '🗓️', title: 'Progress Minggu Lalu', desc: 'Menampilkan task yang berada di state In Progress pada minggu sebelumnya, lengkap dengan durasi overlap dan parent PBI.' },
]
</script>
