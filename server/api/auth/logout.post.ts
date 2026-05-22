export default defineEventHandler((event) => {
  deleteCookie(event, 'platform_sprint_session', { path: '/' })
  return { ok: true }
})
