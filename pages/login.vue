<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-6">
    <div class="w-full max-w-md">
      <!-- Card -->
      <div class="bg-slate-900/90 border border-slate-700/50 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
        <div class="text-orange-400 text-xs font-black uppercase tracking-widest mb-3">Azure DevOps · Product Delivery</div>
        <h1 class="text-3xl font-black text-white tracking-tight mb-2">Login Dashboard</h1>
        <p class="text-slate-400 text-sm mb-6">Masuk untuk melihat Platform Sprint Dashboard.</p>

        <UAlert v-if="error" color="error" variant="soft" :description="error" class="mb-4" />

        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <UFormField label="Username" name="username">
            <UInput
              v-model="form.username"
              type="email"
              autocomplete="username"
              autofocus
              required
              class="w-full"
            />
          </UFormField>
          <UFormField label="Password" name="password">
            <UInput
              v-model="form.password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full"
            />
          </UFormField>
          <UButton type="submit" color="primary" class="w-full justify-center font-black mt-2" :loading="loading">
            Masuk
          </UButton>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Login · Sprint Platform Dashboard' })

const router = useRouter()
const form = reactive({ username: '', password: '' })
const error = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    router.push('/')
  } catch (e: unknown) {
    error.value = (e as { statusMessage?: string }).statusMessage || 'Login gagal.'
  } finally {
    loading.value = false
  }
}
</script>
