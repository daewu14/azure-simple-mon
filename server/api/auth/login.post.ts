import { verifyLogin, createSession, authCookieValue } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const username = String(body?.username || '')
  const password = String(body?.password || '')

  if (!verifyLogin(username, password)) {
    throw createError({ statusCode: 401, statusMessage: 'Username atau password salah.' })
  }

  const token = createSession(username)
  setCookie(event, 'platform_sprint_session', token, {
    path: '/', httpOnly: true, sameSite: 'lax', maxAge: 12 * 60 * 60,
  })
  return { ok: true }
})
