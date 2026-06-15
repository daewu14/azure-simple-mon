export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const team = String(query.team || '')
  const month = query.month ? parseInt(String(query.month), 10) : new Date().getMonth() + 1
  const year = query.year ? parseInt(String(query.year), 10) : new Date().getFullYear()

  if (isNaN(month) || isNaN(year) || month < 1 || month > 12) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid month or year parameter' })
  }

  const data = await safeGetPbiMonthly(month, year, team)
  return data
})
