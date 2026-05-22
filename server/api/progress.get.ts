export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const team = String(q.team || '')
  const sprints = await safeListSprints(team)
  const defaultSprint = sprints.find((s) => s.timeFrame === 'current') || sprints[0]
  const sprintPath = String(q.sprintPath || defaultSprint?.path || '')
  return safeLastWeekProgress(sprintPath, team)
})
