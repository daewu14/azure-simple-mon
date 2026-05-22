export const useTeam = () => {
  const config = useRuntimeConfig()
  const defaultTeam = config.public.defaultTeam as string || 'Platform Squad'
  const route = useRoute()

  const selectedTeam = computed(() => {
    const q = route.query.team as string
    if (q) return q
    if (import.meta.client) {
      try { return localStorage.getItem('platformSelectedTeam') || defaultTeam } catch { return defaultTeam }
    }
    return defaultTeam
  })

  const setTeam = (team: string) => {
    if (import.meta.client) {
      try { localStorage.setItem('platformSelectedTeam', team) } catch {}
    }
    const router = useRouter()
    router.push({ query: { ...route.query, team } })
  }

  return { selectedTeam, setTeam, defaultTeam }
}
