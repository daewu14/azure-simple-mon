export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const team = String(q.team || '')
  const sprints = await safeListSprints(team)
  return { team: normalizeTeamName(team), sprints }
})
