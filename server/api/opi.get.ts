import { getOpiData } from '../utils/azure'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    return await getOpiData(query.startDate as string, query.endDate as string)
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to fetch OPI data',
    })
  }
})
