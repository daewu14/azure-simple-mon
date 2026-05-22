import { isAuthenticated, isAuthEnabled } from '../utils/auth'

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  // Skip public routes
  if (path === '/login' || path === '/api/auth/login' || path === '/api/auth/logout' || path === '/healthz') return

  const protectedPages = ['/', '/dashboard', '/timeline', '/progress']
  const isPage = protectedPages.includes(path)
  const isApi = path.startsWith('/api/')

  if (!isPage && !isApi) return
  if (!isAuthEnabled()) return // auth disabled
  if (isAuthenticated(event)) return

  if (isApi) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  return sendRedirect(event, '/login')
})
