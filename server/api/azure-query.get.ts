const queryIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const defaultQueryId = String(config.azureDevOpsDefaultQueryId || '')
  const q = getQuery(event)
  const queryId = String(q.queryId || defaultQueryId).trim()
  const activatedStart = String(q.activatedStart || '').trim()
  const activatedEnd = String(q.activatedEnd || '').trim()
  const assignedTo = typeof q.assignedTo === 'string' ? q.assignedTo.trim() : ''

  if (!queryIdPattern.test(queryId)) {
    throw createError({ statusCode: 400, statusMessage: 'Query ID Azure DevOps tidak valid.' })
  }
  if (activatedStart && !datePattern.test(activatedStart)) {
    throw createError({ statusCode: 400, statusMessage: 'Activated Date start harus format YYYY-MM-DD.' })
  }
  if (activatedEnd && !datePattern.test(activatedEnd)) {
    throw createError({ statusCode: 400, statusMessage: 'Activated Date end harus format YYYY-MM-DD.' })
  }
  if (activatedStart && activatedEnd && activatedStart > activatedEnd) {
    throw createError({ statusCode: 400, statusMessage: 'Activated Date start tidak boleh lebih besar dari end.' })
  }
  if (assignedTo && !savedQueryAssignees.includes(assignedTo as typeof savedQueryAssignees[number])) {
    throw createError({ statusCode: 400, statusMessage: 'PBI Assigned To tidak tersedia.' })
  }

  return safeSavedQueryWorkItems(queryId, { activatedStart, activatedEnd, assignedTo })
})
