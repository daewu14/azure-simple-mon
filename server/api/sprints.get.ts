export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const team = String(q.team || '')
  const project = q.project ? String(q.project) : undefined
  const sprints = await safeListSprints(team, project)
  return { team: normalizeTeamName(team), sprints }
})
