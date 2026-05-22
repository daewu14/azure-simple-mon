export default defineEventHandler(async (event) => {
  const team = String(getQuery(event).team || '')
  const teams = await safeListTeams()
  return { teams }
})
