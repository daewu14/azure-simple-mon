import crypto from 'node:crypto'
import type { H3Event } from 'h3'
import { getCookie } from 'h3'

const SESSION_COOKIE = 'platform_sprint_session'

function getAuthConfig() {
  const config = useRuntimeConfig()
  return {
    username: config.dashboardAuthUsername || '',
    salt: config.dashboardAuthSalt || '',
    hash: config.dashboardAuthPasswordSha256 || '',
    secret: config.dashboardSessionSecret || crypto.randomBytes(32).toString('hex'),
  }
}

export function hashPassword(salt: string, password: string): string {
  return crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ''), 'utf8')
  const right = Buffer.from(String(b || ''), 'utf8')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

export function signSession(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSession(username: string): string {
  const { secret } = getAuthConfig()
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url')
  return `${payload}.${signSession(payload, secret)}`
}

export function isAuthenticated(event: H3Event): boolean {
  const { username, salt, hash, secret } = getAuthConfig()
  if (!salt || !hash) return true // auth disabled
  const token = getCookie(event, SESSION_COOKIE) || ''
  if (!token || !token.includes('.')) return false
  const [payload, signature] = token.split('.', 2)
  if (!payload || !signature) return false
  if (!safeEqual(signature, signSession(payload, secret))) return false
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return session.username === username && Number(session.exp || 0) > Date.now()
  } catch {
    return false
  }
}

export function verifyLogin(username: string, password: string): boolean {
  const { username: validUsername, salt, hash } = getAuthConfig()
  if (!salt || !hash) return false
  return safeEqual(username, validUsername) && safeEqual(hashPassword(salt, password), hash)
}

export function authCookieValue(value: string, maxAge = 12 * 60 * 60): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

export function isAuthEnabled(): boolean {
  const { salt, hash } = getAuthConfig()
  return Boolean(salt && hash)
}

export { SESSION_COOKIE }
