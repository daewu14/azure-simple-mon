import http from 'node:http'
import crypto from 'node:crypto'

const port = Number(process.env.PORT || '5762')
const host = process.env.HOST || '0.0.0.0'
const org = process.env.AZURE_DEVOPS_ORG || 'KiriminAja2026'
const project = process.env.AZURE_DEVOPS_PROJECT || 'Product Delivery'
const defaultTeam = process.env.AZURE_DEVOPS_TEAM || 'Platform Squad'
const configuredTeams = (process.env.AZURE_DEVOPS_TEAMS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
const pat = process.env.AZURE_DEVOPS_PAT || ''
const dashboardUsername = process.env.DASHBOARD_AUTH_USERNAME || 'daewubintara@kiriminaja.com'
const dashboardPasswordSalt = process.env.DASHBOARD_AUTH_SALT || ''
const dashboardPasswordHash = process.env.DASHBOARD_AUTH_PASSWORD_SHA256 || ''
const dashboardSessionSecret = process.env.DASHBOARD_SESSION_SECRET || crypto.randomBytes(32).toString('hex')
const sessionCookieName = 'platform_sprint_session'
const baseWorkItemUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_workitems/edit/`
const apiVersion = '7.1'
const cache = new Map()
const cacheMs = 60_000

const fallbackSprint9Rows = [
  [1720, 'Platform want to handel webhook information from NinjaVan during delivery', 'Done', 'Rizqi Sarasajati', 'Task On Review Product', 2176, 'BE - Log Activity - Assesment webhook international logging', 'On Review Product', 'Devvara Rishivian'],
  [1720, 'Platform want to handel webhook information from NinjaVan during delivery', 'Done', 'Rizqi Sarasajati', 'Task On Review Product', 2174, 'BE - Webhook Expedition - Forward incoming webhook from ninja international', 'On Review Product', 'Devvara Rishivian'],
  [1720, 'Platform want to handel webhook information from NinjaVan during delivery', 'Done', 'Rizqi Sarasajati', 'Task On Review Product', 2094, 'BE - Webhook Core - Mapping status incoming webhook international', 'On Review Product', 'Devvara Rishivian'],
  [1720, 'Platform want to handel webhook information from NinjaVan during delivery', 'Done', 'Rizqi Sarasajati', 'Task On Review Product', 2175, 'BE - Tracking Service - Create endpoint tracking international', 'On Review Product', 'Devvara Rishivian'],
  [1987, 'Plugin Shopify want to handle cart page validation process', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved', null, '', '', ''],
  [2718, 'MitraAPI wants to send a webhook with a shipment issue status to the Shopify plugin', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved', null, '', '', ''],
  [2719, 'Shopify plugin wants to handle problem shipment status webhooks from the KiriminAja MitraAPI', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved', null, '', '', ''],
  [2746, 'Shopify want to handling update delivery status in Shopify Native Order for Express Delivery', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved', null, '', '', ''],
  [3213, '[ADHC] Platform wants to redirect the old Ninja webhook URL to the new Ninja URL', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved + Task On Review Product', 3217, '[QA][ADHC] Platform wants to redirect the old Ninja webhook URL to the new Ninja URL', 'On Review Product', 'Laksana Adi'],
  [3213, '[ADHC] Platform wants to redirect the old Ninja webhook URL to the new Ninja URL', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved + Task On Review Product', 3214, 'BE - Core Webhook - Redirect ninja url to webhook expedition ninja url', 'On Review Product', 'Devvara Rishivian'],
  [3213, '[ADHC] Platform wants to redirect the old Ninja webhook URL to the new Ninja URL', 'Resolved', 'Rizqi Sarasajati', 'PBI Resolved + Task On Review Product', 3215, 'BE - Webhook Expedition - Add flag webhook from webhook expedition', 'On Review Product', 'Devvara Rishivian']
].map(([pbiId, pbiTitle, pbiState, pbiAssignedTo, reason, taskId, taskTitle, taskState, taskAssignedTo]) => ({
  pbiId, pbiTitle, pbiState, pbiAssignedTo, reason, taskId, taskTitle, taskState, taskAssignedTo
}))

const fallbackSprints = [
  { id: 'fallback-sprint-9', name: 'Sprint 9 - Platform Squad', path: 'Product Delivery\\Sprint 9 - Platform Squad', timeFrame: 'current' }
]

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function wiqlQuote(value) {
  return String(value).replaceAll("'", "''")
}

function assignedName(value) {
  if (!value) return ''
  if (typeof value === 'object') return value.displayName || value.uniqueName || ''
  return String(value)
}

function getStats(rows, meta = {}) {
  const uniquePbis = [...new Map(rows.map((row) => [row.pbiId, row])).values()]
  return {
    uniquePbis: meta.readyReleasePbis ?? uniquePbis.length,
    detailRows: meta.taskRows ?? rows.length,
    resolvedPbis: meta.resolvedPbis ?? uniquePbis.filter((row) => row.pbiState === 'Resolved').length,
    reviewTasks: meta.reviewTasks ?? rows.filter((row) => row.taskState === 'On Review Product').length,
    releasePlanTasks: meta.releasePlanTasks ?? rows.filter((row) => row.taskState === 'Release Plan').length,
    pbiInSprint: meta.pbiInSprint ?? uniquePbis.length,
    childItemsScanned: meta.childItemsScanned ?? rows.filter((row) => row.taskId).length
  }
}

function rowsToPbis(rows) {
  const byPbi = new Map()
  for (const row of rows) {
    if (!byPbi.has(row.pbiId)) {
      byPbi.set(row.pbiId, {
        pbiId: row.pbiId,
        pbiTitle: row.pbiTitle || '',
        pbiState: row.pbiState || '',
        pbiAssignedTo: row.pbiAssignedTo || '',
        reason: row.reason || '',
        taskCount: 0,
        reviewTaskCount: 0,
        releasePlanTaskCount: 0,
        tasks: []
      })
    }
    const pbi = byPbi.get(row.pbiId)
    if (row.reason && row.reason.length > pbi.reason.length) pbi.reason = row.reason
    if (row.taskId) {
      pbi.tasks.push({
        taskId: row.taskId,
        taskTitle: row.taskTitle || '',
        taskState: row.taskState || '',
        taskAssignedTo: row.taskAssignedTo || ''
      })
    }
  }
  for (const pbi of byPbi.values()) {
    pbi.taskCount = pbi.tasks.length
    pbi.reviewTaskCount = pbi.tasks.filter((task) => task.taskState === 'On Review Product').length
    pbi.releasePlanTaskCount = pbi.tasks.filter((task) => task.taskState === 'Release Plan').length
  }
  return [...byPbi.values()]
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(`${dashboardPasswordSalt}:${password}`).digest('hex')
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8')
  const right = Buffer.from(String(b || ''), 'utf8')
  return left.length === right.length && crypto.timingSafeEqual(left, right)
}

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=')
    return [decodeURIComponent(name || ''), decodeURIComponent(rest.join('=') || '')]
  }).filter(([name]) => name))
}

function signSession(payload) {
  return crypto.createHmac('sha256', dashboardSessionSecret).update(payload).digest('base64url')
}

function createSession(username) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url')
  return `${payload}.${signSession(payload)}`
}

function isAuthenticated(request) {
  const token = parseCookies(request)[sessionCookieName]
  if (!token || !token.includes('.')) return false
  const [payload, signature] = token.split('.', 2)
  if (!safeEqual(signature, signSession(payload))) return false
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return session.username === dashboardUsername && Number(session.exp || 0) > Date.now()
  } catch {
    return false
  }
}

function verifyLogin(username, password) {
  if (!dashboardPasswordSalt || !dashboardPasswordHash) return false
  return safeEqual(username, dashboardUsername) && safeEqual(hashPassword(password), dashboardPasswordHash)
}

function redirect(response, location, headers = {}) {
  response.writeHead(302, { location, 'cache-control': 'no-store', ...headers })
  response.end()
}

function authCookie(value, maxAge = 12 * 60 * 60) {
  return `${sessionCookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

async function readForm(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('Request body too large')
    chunks.push(chunk)
  }
  return new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
}

function authHeaders() {
  if (!pat) throw new Error('AZURE_DEVOPS_PAT is not set')
  return {
    authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
    accept: 'application/json'
  }
}

async function adoFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(30_000)
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`Azure DevOps ${response.status}: ${text.slice(0, 500)}`)
  return text.trim() ? JSON.parse(text) : null
}

function normalizeTeamName(value) {
  return String(value || '').trim() || defaultTeam
}

function teamCacheKey(teamName) {
  return encodeURIComponent(normalizeTeamName(teamName))
}

async function listTeams() {
  const key = 'teams'
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  let teams = []
  if (configuredTeams.length) {
    teams = configuredTeams
  } else {
    const url = `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(project)}/teams?api-version=${apiVersion}`
    const data = await adoFetch(url)
    teams = (data.value || []).map((item) => item.name).filter(Boolean)
  }

  if (!teams.includes(defaultTeam)) teams.unshift(defaultTeam)
  const value = [...new Set(teams)].sort((a, b) => a.localeCompare(b))
  cache.set(key, { at: Date.now(), value })
  return value
}

async function listSprints(teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  const key = `sprints:${teamCacheKey(selectedTeam)}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value
  const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/${encodeURIComponent(selectedTeam)}/_apis/work/teamsettings/iterations?api-version=${apiVersion}`
  const data = await adoFetch(url)
  const sprints = (data.value || []).map((item) => ({
    id: item.id,
    name: item.name,
    path: item.path,
    timeFrame: item.attributes?.timeFrame || ''
  }))
  cache.set(key, { at: Date.now(), value: sprints })
  return sprints
}

async function batchWorkItems(ids, { fields, expand } = {}) {
  const result = []
  for (let i = 0; i < ids.length; i += 200) {
    const body = { ids: ids.slice(i, i + 200), errorPolicy: 'Omit' }
    if (fields && !expand) body.fields = fields
    if (expand) body.$expand = expand
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitemsbatch?api-version=${apiVersion}`
    const data = await adoFetch(url, { method: 'POST', body: JSON.stringify(body) })
    result.push(...(data.value || []))
  }
  return result
}

async function getWorkItemRevisions(id) {
  const all = []
  let skip = 0
  const top = 200
  while (true) {
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workItems/${id}/revisions?$top=${top}&$skip=${skip}&api-version=${apiVersion}`
    const data = await adoFetch(url)
    const value = data.value || []
    all.push(...value)
    if (value.length < top) break
    skip += top
  }
  return all
}

function stateName(value) {
  return String(value || '').trim()
}

function toIsoDate(value) {
  const date = new Date(value || Date.now())
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
}

function addDaysIso(value, days) {
  return new Date(new Date(value).getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

function getTimelineStats(items) {
  const withTimeline = items.filter((item) => item.segments.length > 0)
  const released = items.filter((item) => item.releasedAt)
  const cycleDays = released
    .map((item) => item.cycleDays)
    .filter((value) => Number.isFinite(value))
  return {
    totalTasks: items.length,
    tasksWithTimeline: withTimeline.length,
    releasedTasks: released.length,
    avgCycleDays: cycleDays.length ? Math.round((cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length) * 10) / 10 : null
  }
}

async function getSprintTimeline(sprintPath, teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  const key = `timeline:${teamCacheKey(selectedTeam)}:${sprintPath}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  const wiql = `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = '${wiqlQuote(project)}'
      AND [System.WorkItemType] = 'Task'
      AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}'
    ORDER BY [System.Id]
  `
  const wiqlUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${apiVersion}`
  const wiqlData = await adoFetch(wiqlUrl, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const taskIds = (wiqlData.workItems || []).map((item) => item.id)
  const fields = ['System.Id', 'System.Title', 'System.State', 'System.AssignedTo', 'System.Parent', 'System.IterationPath', 'System.ChangedDate']
  const taskItems = taskIds.length ? await batchWorkItems(taskIds, { fields }) : []
  const trackedStates = new Set(['In Progress', 'On Review QA', 'On Review Product', 'Release Plan', 'Released'])
  const nowIso = new Date().toISOString()
  const items = []

  for (const task of taskItems) {
    const tf = task.fields || {}
    let revisionWarning = ''
    let revisions = []
    try {
      revisions = await getWorkItemRevisions(task.id)
    } catch (error) {
      revisionWarning = error.message || 'Failed to fetch revisions'
    }

    const changes = []
    let lastState = ''
    for (const revision of revisions) {
      const rf = revision.fields || {}
      const currentState = stateName(rf['System.State'])
      if (!currentState || currentState === lastState) continue
      lastState = currentState
      changes.push({ state: currentState, at: toIsoDate(rf['System.ChangedDate'] || rf['System.RevisedDate']) })
    }

    const segments = []
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]
      if (!trackedStates.has(change.state)) continue
      const next = changes.slice(i + 1).find((item) => item.at > change.at)
      const end = next?.at || (change.state === 'Released' ? addDaysIso(change.at, 1) : nowIso)
      segments.push({ state: change.state, start: change.at, end, current: !next && change.state !== 'Released' })
    }

    const inProgressAt = changes.find((item) => item.state === 'In Progress')?.at || null
    const releasedAt = changes.find((item) => item.state === 'Released')?.at || null
    const cycleDays = inProgressAt && releasedAt ? Math.max(0, (new Date(releasedAt) - new Date(inProgressAt)) / 86_400_000) : null

    items.push({
      taskId: task.id,
      taskTitle: tf['System.Title'] || '',
      taskState: tf['System.State'] || '',
      taskAssignedTo: assignedName(tf['System.AssignedTo']),
      parentId: tf['System.Parent'] || null,
      changedAt: tf['System.ChangedDate'] || '',
      inProgressAt,
      releasedAt,
      cycleDays: Number.isFinite(cycleDays) ? Math.round(cycleDays * 10) / 10 : null,
      segments,
      changes,
      warning: revisionWarning
    })
  }

  const value = {
    generatedAt: new Date().toISOString(),
    team: selectedTeam,
    sprintPath,
    trackedStates: [...trackedStates],
    items,
    stats: getTimelineStats(items)
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

async function getSprintData(sprintPath, teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  const key = `data:${teamCacheKey(selectedTeam)}:${sprintPath}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  const wiql = `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = '${wiqlQuote(project)}'
      AND [System.WorkItemType] = 'Product Backlog Item'
      AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}'
    ORDER BY [System.Id]
  `
  const wiqlUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${apiVersion}`
  const wiqlData = await adoFetch(wiqlUrl, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const pbiIds = (wiqlData.workItems || []).map((item) => item.id)

  const pbiItems = pbiIds.length ? await batchWorkItems(pbiIds, { expand: 'Relations' }) : []
  const childIds = []
  const childrenByParent = new Map()

  for (const pbi of pbiItems) {
    const links = pbi.relations || []
    for (const rel of links) {
      if (rel.rel !== 'System.LinkTypes.Hierarchy-Forward') continue
      const childId = Number(rel.url.split('/').pop())
      if (!Number.isFinite(childId)) continue
      childIds.push(childId)
      if (!childrenByParent.has(pbi.id)) childrenByParent.set(pbi.id, [])
      childrenByParent.get(pbi.id).push(childId)
    }
  }

  const fields = ['System.Id', 'System.WorkItemType', 'System.Title', 'System.State', 'System.AssignedTo', 'System.AreaPath', 'System.IterationPath', 'System.Tags', 'System.Parent']
  const childItems = childIds.length ? await batchWorkItems([...new Set(childIds)], { fields }) : []
  const childById = new Map(childItems.map((item) => [item.id, item]))
  const rows = []
  const pbis = []

  for (const pbi of pbiItems) {
    const pf = pbi.fields || {}
    const pbiState = pf['System.State'] || ''
    const isResolved = pbiState.toLowerCase() === 'resolved'
    const allChildren = (childrenByParent.get(pbi.id) || [])
      .map((id) => childById.get(id))
      .filter(Boolean)
    const reviewChildren = allChildren
      .filter((child) => (child.fields?.['System.State'] || '').toLowerCase() === 'on review product')
    const releasePlanChildren = allChildren
      .filter((child) => (child.fields?.['System.State'] || '').toLowerCase() === 'release plan')

    if (!isResolved && reviewChildren.length === 0 && releasePlanChildren.length === 0) continue

    const reasons = []
    if (isResolved) reasons.push('PBI Resolved')
    if (reviewChildren.length > 0) reasons.push('Task On Review Product')
    if (releasePlanChildren.length > 0) reasons.push('Task Release Plan')
    const reason = reasons.join(' + ')
    const tasks = allChildren.map((child) => {
      const cf = child.fields || {}
      return {
        taskId: child.id,
        taskTitle: cf['System.Title'] || '',
        taskState: cf['System.State'] || '',
        taskAssignedTo: assignedName(cf['System.AssignedTo'])
      }
    })

    pbis.push({
      pbiId: pbi.id,
      pbiTitle: pf['System.Title'] || '',
      pbiState,
      pbiAssignedTo: assignedName(pf['System.AssignedTo']),
      reason,
      taskCount: tasks.length,
      reviewTaskCount: reviewChildren.length,
      releasePlanTaskCount: releasePlanChildren.length,
      tasks
    })

    const rowChildren = [...new Map([...reviewChildren, ...releasePlanChildren].map((child) => [child.id, child])).values()]
    if (rowChildren.length > 0) {
      for (const child of rowChildren) {
        const cf = child.fields || {}
        rows.push({
          pbiId: pbi.id,
          pbiTitle: pf['System.Title'] || '',
          pbiState,
          pbiAssignedTo: assignedName(pf['System.AssignedTo']),
          reason,
          taskId: child.id,
          taskTitle: cf['System.Title'] || '',
          taskState: cf['System.State'] || '',
          taskAssignedTo: assignedName(cf['System.AssignedTo'])
        })
      }
    } else {
      rows.push({
        pbiId: pbi.id,
        pbiTitle: pf['System.Title'] || '',
        pbiState,
        pbiAssignedTo: assignedName(pf['System.AssignedTo']),
        reason,
        taskId: null,
        taskTitle: '',
        taskState: '',
        taskAssignedTo: ''
      })
    }
  }

  const value = {
    generatedAt: new Date().toISOString(),
    team: selectedTeam,
    sprintPath,
    rows,
    pbis,
    stats: getStats(rows, { pbiInSprint: pbiIds.length, childItemsScanned: new Set(childIds).size, readyReleasePbis: pbis.length, taskRows: pbis.reduce((sum, pbi) => sum + pbi.taskCount, 0), resolvedPbis: pbis.filter((pbi) => pbi.pbiState === 'Resolved').length, reviewTasks: pbis.reduce((sum, pbi) => sum + pbi.reviewTaskCount, 0), releasePlanTasks: pbis.reduce((sum, pbi) => sum + pbi.releasePlanTaskCount, 0) })
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

async function safeListTeams() {
  try { return await listTeams() } catch (error) { console.error(error); return [defaultTeam] }
}

function fallbackSprintsForTeam(teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  if (selectedTeam === defaultTeam) return fallbackSprints
  return fallbackSprints.map((sprint) => ({
    ...sprint,
    id: `${sprint.id}-${teamCacheKey(selectedTeam)}`,
    name: sprint.name.replace(defaultTeam, selectedTeam),
    path: sprint.path.replace(defaultTeam, selectedTeam)
  }))
}

async function safeListSprints(teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  try { return await listSprints(selectedTeam) } catch (error) { console.error(error); return fallbackSprintsForTeam(selectedTeam) }
}

async function safeSprintData(sprintPath, teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  try { return await getSprintData(sprintPath, selectedTeam) } catch (error) {
    console.error(error)
    const rows = selectedTeam === defaultTeam && sprintPath.includes('Sprint 9') ? fallbackSprint9Rows : []
    const pbis = rowsToPbis(rows)
    return { generatedAt: new Date().toISOString(), team: selectedTeam, sprintPath, rows, pbis, stats: getStats(rows, { pbiInSprint: rows.length && sprintPath.includes('Sprint 9') ? 31 : 0, childItemsScanned: rows.length && sprintPath.includes('Sprint 9') ? 116 : 0, readyReleasePbis: pbis.length, taskRows: pbis.reduce((sum, pbi) => sum + pbi.taskCount, 0), resolvedPbis: pbis.filter((pbi) => pbi.pbiState === 'Resolved').length, reviewTasks: pbis.reduce((sum, pbi) => sum + pbi.reviewTaskCount, 0), releasePlanTasks: pbis.reduce((sum, pbi) => sum + (pbi.releasePlanTaskCount || 0), 0) }), warning: error.message }
  }
}

async function safeSprintTimeline(sprintPath, teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  try { return await getSprintTimeline(sprintPath, selectedTeam) } catch (error) {
    console.error(error)
    return { generatedAt: new Date().toISOString(), team: selectedTeam, sprintPath, trackedStates: ['In Progress', 'On Review QA', 'On Review Product', 'Release Plan', 'Released'], items: [], stats: getTimelineStats([]), warning: error.message }
  }
}

function previousWeekRange(referenceDate = new Date()) {
  const reference = new Date(referenceDate)
  const localMidnight = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate())
  const day = localMidnight.getDay()
  const daysSinceMonday = (day + 6) % 7
  const currentWeekStart = new Date(localMidnight)
  currentWeekStart.setDate(localMidnight.getDate() - daysSinceMonday)
  const start = new Date(currentWeekStart)
  start.setDate(currentWeekStart.getDate() - 7)
  const end = new Date(currentWeekStart)
  const label = `${start.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(end.getTime() - 1).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}`
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString(), label }
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB
}

function roundHours(hours) {
  return Math.round((Number(hours) || 0) * 10) / 10
}

function isWorkday(date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function workHoursBetween(startMs, endMs) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0
  let totalMs = 0
  const cursor = new Date(startMs)
  cursor.setHours(0, 0, 0, 0)
  while (cursor.getTime() < endMs) {
    if (isWorkday(cursor)) {
      const workStart = new Date(cursor)
      workStart.setHours(9, 0, 0, 0)
      const workEnd = new Date(cursor)
      workEnd.setHours(17, 0, 0, 0)
      const overlapStart = Math.max(startMs, workStart.getTime())
      const overlapEnd = Math.min(endMs, workEnd.getTime())
      if (overlapEnd > overlapStart) totalMs += overlapEnd - overlapStart
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return totalMs / 3_600_000
}

function getProgressStats(items, scanned = 0) {
  const totalHours = items.reduce((sum, item) => sum + (Number(item.durationHours) || 0), 0)
  return {
    totalTasksScanned: scanned,
    inProgressTasks: items.length,
    stillInProgress: items.filter((item) => item.stillInProgress).length,
    totalHours: Math.round(totalHours * 10) / 10,
    avgHours: items.length ? Math.round((totalHours / items.length) * 10) / 10 : 0,
    assignees: new Set(items.map((item) => item.taskAssignedTo).filter(Boolean)).size,
    pbiCount: new Set(items.map((item) => item.parentId || `no-parent:${item.taskId}`)).size
  }
}

function buildProgressPbiGroups(items) {
  const groups = new Map()
  for (const item of items) {
    const key = item.parentId || `no-parent:${item.taskId}`
    if (!groups.has(key)) {
      groups.set(key, {
        pbiId: item.parentId || null,
        pbiTitle: item.pbiTitle || '(Task tanpa Parent PBI)',
        pbiState: item.pbiState || '',
        pbiAssignedTo: item.pbiAssignedTo || '',
        taskCount: 0,
        stillInProgress: 0,
        durationHours: 0,
        firstOverlapStart: item.overlapStart || '',
        lastOverlapEnd: item.overlapEnd || '',
        tasks: []
      })
    }
    const group = groups.get(key)
    group.tasks.push(item)
    group.taskCount += 1
    group.stillInProgress += item.stillInProgress ? 1 : 0
    group.durationHours = Math.round((group.durationHours + (Number(item.durationHours) || 0)) * 10) / 10
    if (item.overlapStart && (!group.firstOverlapStart || new Date(item.overlapStart) < new Date(group.firstOverlapStart))) group.firstOverlapStart = item.overlapStart
    if (item.overlapEnd && (!group.lastOverlapEnd || new Date(item.overlapEnd) > new Date(group.lastOverlapEnd))) group.lastOverlapEnd = item.overlapEnd
  }
  return [...groups.values()].sort((a, b) => String(a.pbiTitle || '').localeCompare(String(b.pbiTitle || '')) || (Number(a.pbiId) || 0) - (Number(b.pbiId) || 0))
}

async function getLastWeekProgress(sprintPath, teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  const range = previousWeekRange()
  const key = `last-week-progress:${teamCacheKey(selectedTeam)}:${sprintPath}:${range.startIso}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  const wiql = `
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = '${wiqlQuote(project)}'
      AND [System.WorkItemType] = 'Task'
      AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}'
    ORDER BY [System.Id]
  `
  const wiqlUrl = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${apiVersion}`
  const wiqlData = await adoFetch(wiqlUrl, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const taskIds = (wiqlData.workItems || []).map((item) => item.id)
  const fields = ['System.Id', 'System.Title', 'System.State', 'System.AssignedTo', 'System.Parent', 'System.IterationPath', 'System.ChangedDate']
  const taskItems = taskIds.length ? await batchWorkItems(taskIds, { fields }) : []
  const rangeStart = range.start.getTime()
  const rangeEnd = range.end.getTime()
  const nowIso = new Date().toISOString()
  const items = []

  for (const task of taskItems) {
    const tf = task.fields || {}
    let revisions = []
    let revisionWarning = ''
    try {
      revisions = await getWorkItemRevisions(task.id)
    } catch (error) {
      revisionWarning = error.message || 'Failed to fetch revisions'
    }

    const changes = []
    let lastState = ''
    for (const revision of revisions) {
      const rf = revision.fields || {}
      const currentState = stateName(rf['System.State'])
      if (!currentState || currentState === lastState) continue
      lastState = currentState
      changes.push({ state: currentState, at: toIsoDate(rf['System.ChangedDate'] || rf['System.RevisedDate']) })
    }

    const segments = []
    for (let i = 0; i < changes.length; i++) {
      const change = changes[i]
      if (change.state !== 'In Progress') continue
      const next = changes.slice(i + 1).find((item) => item.at > change.at)
      const segmentStart = new Date(change.at).getTime()
      const segmentEnd = new Date(next?.at || nowIso).getTime()
      if (!Number.isFinite(segmentStart) || !Number.isFinite(segmentEnd)) continue
      if (!rangesOverlap(segmentStart, segmentEnd, rangeStart, rangeEnd)) continue
      const overlapStart = Math.max(segmentStart, rangeStart)
      const overlapEnd = Math.min(segmentEnd, rangeEnd)
      segments.push({
        inProgressStart: new Date(segmentStart).toISOString(),
        inProgressEnd: next?.at || null,
        overlapStart: new Date(overlapStart).toISOString(),
        overlapEnd: new Date(overlapEnd).toISOString(),
        durationHours: roundHours(workHoursBetween(overlapStart, overlapEnd)),
        stillInProgress: !next
      })
    }

    if (segments.length) {
      const durationHours = roundHours(segments.reduce((sum, segment) => sum + (Number(segment.durationHours) || 0), 0))
      items.push({
        taskId: task.id,
        taskTitle: tf['System.Title'] || '',
        taskState: tf['System.State'] || '',
        taskAssignedTo: assignedName(tf['System.AssignedTo']),
        parentId: tf['System.Parent'] || null,
        changedAt: tf['System.ChangedDate'] || '',
        inProgressStart: segments[0].inProgressStart,
        inProgressEnd: segments.at(-1).inProgressEnd,
        overlapStart: segments[0].overlapStart,
        overlapEnd: segments.at(-1).overlapEnd,
        durationHours,
        progressSegments: segments,
        stillInProgress: segments.at(-1).stillInProgress,
        warning: revisionWarning
      })
    }
  }

  const parentIds = [...new Set(items.map((item) => item.parentId).filter(Boolean))]
  const parentItems = parentIds.length ? await batchWorkItems(parentIds, { fields: ['System.Id', 'System.Title', 'System.State', 'System.AssignedTo'] }) : []
  const parentById = new Map(parentItems.map((item) => [item.id, item]))
  for (const item of items) {
    const parent = parentById.get(item.parentId)
    const pf = parent?.fields || {}
    item.pbiTitle = pf['System.Title'] || ''
    item.pbiState = pf['System.State'] || ''
    item.pbiAssignedTo = assignedName(pf['System.AssignedTo'])
  }

  items.sort((a, b) => a.taskAssignedTo.localeCompare(b.taskAssignedTo) || new Date(a.overlapStart) - new Date(b.overlapStart) || a.taskId - b.taskId)
  const pbiGroups = buildProgressPbiGroups(items)
  const value = {
    generatedAt: new Date().toISOString(),
    team: selectedTeam,
    sprintPath,
    range: { start: range.startIso, end: range.endIso, label: range.label },
    items,
    pbiGroups,
    stats: getProgressStats(items, taskItems.length)
  }
  cache.set(key, { at: Date.now(), value })
  return value
}

async function safeLastWeekProgress(sprintPath, teamName = defaultTeam) {
  const selectedTeam = normalizeTeamName(teamName)
  try { return await getLastWeekProgress(sprintPath, selectedTeam) } catch (error) {
    console.error(error)
    const range = previousWeekRange()
    return { generatedAt: new Date().toISOString(), team: selectedTeam, sprintPath, range: { start: range.startIso, end: range.endIso, label: range.label }, items: [], stats: getProgressStats([], 0), warning: error.message }
  }
}

function loginHtml(error = '') {
  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Login · Sprint Platform Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:rgba(15,23,42,.9); --border:rgba(148,163,184,.24); --text:#e5e7eb; --muted:#94a3b8; --blue:#38bdf8; --red:#fb7185; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at 15% 10%,rgba(56,189,248,.18),transparent 30%),radial-gradient(circle at 85% 0%,rgba(192,132,252,.14),transparent 32%),linear-gradient(135deg,#020617 0%,var(--bg) 55%,#111827 100%); color:var(--text); }
    .card { width:min(460px,100%); background:var(--panel); border:1px solid var(--border); border-radius:24px; padding:30px; box-shadow:0 24px 80px rgba(0,0,0,.36); backdrop-filter:blur(14px); }
    .eyebrow { color:var(--blue); font-weight:800; letter-spacing:.16em; text-transform:uppercase; font-size:12px; } h1 { margin:12px 0 8px; font-size:34px; letter-spacing:-.04em; } p { color:var(--muted); line-height:1.55; margin:0 0 22px; } label { display:block; font-size:13px; color:#cbd5e1; margin:14px 0 7px; font-weight:700; } input,button { width:100%; border:1px solid var(--border); color:var(--text); background:rgba(15,23,42,.9); border-radius:14px; padding:13px 14px; outline:none; font:inherit; } button { margin-top:18px; cursor:pointer; background:linear-gradient(135deg,#0284c7,#2563eb); border-color:rgba(56,189,248,.36); font-weight:900; } .error { display:${error ? 'block' : 'none'}; color:#fecdd3; background:rgba(251,113,133,.12); border:1px solid rgba(251,113,133,.3); padding:11px 12px; border-radius:14px; margin-bottom:14px; }
  </style>
</head>
<body>
  <form class="card" method="post" action="/login">
    <div class="eyebrow">Azure DevOps · Product Delivery</div>
    <h1>Login Dashboard</h1>
    <p>Masuk untuk melihat Platform Sprint Dashboard.</p>
    <div class="error">${escapeHtml(error)}</div>
    <label for="username">Username</label>
    <input id="username" name="username" type="email" autocomplete="username" required autofocus value="${escapeHtml(dashboardUsername)}" />
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />
    <button type="submit">Masuk</button>
  </form>
</body>
</html>`
}

const navigationCss = `
    .layout { max-width:1600px; margin:0 auto; padding:24px 20px 48px; display:grid; grid-template-columns:280px minmax(0,1fr); gap:20px; align-items:start; transition:grid-template-columns .22s ease; }
    .layout.sidebar-collapsed { grid-template-columns:92px minmax(0,1fr); }
    .content { min-width:0; }
    .sidebar { position:sticky; top:24px; padding:18px; min-height:calc(100vh - 48px); display:flex; flex-direction:column; gap:18px; overflow:visible; transition:padding .22s ease; }
    .brand { position:relative; padding:8px 54px 16px 8px; border-bottom:1px solid rgba(148,163,184,.16); min-height:88px; }
    .brand-mark { width:42px; height:42px; display:grid; place-items:center; border-radius:14px; background:linear-gradient(135deg,rgba(56,189,248,.25),rgba(192,132,252,.22)); border:1px solid rgba(148,163,184,.22); font-weight:900; color:#e0f2fe; margin-bottom:12px; }
    .brand-title { font-weight:900; letter-spacing:-.03em; font-size:18px; white-space:nowrap; }
    .brand-subtitle { color:var(--muted); font-size:12px; line-height:1.45; margin-top:4px; }
    .sidebar-toggle { position:absolute; top:8px; right:8px; width:38px; height:38px; border-radius:13px; display:grid; place-items:center; padding:0; border:1px solid rgba(148,163,184,.22); background:rgba(15,23,42,.72); color:#e5e7eb; cursor:pointer; font-size:18px; line-height:1; }
    .sidebar-toggle:hover { filter:brightness(1.16); }
    .sidebar-toggle-icon { display:block; transition:transform .18s ease; }
    .nav-menu { display:grid; gap:10px; }
    .nav-label { color:#64748b; font-size:11px; font-weight:900; letter-spacing:.16em; text-transform:uppercase; padding:0 8px; }
    .nav-link { display:grid; grid-template-columns:34px 1fr; gap:10px; align-items:center; padding:12px; border:1px solid rgba(148,163,184,.16); border-radius:16px; background:rgba(15,23,42,.48); color:#cbd5e1; text-decoration:none; font-weight:900; }
    .nav-desc { display:block; color:var(--muted); font-weight:600; font-size:12px; margin-top:2px; }
    .nav-link.active { background:linear-gradient(135deg,rgba(56,189,248,.18),rgba(192,132,252,.16)); border-color:rgba(56,189,248,.42); color:#f8fafc; box-shadow:0 14px 34px rgba(56,189,248,.08); }
    .nav-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:12px; background:rgba(148,163,184,.12); }
    .side-foot { margin-top:auto; display:grid; gap:10px; padding:14px 8px 4px; color:var(--muted); font-size:12px; border-top:1px solid rgba(148,163,184,.16); }
    .team-line { display:grid; gap:6px; }
    .team-line label { color:#cbd5e1; font-weight:900; font-size:11px; letter-spacing:.12em; text-transform:uppercase; }
    .team-select { width:100%; border:1px solid rgba(148,163,184,.22); color:var(--text); background:rgba(15,23,42,.88); border-radius:12px; padding:10px 11px; outline:none; font:inherit; font-size:12px; font-weight:800; }
    .logout-link { color:#fecaca; text-decoration:none; font-weight:800; }
    .layout.sidebar-collapsed .sidebar { padding:14px; align-items:center; }
    .layout.sidebar-collapsed .brand { width:100%; min-height:auto; padding:6px 0 14px; display:grid; justify-items:center; }
    .layout.sidebar-collapsed .brand-mark { margin:0; }
    .layout.sidebar-collapsed .brand-title,.layout.sidebar-collapsed .brand-subtitle,.layout.sidebar-collapsed .nav-label,.layout.sidebar-collapsed .nav-text,.layout.sidebar-collapsed .team-line,.layout.sidebar-collapsed .logout-text { display:none; }
    .layout.sidebar-collapsed .sidebar-toggle { position:static; margin-top:10px; width:42px; height:34px; }
    .layout.sidebar-collapsed .sidebar-toggle-icon { transform:rotate(180deg); }
    .layout.sidebar-collapsed .nav-menu { width:100%; justify-items:center; }
    .layout.sidebar-collapsed .nav-link { grid-template-columns:1fr; width:54px; height:54px; padding:10px; place-items:center; }
    .layout.sidebar-collapsed .nav-icon { margin:0; }
    .layout.sidebar-collapsed .side-foot { width:100%; justify-items:center; padding:14px 0 4px; }
    @media (max-width:1000px) { .layout,.layout.sidebar-collapsed { grid-template-columns:1fr; padding:16px 12px 36px; } .sidebar { position:static; min-height:auto; } .layout.sidebar-collapsed .sidebar { align-items:stretch; } .layout.sidebar-collapsed .brand-title,.layout.sidebar-collapsed .brand-subtitle,.layout.sidebar-collapsed .nav-text,.layout.sidebar-collapsed .team-line,.layout.sidebar-collapsed .logout-text { display:block; } .layout.sidebar-collapsed .nav-label { display:block; } .layout.sidebar-collapsed .nav-menu { justify-items:stretch; } .layout.sidebar-collapsed .nav-link { width:auto; height:auto; grid-template-columns:34px 1fr; place-items:initial; padding:12px; } .layout.sidebar-collapsed .side-foot { justify-items:stretch; padding:14px 8px 4px; } .nav-menu { grid-template-columns:repeat(4,minmax(0,1fr)); } .nav-label,.side-foot { grid-column:1/-1; } }
    @media (max-width:680px) { .nav-menu { grid-template-columns:1fr; } }
`

function navHtml(active) {
  const item = (key, href, icon, title, desc) => `<a class="nav-link ${active === key ? 'active' : ''}" href="${href}" data-feature-link="1" title="${title}"><span class="nav-icon">${icon}</span><div class="nav-text">${title}<span class="nav-desc">${desc}</span></div></a>`
  return `<aside class="card sidebar">
    <div class="brand"><div class="brand-mark">PD</div><div class="brand-title">Platform Sprint</div><div class="brand-subtitle">Feature access untuk monitoring Azure DevOps multi-team.</div><button id="sidebarToggle" class="sidebar-toggle" type="button" aria-label="Collapse sidebar" aria-expanded="true" title="Collapse sidebar"><span class="sidebar-toggle-icon">‹</span></button></div>
    <nav class="nav-menu" aria-label="Feature navigation">
      <div class="nav-label">Features</div>
      ${item('home', '/', '🏠', 'Welcome Wizard', 'Home & panduan fitur')}
      ${item('dashboard', '/dashboard', '🚀', 'PBI Ready Release', 'Expandable PBI & Task')}
      ${item('timeline', '/timeline', '📈', 'Timeline Gantt', 'History state task')}
      ${item('progress', '/progress', '🗓️', 'Progress Minggu Lalu', 'Task In Progress last week')}
    </nav>
    <div class="side-foot"><div class="team-line"><label for="teamSelect">Team</label><select id="teamSelect" class="team-select"><option value="${escapeHtml(defaultTeam)}">${escapeHtml(defaultTeam)}</option></select></div><a class="logout-link" href="/logout" title="Logout">⎋ <span class="logout-text">Logout</span></a></div>
    <script>
      (() => {
        const layout = document.currentScript.closest('.layout') || document.querySelector('.layout')
        const toggle = document.getElementById('sidebarToggle')
        const teamSelect = document.getElementById('teamSelect')
        const defaultTeam = ${JSON.stringify(defaultTeam)}
        const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
        const selectedTeam = () => {
          const params = new URLSearchParams(location.search)
          const queryTeam = params.get('team')
          if (queryTeam) return queryTeam
          try { return localStorage.getItem('platformSelectedTeam') || defaultTeam } catch { return defaultTeam }
        }
        const setTeamInUrl = (href, teamName) => {
          const next = new URL(href, location.origin)
          next.searchParams.set('team', teamName)
          return next.pathname + next.search + next.hash
        }
        const ensureCurrentUrlTeam = (teamName) => {
          const params = new URLSearchParams(location.search)
          if (params.get('team') || !teamName) return
          history.replaceState(null, '', setTeamInUrl(location.href, teamName))
        }
        if (!layout || !toggle) return
        const setCollapsed = (collapsed) => {
          layout.classList.toggle('sidebar-collapsed', collapsed)
          toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
          toggle.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar')
          toggle.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse sidebar')
          try { localStorage.setItem('platformSidebarCollapsed', collapsed ? '1' : '0') } catch {}
        }
        let saved = '0'
        try { saved = localStorage.getItem('platformSidebarCollapsed') || '0' } catch {}
        setCollapsed(saved === '1')
        toggle.addEventListener('click', () => setCollapsed(!layout.classList.contains('sidebar-collapsed')))

        const applyTeamLinks = (teamName) => {
          document.querySelectorAll('a[data-feature-link="1"]').forEach((anchor) => {
            anchor.href = setTeamInUrl(anchor.getAttribute('href') || '/', teamName)
          })
        }
        const setTeamOptions = (teams) => {
          if (!teamSelect) return
          const activeTeam = selectedTeam()
          const list = Array.from(new Set([activeTeam, defaultTeam, ...(teams || [])].filter(Boolean)))
          teamSelect.innerHTML = list.map((name) => '<option value="' + esc(name) + '">' + esc(name) + '</option>').join('')
          teamSelect.value = activeTeam
          try { localStorage.setItem('platformSelectedTeam', activeTeam) } catch {}
          ensureCurrentUrlTeam(activeTeam)
          applyTeamLinks(activeTeam)
        }
        setTeamOptions([defaultTeam])
        fetch('/api/teams').then((res) => res.json()).then((data) => setTeamOptions(data.teams || [])).catch(() => {})
        teamSelect?.addEventListener('change', () => {
          const teamName = teamSelect.value || defaultTeam
          try { localStorage.setItem('platformSelectedTeam', teamName) } catch {}
          location.href = setTeamInUrl(location.href, teamName)
        })
      })()
    </script>
  </aside>`
}

const homeHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome Wizard · Sprint Platform Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:rgba(15,23,42,.88); --border:rgba(148,163,184,.22); --text:#e5e7eb; --muted:#94a3b8; --blue:#38bdf8; --green:#34d399; --amber:#fbbf24; --purple:#c084fc; --red:#fb7185; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at 15% 10%,rgba(56,189,248,.18),transparent 30%),radial-gradient(circle at 85% 0%,rgba(192,132,252,.14),transparent 32%),linear-gradient(135deg,#020617 0%,var(--bg) 55%,#111827 100%); color:var(--text); }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:24px; box-shadow:0 24px 80px rgba(0,0,0,.32); backdrop-filter:blur(14px); }
    a { color:var(--blue); text-decoration:none; font-weight:900; } a:hover { filter:brightness(1.16); }
    .hero { padding:34px; margin-bottom:18px; min-height:360px; display:grid; align-content:center; position:relative; overflow:hidden; }
    .hero:after { content:""; position:absolute; inset:auto -80px -130px auto; width:360px; height:360px; border-radius:999px; background:radial-gradient(circle,rgba(56,189,248,.20),transparent 68%); pointer-events:none; }
    .eyebrow { color:var(--blue); font-weight:900; letter-spacing:.16em; text-transform:uppercase; font-size:12px; }
    h1 { font-size:clamp(34px,6vw,68px); line-height:.94; margin:12px 0 18px; letter-spacing:-.06em; max-width:880px; }
    .subtitle { color:var(--muted); max-width:860px; line-height:1.7; margin:0; font-size:16px; }
    .actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:24px; }
    .btn { border:1px solid rgba(56,189,248,.36); background:linear-gradient(135deg,rgba(56,189,248,.20),rgba(192,132,252,.16)); color:#f8fafc; border-radius:16px; padding:13px 16px; display:inline-flex; align-items:center; gap:8px; }
    .btn.secondary { border-color:var(--border); background:rgba(15,23,42,.62); color:#cbd5e1; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; }
    .feature { padding:22px; display:flex; flex-direction:column; min-height:230px; }
    .feature-icon { width:46px; height:46px; display:grid; place-items:center; border-radius:16px; background:rgba(56,189,248,.14); border:1px solid rgba(56,189,248,.22); font-size:22px; }
    .feature h2 { margin:16px 0 8px; font-size:20px; }
    .feature p { color:var(--muted); line-height:1.6; margin:0 0 16px; }
    .feature a { margin-top:auto; }
    .steps { margin-top:18px; padding:22px; }
    .steps h2 { margin:0 0 12px; }
    .steps ol { margin:0; padding-left:22px; color:#cbd5e1; line-height:1.8; }
    ${navigationCss}
    @media (max-width:1000px) { .grid { grid-template-columns:1fr; } .hero { min-height:auto; } }
  </style>
</head>
<body>
  <main class="layout">
    ${navHtml('home')}
    <div class="content">
      <section class="card hero">
        <div class="eyebrow">Welcome Wizard · Azure DevOps</div>
        <h1>Mulai dari sini untuk monitoring Platform Sprint.</h1>
        <p class="subtitle">Halaman ini menjadi home baru. Gunakan sidebar untuk akses fitur per kebutuhan: PBI Ready Release yang bisa expand task per PBI, timeline Gantt untuk melihat perjalanan state task, atau Progress Minggu Lalu untuk melihat task yang sempat In Progress minggu lalu.</p>
        <div class="actions">
          <a class="btn" href="/dashboard" data-feature-link="1">Buka PBI Ready Release →</a>
          <a class="btn secondary" href="/timeline" data-feature-link="1">Buka Timeline Gantt →</a>
          <a class="btn secondary" href="/progress" data-feature-link="1">Buka Progress Minggu Lalu →</a>
        </div>
      </section>
      <section class="grid">
        <article class="card feature"><div class="feature-icon">🚀</div><h2>PBI Ready Release</h2><p>Menarik Product Backlog Item yang siap release berdasarkan PBI Resolved, task On Review Product, atau task Release Plan.</p><a href="/dashboard" data-feature-link="1">Masuk PBI Ready Release →</a></article>
        <article class="card feature"><div class="feature-icon">📈</div><h2>Timeline Gantt</h2><p>Monitoring history state task: In Progress, On Review QA, On Review Product, Release Plan, sampai Released.</p><a href="/timeline" data-feature-link="1">Lihat Timeline →</a></article>
        <article class="card feature"><div class="feature-icon">🗓️</div><h2>Progress Minggu Lalu</h2><p>Menampilkan task yang berada di state In Progress pada minggu sebelumnya, lengkap dengan durasi overlap dan parent PBI.</p><a href="/progress" data-feature-link="1">Lihat Progress →</a></article>
      </section>
      <section class="card steps">
        <h2>Quick Start</h2>
        <ol>
          <li>Pilih fitur dari sidebar kiri.</li>
          <li>Pilih sprint dari dropdown, default akan mencoba current sprint atau Sprint 9.</li>
          <li>Gunakan search/filter untuk menemukan PBI, task, assignee, state, atau reason.</li>
          <li>Klik baris PBI di halaman Ready Release untuk expand/collapse list task.</li>
        </ol>
      </section>
    </div>
  </main>
</body>
</html>`

const dashboardHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PBI Ready Release · Sprint Platform Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:rgba(15,23,42,.88); --border:rgba(148,163,184,.22); --text:#e5e7eb; --muted:#94a3b8; --blue:#38bdf8; --green:#34d399; --amber:#fbbf24; --purple:#c084fc; --red:#fb7185; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at 15% 10%,rgba(56,189,248,.18),transparent 30%),radial-gradient(circle at 85% 0%,rgba(192,132,252,.14),transparent 32%),linear-gradient(135deg,#020617 0%,var(--bg) 55%,#111827 100%); color:var(--text); }
    .wrap { max-width:1500px; margin:0 auto; padding:32px 20px 48px; } .hero { display:grid; grid-template-columns:1.45fr .55fr; gap:18px; align-items:stretch; margin-bottom:18px; } .card { background:var(--panel); border:1px solid var(--border); border-radius:24px; box-shadow:0 24px 80px rgba(0,0,0,.32); backdrop-filter:blur(14px); }
    .headline { padding:28px; } .eyebrow { color:var(--blue); font-weight:800; letter-spacing:.16em; text-transform:uppercase; font-size:12px; } h1 { font-size:clamp(30px,5vw,56px); line-height:.96; margin:12px 0 16px; letter-spacing:-.05em; } .subtitle { color:var(--muted); max-width:850px; line-height:1.65; margin:0; } .meta { margin-top:18px; display:flex; flex-wrap:wrap; gap:10px; } .chip { border:1px solid var(--border); background:rgba(15,23,42,.7); color:#cbd5e1; border-radius:999px; padding:8px 12px; font-size:13px; }
    .stats { padding:18px; display:grid; grid-template-columns:repeat(2,1fr); gap:12px; } .stat { background:linear-gradient(180deg,rgba(51,65,85,.7),rgba(15,23,42,.7)); border:1px solid var(--border); border-radius:18px; padding:18px; } .num { font-size:34px; font-weight:900; letter-spacing:-.04em; } .label { color:var(--muted); font-size:13px; margin-top:4px; }
    .toolbar { display:grid; grid-template-columns:1.15fr 1.2fr .9fr auto; gap:12px; align-items:center; padding:16px; margin:18px 0; } input,select,button { border:1px solid var(--border); color:var(--text); background:rgba(15,23,42,.88); border-radius:14px; padding:12px 14px; outline:none; font:inherit; min-width:0; } button { cursor:pointer; } button:hover,a:hover { filter:brightness(1.16); }
    .table-card { overflow:hidden; } .table-head { padding:18px 20px; display:flex; justify-content:space-between; gap:12px; align-items:center; border-bottom:1px solid var(--border); flex-wrap:wrap; } .table-head h2 { margin:0; font-size:18px; } .table-actions { display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; } .copy-btn { font-weight:900; background:linear-gradient(135deg,rgba(56,189,248,.24),rgba(192,132,252,.18)); border-color:rgba(56,189,248,.36); } .copy-status { color:#bbf7d0; font-size:12px; font-weight:800; min-width:96px; text-align:right; } .table-wrap { overflow-x:auto; } table { width:100%; border-collapse:collapse; min-width:1260px; } th { color:#cbd5e1; font-size:12px; text-transform:uppercase; letter-spacing:.08em; text-align:left; background:rgba(15,23,42,.94); position:sticky; top:0; z-index:1; } th,td { padding:14px; border-bottom:1px solid rgba(148,163,184,.14); vertical-align:top; } tbody tr:hover { background:rgba(56,189,248,.07); } .title-cell { max-width:390px; line-height:1.35; } a { color:var(--blue); text-decoration:none; font-weight:800; } .id-link { white-space:nowrap; } .muted { color:var(--muted); }
    .badge,.state { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; white-space:nowrap; } .badge.review,.state.review { color:#bae6fd; background:rgba(56,189,248,.14); border:1px solid rgba(56,189,248,.25); } .badge.plan,.state.plan { color:#fecdd3; background:rgba(251,113,133,.14); border:1px solid rgba(251,113,133,.28); } .badge.resolved,.state.resolved { color:#bbf7d0; background:rgba(52,211,153,.14); border:1px solid rgba(52,211,153,.25); } .badge.combo { color:#e9d5ff; background:rgba(192,132,252,.16); border:1px solid rgba(192,132,252,.3); } .state.done { color:#fde68a; background:rgba(251,191,36,.14); border:1px solid rgba(251,191,36,.25); } .state.neutral { color:#cbd5e1; background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.2); }
    .pbi-row { cursor:pointer; } .pbi-row.expanded { background:rgba(56,189,248,.08); } .expand-cell { text-align:center; vertical-align:middle; } .expand-btn { width:32px; height:32px; margin:0 auto; padding:0; border-radius:12px; display:grid; place-items:center; line-height:1; border:1px solid rgba(148,163,184,.24); background:rgba(15,23,42,.7); color:#e5e7eb; font-size:22px; font-weight:900; transition:transform .16s ease; } .pbi-row.expanded .expand-btn { transform:rotate(90deg); } .tasks-row { display:none; background:rgba(15,23,42,.42); } .tasks-row.open { display:table-row; } .tasks-panel { padding:16px 20px 20px 72px; } .tasks-title { color:#cbd5e1; font-weight:900; margin-bottom:10px; } .task-list { display:grid; gap:10px; } .task-item { display:grid; grid-template-columns:120px minmax(260px,1fr) 170px 220px; gap:12px; align-items:start; padding:12px; border:1px solid rgba(148,163,184,.16); border-radius:16px; background:rgba(15,23,42,.58); } .task-title { line-height:1.4; } .empty-task { color:var(--muted); padding:14px; border:1px dashed rgba(148,163,184,.24); border-radius:16px; } .task-count { color:#e0f2fe; background:rgba(56,189,248,.14); border:1px solid rgba(56,189,248,.25); } @media (max-width:1100px) { .task-item { grid-template-columns:1fr; } .tasks-panel { padding-left:20px; } }
    .notice { margin-top:12px; color:#fde68a; display:none; } .footer { color:var(--muted); font-size:12px; margin-top:14px; text-align:right; } .loading td { text-align:center; color:var(--muted); padding:34px; }
    .gantt-card { margin:18px 0; overflow:hidden; } .gantt-head { padding:18px 20px; display:flex; justify-content:space-between; gap:12px; align-items:flex-start; border-bottom:1px solid var(--border); flex-wrap:wrap; } .gantt-head h2 { margin:0; font-size:18px; } .gantt-head p { margin:6px 0 0; color:var(--muted); font-size:13px; } .legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:12px; } .legend span { display:inline-flex; align-items:center; gap:6px; } .dot { width:10px; height:10px; border-radius:999px; display:inline-block; } .dot.progress { background:#38bdf8; } .dot.qa { background:#fbbf24; } .dot.product { background:#c084fc; } .dot.plan { background:#fb7185; } .dot.released { background:#34d399; }
    .gantt-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:14px 18px; border-bottom:1px solid rgba(148,163,184,.14); } .gantt-stat { background:rgba(15,23,42,.62); border:1px solid rgba(148,163,184,.16); border-radius:14px; padding:12px; } .gantt-stat b { display:block; font-size:22px; } .gantt-stat span { color:var(--muted); font-size:12px; }
    .gantt-scroll { overflow:auto; max-height:620px; } .gantt-grid { min-width:1050px; } .gantt-scale,.gantt-row { display:grid; grid-template-columns:340px 1fr; border-bottom:1px solid rgba(148,163,184,.12); } .gantt-scale { position:sticky; top:0; z-index:2; background:rgba(15,23,42,.96); color:#cbd5e1; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; } .gantt-scale-left,.gantt-task { padding:12px 14px; border-right:1px solid rgba(148,163,184,.14); } .gantt-axis,.gantt-bars { position:relative; min-height:58px; padding:12px 14px; } .tick { position:absolute; top:0; bottom:0; border-left:1px dashed rgba(148,163,184,.18); color:var(--muted); font-size:11px; padding-left:5px; } .gantt-task-title { font-weight:800; line-height:1.35; } .gantt-task-meta { color:var(--muted); font-size:12px; margin-top:4px; } .bar { position:absolute; height:18px; top:18px; border-radius:999px; min-width:4px; box-shadow:0 8px 20px rgba(0,0,0,.22); } .bar.progress { background:linear-gradient(90deg,#0284c7,#38bdf8); } .bar.qa { background:linear-gradient(90deg,#d97706,#fbbf24); } .bar.product { background:linear-gradient(90deg,#7e22ce,#c084fc); } .bar.plan { background:linear-gradient(90deg,#be123c,#fb7185); } .bar.released { background:linear-gradient(90deg,#059669,#34d399); } .bar-label { position:absolute; top:-18px; left:4px; font-size:10px; color:#e5e7eb; white-space:nowrap; text-shadow:0 1px 2px #000; } .gantt-empty { padding:28px; color:var(--muted); text-align:center; }
    ${navigationCss}
    @media (max-width:1000px) { .hero { grid-template-columns:1fr; } .toolbar { grid-template-columns:1fr; } .gantt-stats { grid-template-columns:repeat(2,1fr); } }
  </style>
</head>
<body>
  <main class="layout">
    ${navHtml('dashboard')}
    <div class="content">
    <section class="hero">
      <div class="card headline">
        <div class="eyebrow">Azure DevOps · Product Delivery</div>
        <h1>PBI Ready Release</h1>
        <p class="subtitle">List Product Backlog Item yang siap release untuk team terpilih: PBI state Resolved, child task On Review Product, atau child task Release Plan. Setiap PBI bisa di-expand untuk melihat seluruh task child dari PBI tersebut, dengan ID langsung link ke Azure DevOps.</p>
        <div class="meta">
          <a class="chip" href="/" data-feature-link="1">← Welcome Wizard</a>
          <span class="chip">Team: <b id="activeTeam">Loading...</b></span>
          <span class="chip">Sprint: <b id="activeSprint">Loading...</b></span>
          <span class="chip">PBI in sprint: <b id="pbiInSprint">-</b></span>
          <span class="chip">Child items scanned: <b id="childItemsScanned">-</b></span>
          <a class="chip" href="/timeline" data-feature-link="1">Buka Timeline Gantt Chart →</a>
        </div>
        <div id="notice" class="notice"></div>
      </div>
      <div class="card stats">
        <div class="stat"><div class="num" id="uniquePbis">-</div><div class="label">PBI Ready Release</div></div>
        <div class="stat"><div class="num" id="detailRows">-</div><div class="label">Total task child</div></div>
        <div class="stat"><div class="num" id="resolvedPbis">-</div><div class="label">PBI Resolved</div></div>
        <div class="stat"><div class="num" id="reviewTasks">-</div><div class="label">Task On Review Product</div></div>
        <div class="stat"><div class="num" id="releasePlanTasks">-</div><div class="label">Task Release Plan</div></div>
      </div>
    </section>
    <section class="card toolbar">
      <select id="sprint"><option>Loading sprint...</option></select>
      <input id="q" type="search" placeholder="Cari ID, title, assignee, state, reason..." autocomplete="off" />
      <select id="reason"><option value="all">Semua reason</option><option value="pbi">PBI Resolved</option><option value="review">Task On Review Product</option><option value="plan">Task Release Plan</option><option value="combo">Kombinasi reason</option></select>
      <button id="reset">Reset</button>
    </section>
    <section class="card table-card">
      <div class="table-head"><h2>PBI Ready Release</h2><div class="table-actions"><span class="muted"><span id="count">0</span> PBI shown</span><button id="copyPbis" class="copy-btn" type="button">Copy List PBI</button><span id="copyStatus" class="copy-status" aria-live="polite"></span></div></div>
      <div class="table-wrap"><table><thead><tr><th style="width:54px"></th><th>PBI</th><th>PBI Title</th><th>PBI State</th><th>PBI Assigned To</th><th>Reason</th><th>Total Task</th><th>On Review Product</th><th>Release Plan</th></tr></thead><tbody id="tbody"><tr class="loading"><td colspan="9">Loading data...</td></tr></tbody></table></div>
    </section>
    <div class="footer">Generated live from Azure DevOps PAT pull · <span id="generatedAt">-</span></div>
    </div>
  </main>
  <script>
    const baseWorkItemUrl = ${JSON.stringify(baseWorkItemUrl)}
    const els = Object.fromEntries(['sprint','q','reason','reset','copyPbis','copyStatus','count','tbody','activeTeam','activeSprint','pbiInSprint','childItemsScanned','uniquePbis','detailRows','resolvedPbis','reviewTasks','releasePlanTasks','generatedAt','notice'].map(id => [id, document.getElementById(id)]))
    let currentPbis = []

    const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
    const selectedTeam = () => {
      const queryTeam = new URLSearchParams(location.search).get('team')
      if (queryTeam) return queryTeam
      try { return localStorage.getItem('platformSelectedTeam') || ${JSON.stringify(defaultTeam)} } catch { return ${JSON.stringify(defaultTeam)} }
    }
    const link = (id) => id ? '<a class="id-link" href="' + baseWorkItemUrl + id + '" target="_blank" rel="noreferrer">#' + id + '</a>' : '<span class="muted">-</span>'
    const statePill = (v) => { const t = esc(v || '-'); const cls = t === 'Resolved' ? 'resolved' : t === 'Done' ? 'done' : t === 'Release Plan' ? 'plan' : t.includes('Review') ? 'review' : 'neutral'; return '<span class="state ' + cls + '">' + t + '</span>' }
    const badge = (v) => { const t = esc(v); const cls = t.includes('+') ? 'combo' : t.includes('Resolved') ? 'resolved' : t.includes('Release Plan') ? 'plan' : 'review'; return '<span class="badge ' + cls + '">' + t + '</span>' }
    const countPill = (value) => '<span class="badge task-count">' + esc(value ?? 0) + '</span>'

    function normalizePbis(rows) {
      const byPbi = new Map()
      for (const row of rows || []) {
        if (!byPbi.has(row.pbiId)) {
          byPbi.set(row.pbiId, { pbiId: row.pbiId, pbiTitle: row.pbiTitle || '', pbiState: row.pbiState || '', pbiAssignedTo: row.pbiAssignedTo || '', reason: row.reason || '', tasks: [] })
        }
        const pbi = byPbi.get(row.pbiId)
        if (row.reason && row.reason.length > pbi.reason.length) pbi.reason = row.reason
        if (row.taskId) pbi.tasks.push({ taskId: row.taskId, taskTitle: row.taskTitle || '', taskState: row.taskState || '', taskAssignedTo: row.taskAssignedTo || '' })
      }
      return Array.from(byPbi.values()).map((pbi) => ({ ...pbi, taskCount: pbi.tasks.length, reviewTaskCount: pbi.tasks.filter((task) => task.taskState === 'On Review Product').length, releasePlanTaskCount: pbi.tasks.filter((task) => task.taskState === 'Release Plan').length }))
    }

    function taskHtml(task) {
      return '<div class="task-item"><div>' + link(task.taskId) + '</div><div class="task-title">' + esc(task.taskTitle || '-') + '</div><div>' + statePill(task.taskState) + '</div><div>' + esc(task.taskAssignedTo || '-') + '</div></div>'
    }

    function pbiHtml(pbi) {
      const tasks = pbi.tasks || []
      const taskText = tasks.map((task) => [task.taskId, task.taskTitle, task.taskState, task.taskAssignedTo].join(' ')).join(' ')
      const search = esc([pbi.pbiId, pbi.pbiTitle, pbi.pbiState, pbi.pbiAssignedTo, pbi.reason, taskText].join(' ').toLowerCase())
      const taskList = tasks.length ? '<div class="task-list">' + tasks.map(taskHtml).join('') + '</div>' : '<div class="empty-task">Belum ada child task yang bisa ditampilkan untuk PBI ini.</div>'
      return '<tr class="pbi-row" data-pbi-id="' + esc(pbi.pbiId) + '" data-search="' + search + '" data-reason="' + esc(pbi.reason || '') + '"><td class="expand-cell"><button class="expand-btn" type="button" aria-label="Expand task">›</button></td><td>' + link(pbi.pbiId) + '</td><td class="title-cell">' + esc(pbi.pbiTitle) + '</td><td>' + statePill(pbi.pbiState) + '</td><td>' + esc(pbi.pbiAssignedTo) + '</td><td>' + badge(pbi.reason) + '</td><td>' + countPill(pbi.taskCount ?? tasks.length) + '</td><td>' + countPill(pbi.reviewTaskCount ?? tasks.filter((task) => task.taskState === 'On Review Product').length) + '</td><td>' + countPill(pbi.releasePlanTaskCount ?? tasks.filter((task) => task.taskState === 'Release Plan').length) + '</td></tr><tr class="tasks-row" data-parent="' + esc(pbi.pbiId) + '"><td colspan="9"><div class="tasks-panel"><div class="tasks-title">Task dari PBI ' + link(pbi.pbiId) + '</div>' + taskList + '</div></td></tr>'
    }

    function applyFilter() {
      const term = els.q.value.trim().toLowerCase()
      const mode = els.reason.value
      let shown = 0
      for (const row of Array.from(els.tbody.querySelectorAll('tr.pbi-row'))) {
        const tasksRow = row.nextElementSibling?.classList.contains('tasks-row') ? row.nextElementSibling : null
        const haystack = row.dataset.search || ''
        const reason = row.dataset.reason || ''
        const matchTerm = !term || haystack.includes(term)
        const matchReason = mode === 'all' || (mode === 'pbi' && reason.includes('PBI Resolved')) || (mode === 'review' && reason.includes('Task On Review Product')) || (mode === 'plan' && reason.includes('Task Release Plan')) || (mode === 'combo' && reason.includes('+'))
        const visible = matchTerm && matchReason
        row.style.display = visible ? '' : 'none'
        if (tasksRow) tasksRow.style.display = visible && row.classList.contains('expanded') ? 'table-row' : 'none'
        if (visible) shown++
      }
      els.count.textContent = shown
    }

    function togglePbiRow(row) {
      row.classList.toggle('expanded')
      const tasksRow = row.nextElementSibling?.classList.contains('tasks-row') ? row.nextElementSibling : null
      if (tasksRow) tasksRow.classList.toggle('open', row.classList.contains('expanded'))
      applyFilter()
    }

    function formatPbiReadyReleaseCopy(pbis = currentPbis) {
      const lines = ['PBI Ready Release']
      pbis.forEach((pbi, index) => {
        const id = String(pbi.pbiId || '').trim()
        const url = baseWorkItemUrl + encodeURIComponent(id)
        const title = String(pbi.pbiTitle || '-').replace(/\\s+/g, ' ').trim()
        lines.push((index + 1) + '. Product backlog Item ' + id + ':(' + url + ') ' + title)
      })
      return lines.join('\\n')
    }

    function formatPbiReadyReleaseCopyHtml(pbis = currentPbis) {
      const lines = ['<div><strong>PBI Ready Release</strong></div>', '<ol>']
      pbis.forEach((pbi) => {
        const id = String(pbi.pbiId || '').trim()
        const url = baseWorkItemUrl + encodeURIComponent(id)
        const title = String(pbi.pbiTitle || '-').replace(/\\s+/g, ' ').trim()
        lines.push('<li><a href="' + esc(url) + '">Product backlog Item</a> ' + esc(id) + ': ' + esc(title) + '</li>')
      })
      lines.push('</ol>')
      return lines.join('')
    }

    function copyTextFallback(text) {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      textarea.style.top = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }

    async function copyPbiReadyRelease() {
      const pbis = currentPbis
      const text = formatPbiReadyReleaseCopy(pbis)
      const html = formatPbiReadyReleaseCopyHtml(pbis)
      const total = pbis.length
      if (!total) {
        els.copyStatus.textContent = 'Tidak ada PBI'
        return
      }
      try {
        if (navigator.clipboard?.write && window.ClipboardItem) {
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })])
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          copyTextFallback(text)
        }
        els.copyStatus.textContent = 'Copied ' + total + ' PBI'
      } catch (error) {
        try {
          copyTextFallback(text)
          els.copyStatus.textContent = 'Copied ' + total + ' PBI'
        } catch (fallbackError) {
          els.copyStatus.textContent = 'Copy gagal'
          console.error('Failed to copy PBI Ready Release list', error, fallbackError)
        }
      }
      window.setTimeout(() => { els.copyStatus.textContent = '' }, 2400)
    }

    async function loadData(sprintPath) {
      els.tbody.innerHTML = '<tr class="loading"><td colspan="9">Loading data...</td></tr>'
      els.count.textContent = '0'
      const teamName = selectedTeam()
      const res = await fetch('/api/data?team=' + encodeURIComponent(teamName) + '&sprintPath=' + encodeURIComponent(sprintPath))
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load data')
      currentPbis = data.pbis || normalizePbis(data.rows || [])
      const stats = data.stats || {}
      els.activeTeam.textContent = data.team || teamName
      els.activeSprint.textContent = data.sprintPath || sprintPath
      els.pbiInSprint.textContent = stats.pbiInSprint ?? '-'
      els.childItemsScanned.textContent = stats.childItemsScanned ?? '-'
      els.uniquePbis.textContent = stats.uniquePbis ?? currentPbis.length ?? '0'
      els.detailRows.textContent = stats.detailRows ?? currentPbis.reduce((sum, pbi) => sum + (pbi.taskCount || 0), 0)
      els.resolvedPbis.textContent = stats.resolvedPbis ?? '0'
      els.reviewTasks.textContent = stats.reviewTasks ?? '0'
      els.releasePlanTasks.textContent = stats.releasePlanTasks ?? '0'
      els.generatedAt.textContent = data.generatedAt || '-'
      els.notice.style.display = data.warning ? 'block' : 'none'
      els.notice.textContent = data.warning ? 'Warning: ' + data.warning : ''
      els.tbody.innerHTML = currentPbis.length ? currentPbis.map(pbiHtml).join('') : '<tr class="loading"><td colspan="9">Tidak ada PBI Ready Release untuk sprint ini.</td></tr>'
      applyFilter()
    }

    async function init() {
      try {
        const teamName = selectedTeam()
        els.activeTeam.textContent = teamName
        const sprints = await (await fetch('/api/sprints?team=' + encodeURIComponent(teamName))).json()
        const list = sprints.sprints || []
        els.sprint.innerHTML = list.map(s => '<option value="' + esc(s.path) + '">' + esc(s.name) + (s.timeFrame ? ' (' + esc(s.timeFrame) + ')' : '') + '</option>').join('')
        const current = list.find(s => s.timeFrame === 'current') || list.find(s => s.name.includes('Sprint 9')) || list[0]
        if (current) els.sprint.value = current.path
        await loadData(els.sprint.value)
      } catch (error) {
        els.tbody.innerHTML = '<tr class="loading"><td colspan="9">Gagal load data: ' + esc(error.message) + '</td></tr>'
      }
    }

    els.sprint.addEventListener('change', () => loadData(els.sprint.value).catch(err => alert(err.message)))
    els.q.addEventListener('input', applyFilter)
    els.reason.addEventListener('change', applyFilter)
    els.reset.addEventListener('click', () => { els.q.value = ''; els.reason.value = 'all'; applyFilter() })
    els.copyPbis.addEventListener('click', copyPbiReadyRelease)
    els.tbody.addEventListener('click', (event) => {
      if (event.target.closest('a')) return
      const row = event.target.closest('tr.pbi-row')
      if (!row) return
      event.preventDefault()
      event.stopPropagation()
      togglePbiRow(row)
    })
    init()
  </script>
</body>
</html>`

const timelineHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Timeline Gantt Chart · Sprint Platform Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:rgba(15,23,42,.88); --border:rgba(148,163,184,.22); --text:#e5e7eb; --muted:#94a3b8; --blue:#38bdf8; --green:#34d399; --amber:#fbbf24; --purple:#c084fc; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at 15% 10%,rgba(56,189,248,.18),transparent 30%),radial-gradient(circle at 85% 0%,rgba(192,132,252,.14),transparent 32%),linear-gradient(135deg,#020617 0%,var(--bg) 55%,#111827 100%); color:var(--text); }
    .wrap { max-width:1500px; margin:0 auto; padding:32px 20px 48px; } .card { background:var(--panel); border:1px solid var(--border); border-radius:24px; box-shadow:0 24px 80px rgba(0,0,0,.32); backdrop-filter:blur(14px); }
    .hero { padding:28px; margin-bottom:18px; } .eyebrow { color:var(--blue); font-weight:800; letter-spacing:.16em; text-transform:uppercase; font-size:12px; } h1 { font-size:clamp(30px,5vw,52px); line-height:.96; margin:12px 0 16px; letter-spacing:-.05em; } .subtitle { color:var(--muted); max-width:850px; line-height:1.65; margin:0; } .meta { margin-top:18px; display:flex; flex-wrap:wrap; gap:10px; } .chip { border:1px solid var(--border); background:rgba(15,23,42,.7); color:#cbd5e1; border-radius:999px; padding:8px 12px; font-size:13px; text-decoration:none; font-weight:800; }
    .toolbar { position:relative; z-index:100; display:grid; grid-template-columns:minmax(240px,1fr) minmax(280px,.9fr) auto; gap:12px; align-items:end; padding:16px; margin:18px 0; overflow:visible; } select,button { border:1px solid var(--border); color:var(--text); background:rgba(15,23,42,.88); border-radius:14px; padding:12px 14px; outline:none; font:inherit; min-width:0; } button { cursor:pointer; } button:hover,a:hover { filter:brightness(1.16); } .filter-group { display:grid; gap:7px; min-width:0; } .filter-label { color:#cbd5e1; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; } .state-dropdown { position:relative; z-index:101; } .state-filter-toggle { width:100%; min-height:48px; display:flex; align-items:center; justify-content:space-between; gap:10px; text-align:left; background:rgba(15,23,42,.88); border-color:rgba(148,163,184,.28); } .state-filter-toggle strong { color:#f8fafc; font-weight:800; } .state-filter-toggle .chevron { color:var(--muted); transition:transform .16s ease; } .state-dropdown.open .chevron { transform:rotate(180deg); } .state-filter-menu { position:absolute; left:0; right:0; top:calc(100% + 8px); z-index:9999; display:none; padding:10px; border:1px solid rgba(148,163,184,.24); border-radius:16px; background:rgba(15,23,42,.98); box-shadow:0 20px 50px rgba(0,0,0,.42); backdrop-filter:blur(14px); } .state-dropdown.open .state-filter-menu { display:grid; gap:6px; } .state-option { display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:12px; color:#dbeafe; font-size:13px; font-weight:700; cursor:pointer; } .state-option:hover { background:rgba(56,189,248,.10); } .state-option input { accent-color:#38bdf8; width:16px; height:16px; margin:0; } .state-filter-actions { display:flex; gap:8px; padding:4px 2px 8px; border-bottom:1px solid rgba(148,163,184,.14); margin-bottom:4px; } .state-filter-actions button { flex:1; padding:8px 10px; border-radius:10px; font-size:12px; font-weight:800; }
    .notice { margin-top:12px; color:#fde68a; display:none; } .footer { color:var(--muted); font-size:12px; margin-top:14px; text-align:right; }
    .gantt-card { position:relative; z-index:1; margin:18px 0; overflow:hidden; } .gantt-head { padding:18px 20px; display:flex; justify-content:space-between; gap:12px; align-items:flex-start; border-bottom:1px solid var(--border); flex-wrap:wrap; } .gantt-head h2 { margin:0; font-size:18px; } .gantt-head p { margin:6px 0 0; color:var(--muted); font-size:13px; } .legend { display:flex; gap:8px; flex-wrap:wrap; align-items:center; color:var(--muted); font-size:12px; } .legend span { display:inline-flex; align-items:center; gap:6px; } .dot { width:10px; height:10px; border-radius:999px; display:inline-block; } .dot.progress { background:#38bdf8; } .dot.qa { background:#fbbf24; } .dot.product { background:#c084fc; } .dot.plan { background:#fb7185; } .dot.released { background:#34d399; }
    .gantt-stats { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; padding:14px 18px; border-bottom:1px solid rgba(148,163,184,.14); } .gantt-stat { background:rgba(15,23,42,.62); border:1px solid rgba(148,163,184,.16); border-radius:14px; padding:12px; } .gantt-stat b { display:block; font-size:22px; } .gantt-stat span { color:var(--muted); font-size:12px; }
    .gantt-scroll { overflow:auto; max-height:680px; } .gantt-grid { min-width:1050px; } .gantt-scale,.gantt-row { display:grid; grid-template-columns:340px 1fr; border-bottom:1px solid rgba(148,163,184,.12); } .gantt-scale { position:sticky; top:0; z-index:2; background:rgba(15,23,42,.96); color:#cbd5e1; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.05em; } .gantt-scale-left,.gantt-task { padding:12px 14px; border-right:1px solid rgba(148,163,184,.14); } .gantt-axis,.gantt-bars { position:relative; min-height:58px; padding:12px 14px; } .tick { position:absolute; top:0; bottom:0; border-left:1px dashed rgba(148,163,184,.18); color:var(--muted); font-size:11px; padding-left:5px; } .gantt-task-title { font-weight:800; line-height:1.35; } .gantt-task-meta { color:var(--muted); font-size:12px; margin-top:4px; } .bar { position:absolute; height:18px; top:18px; border-radius:999px; min-width:4px; box-shadow:0 8px 20px rgba(0,0,0,.22); } .bar.progress { background:linear-gradient(90deg,#0284c7,#38bdf8); } .bar.qa { background:linear-gradient(90deg,#d97706,#fbbf24); } .bar.product { background:linear-gradient(90deg,#7e22ce,#c084fc); } .bar.plan { background:linear-gradient(90deg,#be123c,#fb7185); } .bar.released { background:linear-gradient(90deg,#059669,#34d399); } .bar-label { position:absolute; top:-18px; left:4px; font-size:10px; color:#e5e7eb; white-space:nowrap; text-shadow:0 1px 2px #000; } .gantt-empty { padding:28px; color:var(--muted); text-align:center; }
    ${navigationCss}
    @media (max-width:1000px) { .toolbar { grid-template-columns:1fr; } .gantt-stats { grid-template-columns:repeat(2,1fr); } }
  </style>
</head>
<body>
  <main class="layout">
    ${navHtml('timeline')}
    <div class="content">
    <section class="card hero">
      <div class="eyebrow">Azure DevOps · Product Delivery</div>
      <h1>Timeline Gantt Chart Task</h1>
      <p class="subtitle">Halaman khusus untuk monitor perubahan state task berdasarkan sprint terpilih: <b>In Progress</b> → <b>On Review QA</b> → <b>On Review Product</b> → <b>Release Plan</b> → <b>Released</b>.</p>
      <div class="meta">
        <a class="chip" href="/" data-feature-link="1">← Welcome Wizard</a>
        <a class="chip" href="/dashboard" data-feature-link="1">Buka PBI Ready Release →</a>
        <span class="chip">Team: <b id="activeTeam">Loading...</b></span>
        <span class="chip">Sprint: <b id="activeSprint">Loading...</b></span>
      </div>
      <div id="notice" class="notice"></div>
    </section>
    <section class="card toolbar">
      <div class="filter-group">
        <label class="filter-label" for="sprint">Sprint</label>
        <select id="sprint"><option>Loading sprint...</option></select>
      </div>
      <div class="filter-group">
        <label class="filter-label" for="stateFilterToggle">Filter State Task</label>
        <div id="stateDropdown" class="state-dropdown">
          <button id="stateFilterToggle" class="state-filter-toggle" type="button" aria-haspopup="listbox" aria-expanded="false"><strong id="stateFilterSummary">Semua State</strong><span class="chevron">▾</span></button>
          <div id="stateFilterMenu" class="state-filter-menu" role="listbox" aria-multiselectable="true"></div>
        </div>
      </div>
      <button id="reload">Reload Timeline</button>
    </section>
    <section class="card gantt-card">
      <div class="gantt-head">
        <div><h2>Gantt Timeline</h2><p>Bar disusun dari history/revision Azure DevOps untuk setiap task di sprint terpilih.</p></div>
        <div class="legend"><span><i class="dot progress"></i>In Progress</span><span><i class="dot qa"></i>On Review QA</span><span><i class="dot product"></i>On Review Product</span><span><i class="dot plan"></i>Release Plan</span><span><i class="dot released"></i>Released</span></div>
      </div>
      <div class="gantt-stats">
        <div class="gantt-stat"><b id="timelineTotal">-</b><span>Total task</span></div>
        <div class="gantt-stat"><b id="timelineTracked">-</b><span>Task ada timeline</span></div>
        <div class="gantt-stat"><b id="timelineReleased">-</b><span>Task released</span></div>
        <div class="gantt-stat"><b id="timelineAvg">-</b><span>Avg cycle days</span></div>
      </div>
      <div id="gantt" class="gantt-scroll"><div class="gantt-empty">Loading timeline...</div></div>
    </section>
    <div class="footer">Generated live from Azure DevOps PAT pull · <span id="generatedAt">-</span></div>
    </div>
  </main>
  <script>
    const baseWorkItemUrl = ${JSON.stringify(baseWorkItemUrl)}
    const els = Object.fromEntries(['sprint','stateDropdown','stateFilterToggle','stateFilterSummary','stateFilterMenu','reload','activeTeam','activeSprint','notice','generatedAt','gantt','timelineTotal','timelineTracked','timelineReleased','timelineAvg'].map(id => [id, document.getElementById(id)]))
    let latestTimelineData = null
    const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
    const selectedTeam = () => {
      const queryTeam = new URLSearchParams(location.search).get('team')
      if (queryTeam) return queryTeam
      try { return localStorage.getItem('platformSelectedTeam') || ${JSON.stringify(defaultTeam)} } catch { return ${JSON.stringify(defaultTeam)} }
    }
    const link = (id) => id ? '<a class="chip" href="' + baseWorkItemUrl + id + '" target="_blank" rel="noreferrer">#' + id + '</a>' : '<span class="muted">-</span>'
    const fmtDate = (value) => value ? new Date(value).toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) : '-'
    const pct = (value) => Math.max(0, Math.min(100, value))
    const stateClass = (state) => state === 'In Progress' ? 'progress' : state === 'On Review QA' ? 'qa' : state === 'On Review Product' ? 'product' : state === 'Release Plan' ? 'plan' : 'released'
    const orderedStates = ['In Progress', 'On Review QA', 'On Review Product', 'Release Plan', 'Released', 'Done', 'Resolved', 'Closed', 'New', 'To Do']
    const selectedStates = () => Array.from(els.stateFilterMenu?.querySelectorAll('input[type="checkbox"]:checked') || []).map(input => input.value).filter(Boolean)
    const allStateValues = () => Array.from(els.stateFilterMenu?.querySelectorAll('input[type="checkbox"]') || []).map(input => input.value).filter(Boolean)

    function updateStateSummary() {
      const selected = selectedStates()
      const allStates = allStateValues()
      if (!selected.length || selected.length === allStates.length) els.stateFilterSummary.textContent = 'Semua State'
      else if (selected.length === 1) els.stateFilterSummary.textContent = selected[0]
      else els.stateFilterSummary.textContent = selected.length + ' State dipilih'
    }

    function setDropdownOpen(open) {
      els.stateDropdown.classList.toggle('open', open)
      els.stateFilterToggle.setAttribute('aria-expanded', open ? 'true' : 'false')
    }

    function timelineStats(items) {
      const withTimeline = items.filter((item) => (item.segments || []).length)
      const released = items.filter((item) => item.releasedAt)
      const cycleDays = released.map((item) => item.cycleDays).filter((value) => Number.isFinite(value))
      return { totalTasks: items.length, tasksWithTimeline: withTimeline.length, releasedTasks: released.length, avgCycleDays: cycleDays.length ? Math.round((cycleDays.reduce((sum, value) => sum + value, 0) / cycleDays.length) * 10) / 10 : null }
    }

    function setupStateFilter(data) {
      const previous = new Set(selectedStates())
      const states = Array.from(new Set([...(data.trackedStates || []), ...(data.items || []).map(item => item.taskState || '-').filter(Boolean)]))
        .sort((a, b) => (orderedStates.indexOf(a) === -1 ? 999 : orderedStates.indexOf(a)) - (orderedStates.indexOf(b) === -1 ? 999 : orderedStates.indexOf(b)) || a.localeCompare(b))
      const valuesToSelect = previous.size ? previous : new Set(states)
      const actionHtml = '<div class="state-filter-actions"><button type="button" data-state-action="all">Pilih Semua</button><button type="button" data-state-action="clear">Kosongkan</button></div>'
      const optionHtml = states.map((state, index) => '<label class="state-option" role="option" aria-selected="' + (valuesToSelect.has(state) ? 'true' : 'false') + '"><input type="checkbox" value="' + esc(state) + '" ' + (valuesToSelect.has(state) ? 'checked' : '') + ' />' + esc(state) + '</label>').join('')
      els.stateFilterMenu.innerHTML = actionHtml + optionHtml
      updateStateSummary()
    }

    function renderGantt(data) {
      const activeStates = selectedStates()
      const allStates = allStateValues()
      const allItems = data.items || []
      const filteredItems = (!activeStates.length || activeStates.length === allStates.length) ? allItems : allItems.filter(item => activeStates.includes(item.taskState || '-'))
      const stats = timelineStats(filteredItems)
      els.timelineTotal.textContent = stats.totalTasks ?? 0
      els.timelineTracked.textContent = stats.tasksWithTimeline ?? 0
      els.timelineReleased.textContent = stats.releasedTasks ?? 0
      els.timelineAvg.textContent = stats.avgCycleDays == null ? '-' : stats.avgCycleDays
      els.activeSprint.textContent = data.sprintPath || els.sprint.value || '-'
      els.generatedAt.textContent = data.generatedAt || '-'
      els.notice.style.display = data.warning ? 'block' : 'none'
      els.notice.textContent = data.warning ? 'Warning: ' + data.warning : ''
      const items = filteredItems.filter(item => (item.segments || []).length)
      if (!items.length) {
        els.gantt.innerHTML = '<div class="gantt-empty">Belum ada task dengan history timeline untuk filter state task yang dipilih.</div>'
        return
      }
      const minTime = Math.min(...items.flatMap(item => item.segments.map(seg => new Date(seg.start).getTime())))
      const maxTime = Math.max(...items.flatMap(item => item.segments.map(seg => new Date(seg.end).getTime())))
      const range = Math.max(1, maxTime - minTime)
      const ticks = Array.from({length: 5}, (_, i) => '<span class="tick" style="left:' + pct(i * 25) + '%">' + esc(fmtDate(minTime + (range * i / 4))) + '</span>').join('')
      const rows = items.map(item => {
        const bars = item.segments.map(seg => {
          const left = pct(((new Date(seg.start).getTime() - minTime) / range) * 100)
          const width = Math.max(0.5, pct(((new Date(seg.end).getTime() - new Date(seg.start).getTime()) / range) * 100))
          const title = seg.state + ': ' + new Date(seg.start).toLocaleString('id-ID') + ' - ' + new Date(seg.end).toLocaleString('id-ID')
          return '<div class="bar ' + stateClass(seg.state) + '" title="' + esc(title) + '" style="left:' + left + '%;width:' + width + '%"><span class="bar-label">' + esc(seg.state) + '</span></div>'
        }).join('')
        const meta = '#' + item.taskId + ' · ' + (item.taskAssignedTo || '-') + ' · current: ' + (item.taskState || '-') + (item.cycleDays == null ? '' : ' · cycle ' + item.cycleDays + ' hari')
        return '<div class="gantt-row"><div class="gantt-task"><div class="gantt-task-title">' + link(item.taskId) + ' ' + esc(item.taskTitle) + '</div><div class="gantt-task-meta">' + esc(meta) + '</div></div><div class="gantt-bars">' + bars + '</div></div>'
      }).join('')
      els.gantt.innerHTML = '<div class="gantt-grid"><div class="gantt-scale"><div class="gantt-scale-left">Task</div><div class="gantt-axis">' + ticks + '</div></div>' + rows + '</div>'
    }

    async function loadTimeline(sprintPath) {
      els.gantt.innerHTML = '<div class="gantt-empty">Loading timeline...</div>'
      const teamName = selectedTeam()
      const res = await fetch('/api/timeline?team=' + encodeURIComponent(teamName) + '&sprintPath=' + encodeURIComponent(sprintPath))
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load timeline')
      els.activeTeam.textContent = data.team || teamName
      latestTimelineData = data
      setupStateFilter(data)
      renderGantt(data)
    }

    async function init() {
      try {
        const teamName = selectedTeam()
        els.activeTeam.textContent = teamName
        const sprints = await (await fetch('/api/sprints?team=' + encodeURIComponent(teamName))).json()
        const list = sprints.sprints || []
        els.sprint.innerHTML = list.map(s => '<option value="' + esc(s.path) + '">' + esc(s.name) + (s.timeFrame ? ' (' + esc(s.timeFrame) + ')' : '') + '</option>').join('')
        const params = new URLSearchParams(location.search)
        const requested = params.get('sprintPath')
        const current = list.find(s => s.path === requested) || list.find(s => s.timeFrame === 'current') || list.find(s => s.name.includes('Sprint 9')) || list[0]
        if (current) els.sprint.value = current.path
        await loadTimeline(els.sprint.value)
      } catch (error) {
        els.gantt.innerHTML = '<div class="gantt-empty">Gagal load timeline: ' + esc(error.message) + '</div>'
      }
    }

    els.sprint.addEventListener('change', () => loadTimeline(els.sprint.value).catch(err => alert(err.message)))
    els.stateFilterToggle.addEventListener('click', () => setDropdownOpen(!els.stateDropdown.classList.contains('open')))
    els.stateFilterMenu.addEventListener('click', (event) => {
      const action = event.target.closest('button')?.dataset.stateAction
      if (action) {
        for (const input of Array.from(els.stateFilterMenu.querySelectorAll('input[type="checkbox"]'))) input.checked = action === 'all'
      }
      for (const option of Array.from(els.stateFilterMenu.querySelectorAll('.state-option'))) option.setAttribute('aria-selected', option.querySelector('input')?.checked ? 'true' : 'false')
      updateStateSummary()
      if (latestTimelineData) renderGantt(latestTimelineData)
    })
    document.addEventListener('click', (event) => { if (!els.stateDropdown.contains(event.target)) setDropdownOpen(false) })
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setDropdownOpen(false) })
    els.reload.addEventListener('click', () => loadTimeline(els.sprint.value).catch(err => alert(err.message)))
    init()
  </script>
</body>
</html>`

const progressHtml = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Progress Minggu Lalu · Sprint Platform Dashboard</title>
  <style>
    :root { color-scheme: dark; --bg:#0b1020; --panel:rgba(15,23,42,.88); --border:rgba(148,163,184,.22); --text:#e5e7eb; --muted:#94a3b8; --blue:#38bdf8; --green:#34d399; --amber:#fbbf24; --purple:#c084fc; --red:#fb7185; }
    * { box-sizing:border-box; } body { margin:0; min-height:100vh; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:radial-gradient(circle at 15% 10%,rgba(56,189,248,.18),transparent 30%),radial-gradient(circle at 85% 0%,rgba(192,132,252,.14),transparent 32%),linear-gradient(135deg,#020617 0%,var(--bg) 55%,#111827 100%); color:var(--text); }
    .card { background:var(--panel); border:1px solid var(--border); border-radius:24px; box-shadow:0 24px 80px rgba(0,0,0,.32); backdrop-filter:blur(14px); }
    a { color:var(--blue); text-decoration:none; font-weight:900; } a:hover,button:hover { filter:brightness(1.16); }
    .hero { padding:28px; margin-bottom:18px; } .eyebrow { color:var(--blue); font-weight:800; letter-spacing:.16em; text-transform:uppercase; font-size:12px; } h1 { font-size:clamp(30px,5vw,52px); line-height:.96; margin:12px 0 16px; letter-spacing:-.05em; } .subtitle { color:var(--muted); max-width:900px; line-height:1.65; margin:0; } .meta { margin-top:18px; display:flex; flex-wrap:wrap; gap:10px; } .chip { border:1px solid var(--border); background:rgba(15,23,42,.7); color:#cbd5e1; border-radius:999px; padding:8px 12px; font-size:13px; text-decoration:none; font-weight:800; }
    .notice { margin-top:12px; color:#fde68a; display:none; } .stats { display:grid; grid-template-columns:repeat(6,1fr); gap:12px; margin:18px 0; } .stat { padding:16px; } .num { font-size:30px; font-weight:900; letter-spacing:-.04em; } .label { color:var(--muted); font-size:12px; margin-top:4px; }
    .toolbar { display:grid; grid-template-columns:minmax(230px,1fr) minmax(260px,1.2fr) minmax(180px,.7fr) auto; gap:12px; align-items:end; padding:16px; margin:18px 0; } .filter-group { display:grid; gap:7px; min-width:0; } .filter-label { color:#cbd5e1; font-size:12px; font-weight:900; letter-spacing:.08em; text-transform:uppercase; } input,select,button { border:1px solid var(--border); color:var(--text); background:rgba(15,23,42,.88); border-radius:14px; padding:12px 14px; outline:none; font:inherit; min-width:0; } button { cursor:pointer; font-weight:900; }
    .table-card { overflow:hidden; } .table-head { padding:18px 20px; display:flex; justify-content:space-between; gap:12px; align-items:center; border-bottom:1px solid var(--border); flex-wrap:wrap; } .table-head h2 { margin:0; font-size:18px; } .table-wrap { overflow:auto; max-height:680px; } table { width:100%; border-collapse:collapse; min-width:1280px; } th { color:#cbd5e1; font-size:12px; text-transform:uppercase; letter-spacing:.08em; text-align:left; background:rgba(15,23,42,.94); position:sticky; top:0; z-index:1; } th,td { padding:14px; border-bottom:1px solid rgba(148,163,184,.14); vertical-align:top; } tbody tr:hover { background:rgba(56,189,248,.07); } .title-cell { max-width:360px; line-height:1.35; } .muted { color:var(--muted); } .id-link { white-space:nowrap; } .badge,.state { display:inline-flex; align-items:center; border-radius:999px; padding:6px 10px; font-size:12px; font-weight:800; white-space:nowrap; } .state.progress { color:#bae6fd; background:rgba(56,189,248,.14); border:1px solid rgba(56,189,248,.25); } .state.done { color:#bbf7d0; background:rgba(52,211,153,.14); border:1px solid rgba(52,211,153,.25); } .state.review { color:#e9d5ff; background:rgba(192,132,252,.16); border:1px solid rgba(192,132,252,.3); } .state.neutral { color:#cbd5e1; background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.2); } .badge.hours { color:#fde68a; background:rgba(251,191,36,.14); border:1px solid rgba(251,191,36,.25); } .badge.live { color:#bae6fd; background:rgba(56,189,248,.14); border:1px solid rgba(56,189,248,.25); } .badge.closed { color:#bbf7d0; background:rgba(52,211,153,.14); border:1px solid rgba(52,211,153,.25); } .empty { padding:34px; color:var(--muted); text-align:center; } .expand-btn { width:34px; height:34px; border-radius:10px; padding:0; display:inline-grid; place-items:center; font-weight:900; } .pbi-row { background:rgba(15,23,42,.42); } .pbi-row.expanded { background:rgba(56,189,248,.08); } .task-row { background:rgba(2,6,23,.34); } .task-row.hidden { display:none; } .task-indent { padding-left:28px; position:relative; } .task-indent:before { content:'↳'; position:absolute; left:10px; color:var(--muted); } .footer { color:var(--muted); font-size:12px; margin-top:14px; text-align:right; }
    ${navigationCss}
    @media (max-width:1200px) { .stats { grid-template-columns:repeat(3,1fr); } }
    @media (max-width:1000px) { .toolbar { grid-template-columns:1fr; } .stats { grid-template-columns:repeat(2,1fr); } }
    @media (max-width:620px) { .stats { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main class="layout">
    ${navHtml('progress')}
    <div class="content">
      <section class="card hero">
        <div class="eyebrow">Azure DevOps · Product Delivery</div>
        <h1>Progress Minggu Lalu</h1>
        <p class="subtitle">Menampilkan task pada sprint terpilih yang berada di state <b>In Progress</b> selama rentang minggu lalu (Senin–Minggu). Durasi dihitung sebagai <b>jam kerja</b> Senin–Jumat pukul 09:00–17:00, dimana 1 hari kerja = 8 jam.</p>
        <div class="meta">
          <a class="chip" href="/" data-feature-link="1">← Welcome Wizard</a>
          <a class="chip" href="/timeline" data-feature-link="1">Buka Timeline Gantt →</a>
          <span class="chip">Team: <b id="activeTeam">Loading...</b></span>
          <span class="chip">Sprint: <b id="activeSprint">Loading...</b></span>
          <span class="chip">Range: <b id="activeRange">-</b></span>
        </div>
        <div id="notice" class="notice"></div>
      </section>
      <section class="stats">
        <div class="card stat"><div class="num" id="totalScanned">-</div><div class="label">Task scanned</div></div>
        <div class="card stat"><div class="num" id="inProgressTasks">-</div><div class="label">Task In Progress minggu lalu</div></div>
        <div class="card stat"><div class="num" id="stillInProgress">-</div><div class="label">Masih In Progress</div></div>
        <div class="card stat"><div class="num" id="totalHours">-</div><div class="label">Total jam kerja</div></div>
        <div class="card stat"><div class="num" id="avgHours">-</div><div class="label">Avg jam / task</div></div>
        <div class="card stat"><div class="num" id="assignees">-</div><div class="label">Assignee</div></div>
      </section>
      <section class="card toolbar">
        <div class="filter-group"><label class="filter-label" for="sprint">Sprint</label><select id="sprint"><option>Loading sprint...</option></select></div>
        <div class="filter-group"><label class="filter-label" for="q">Search</label><input id="q" type="search" placeholder="Cari PBI, task, assignee, state..." autocomplete="off" /></div>
        <div class="filter-group"><label class="filter-label" for="status">Status Progress</label><select id="status"><option value="all">Semua</option><option value="still">Ada task masih In Progress</option><option value="moved">Semua task sudah pindah state</option></select></div>
        <button id="reload" type="button">Reload</button>
      </section>
      <section class="card table-card">
        <div class="table-head"><h2>PBI In Progress Minggu Lalu</h2><span class="muted"><span id="count">0</span> PBI shown</span></div>
        <div class="table-wrap"><table><thead><tr><th></th><th>Parent PBI</th><th>PBI Title</th><th>PBI State</th><th>PBI Assignee</th><th>Task</th><th>Task Assignee</th><th>Task State</th><th>Overlap Minggu Lalu</th><th>Durasi Jam Kerja</th></tr></thead><tbody id="tbody"><tr><td class="empty" colspan="10">Loading progress...</td></tr></tbody></table></div>
      </section>
      <div class="footer">Generated live from Azure DevOps PAT pull · <span id="generatedAt">-</span></div>
    </div>
  </main>
  <script>
    const baseWorkItemUrl = ${JSON.stringify(baseWorkItemUrl)}
    const els = Object.fromEntries(['sprint','q','status','reload','activeTeam','activeSprint','activeRange','notice','generatedAt','totalScanned','inProgressTasks','stillInProgress','totalHours','avgHours','assignees','count','tbody'].map(id => [id, document.getElementById(id)]))
    let currentItems = []
    let currentGroups = []
    const esc = (v) => String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
    const selectedTeam = () => {
      const queryTeam = new URLSearchParams(location.search).get('team')
      if (queryTeam) return queryTeam
      try { return localStorage.getItem('platformSelectedTeam') || ${JSON.stringify(defaultTeam)} } catch { return ${JSON.stringify(defaultTeam)} }
    }
    const link = (id) => id ? '<a class="id-link" href="' + baseWorkItemUrl + encodeURIComponent(id) + '" target="_blank" rel="noreferrer">#' + esc(id) + '</a>' : '<span class="muted">-</span>'
    const fmtDateTime = (value) => value ? new Date(value).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '-'
    const fmtHours = (value) => Number.isFinite(Number(value)) ? (Math.round(Number(value) * 10) / 10) + ' jam kerja' : '-'
    const fmtSegments = (segments) => Array.isArray(segments) && segments.length > 1 ? '<div class="muted" style="margin-top:6px;font-size:12px">' + segments.length + ' periode In Progress dijumlahkan</div>' : ''
    const statePill = (value) => { const t = String(value || '-'); const cls = t === 'In Progress' ? 'progress' : t.includes('Review') || t === 'Release Plan' ? 'review' : ['Done','Released','Closed','Resolved'].includes(t) ? 'done' : 'neutral'; return '<span class="state ' + cls + '">' + esc(t) + '</span>' }

    function searchable(item) {
      return [item.taskId, item.taskTitle, item.taskAssignedTo, item.taskState, item.parentId, item.pbiTitle, item.pbiState, item.pbiAssignedTo].join(' ').toLowerCase()
    }

    function groupSearchable(group) {
      return [group.pbiId, group.pbiTitle, group.pbiState, group.pbiAssignedTo, (group.tasks || []).map(searchable).join(' ')].join(' ').toLowerCase()
    }

    function buildClientPbiGroups(items) {
      const map = new Map()
      for (const item of items) {
        const key = item.parentId || 'no-parent-' + item.taskId
        if (!map.has(key)) {
          map.set(key, { pbiId: item.parentId || null, pbiTitle: item.pbiTitle || '(Task tanpa Parent PBI)', pbiState: item.pbiState || '', pbiAssignedTo: item.pbiAssignedTo || '', taskCount: 0, stillInProgress: 0, durationHours: 0, firstOverlapStart: item.overlapStart || '', lastOverlapEnd: item.overlapEnd || '', tasks: [] })
        }
        const group = map.get(key)
        group.tasks.push(item)
        group.taskCount += 1
        group.stillInProgress += item.stillInProgress ? 1 : 0
        group.durationHours = Math.round((group.durationHours + (Number(item.durationHours) || 0)) * 10) / 10
        if (item.overlapStart && (!group.firstOverlapStart || new Date(item.overlapStart) < new Date(group.firstOverlapStart))) group.firstOverlapStart = item.overlapStart
        if (item.overlapEnd && (!group.lastOverlapEnd || new Date(item.overlapEnd) > new Date(group.lastOverlapEnd))) group.lastOverlapEnd = item.overlapEnd
      }
      return Array.from(map.values())
    }

    function pbiGroupHtml(group, index) {
      const key = 'pbi-' + index
      const taskCount = group.taskCount || (group.tasks || []).length
      const marker = group.stillInProgress > 0 ? '<span class="badge live">' + esc(group.stillInProgress) + ' task masih In Progress</span>' : '<span class="badge closed">Semua task sudah pindah</span>'
      const overlap = fmtDateTime(group.firstOverlapStart) + ' → ' + fmtDateTime(group.lastOverlapEnd)
      const pbiRow = '<tr class="pbi-row" data-pbi-row="' + key + '" data-search="' + esc(groupSearchable(group)) + '" data-still="' + (group.stillInProgress > 0 ? '1' : '0') + '"><td><button class="expand-btn" type="button" data-toggle-pbi="' + key + '" aria-expanded="false" title="Lihat task">▸</button></td><td>' + link(group.pbiId) + '</td><td class="title-cell">' + esc(group.pbiTitle || '-') + '</td><td>' + statePill(group.pbiState) + '</td><td>' + esc(group.pbiAssignedTo || '-') + '</td><td><span class="badge hours">' + esc(taskCount) + ' task</span></td><td class="muted">-</td><td>' + marker + '</td><td>' + esc(overlap) + '</td><td><span class="badge hours">' + esc(fmtHours(group.durationHours)) + '</span></td></tr>'
      const taskRows = (group.tasks || []).map((item) => taskRowHtml(item, key)).join('')
      return pbiRow + taskRows
    }

    function taskRowHtml(item, key) {
      const overlap = fmtDateTime(item.overlapStart) + ' → ' + fmtDateTime(item.overlapEnd)
      const marker = item.stillInProgress ? '<span class="badge live">Masih In Progress</span>' : '<span class="badge closed">Sudah pindah</span>'
      return '<tr class="task-row hidden" data-task-row="' + key + '"><td></td><td></td><td></td><td></td><td></td><td class="title-cell task-indent">' + link(item.taskId) + ' ' + esc(item.taskTitle || '-') + '</td><td>' + esc(item.taskAssignedTo || '-') + '</td><td>' + statePill(item.taskState) + '<div style="margin-top:6px">' + marker + '</div></td><td>' + esc(overlap) + '</td><td><span class="badge hours">' + esc(fmtHours(item.durationHours)) + '</span>' + fmtSegments(item.progressSegments) + '</td></tr>'
    }

    function applyFilter() {
      const term = els.q.value.trim().toLowerCase()
      const mode = els.status.value
      let shown = 0
      for (const row of Array.from(els.tbody.querySelectorAll('tr[data-pbi-row]'))) {
        const matchTerm = !term || (row.dataset.search || '').includes(term)
        const matchStatus = mode === 'all' || (mode === 'still' && row.dataset.still === '1') || (mode === 'moved' && row.dataset.still !== '1')
        const visible = matchTerm && matchStatus
        row.style.display = visible ? '' : 'none'
        if (visible) shown++
        const key = row.dataset.pbiRow
        const expanded = row.classList.contains('expanded')
        for (const child of Array.from(els.tbody.querySelectorAll('tr[data-task-row="' + key + '"]'))) {
          child.classList.toggle('hidden', !(visible && expanded))
          child.style.display = visible && expanded ? 'table-row' : 'none'
        }
      }
      els.count.textContent = shown
    }

    function togglePbi(key) {
      const row = els.tbody.querySelector('tr[data-pbi-row="' + key + '"]')
      if (!row) return
      const expanded = !row.classList.contains('expanded')
      row.classList.toggle('expanded', expanded)
      const btn = row.querySelector('[data-toggle-pbi]')
      if (btn) { btn.textContent = expanded ? '▾' : '▸'; btn.setAttribute('aria-expanded', expanded ? 'true' : 'false') }
      applyFilter()
    }

    function render(data) {
      currentItems = data.items || []
      currentGroups = Array.isArray(data.pbiGroups) ? data.pbiGroups : buildClientPbiGroups(currentItems)
      const stats = data.stats || {}
      els.activeTeam.textContent = data.team || selectedTeam()
      els.activeSprint.textContent = data.sprintPath || els.sprint.value || '-'
      els.activeRange.textContent = data.range?.label || '-'
      els.totalScanned.textContent = stats.totalTasksScanned ?? 0
      els.inProgressTasks.textContent = stats.inProgressTasks ?? currentItems.length
      els.stillInProgress.textContent = stats.stillInProgress ?? 0
      els.totalHours.textContent = stats.totalHours ?? 0
      els.avgHours.textContent = stats.avgHours ?? 0
      els.assignees.textContent = stats.assignees ?? 0
      els.generatedAt.textContent = data.generatedAt || '-'
      els.notice.style.display = data.warning ? 'block' : 'none'
      els.notice.textContent = data.warning ? 'Warning: ' + data.warning : ''
      els.tbody.innerHTML = currentGroups.length ? currentGroups.map(pbiGroupHtml).join('') : '<tr><td class="empty" colspan="10">Belum ada task yang berada di state In Progress pada minggu lalu untuk sprint ini.</td></tr>'
      applyFilter()
    }

    async function loadProgress(sprintPath) {
      els.tbody.innerHTML = '<tr><td class="empty" colspan="10">Loading progress...</td></tr>'
      els.count.textContent = '0'
      const teamName = selectedTeam()
      const res = await fetch('/api/progress?team=' + encodeURIComponent(teamName) + '&sprintPath=' + encodeURIComponent(sprintPath))
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load progress')
      render(data)
    }

    async function init() {
      try {
        const teamName = selectedTeam()
        els.activeTeam.textContent = teamName
        const sprints = await (await fetch('/api/sprints?team=' + encodeURIComponent(teamName))).json()
        const list = sprints.sprints || []
        els.sprint.innerHTML = list.map(s => '<option value="' + esc(s.path) + '">' + esc(s.name) + (s.timeFrame ? ' (' + esc(s.timeFrame) + ')' : '') + '</option>').join('')
        const params = new URLSearchParams(location.search)
        const requested = params.get('sprintPath')
        const current = list.find(s => s.path === requested) || list.find(s => s.timeFrame === 'current') || list.find(s => s.name.includes('Sprint 9')) || list[0]
        if (current) els.sprint.value = current.path
        await loadProgress(els.sprint.value)
      } catch (error) {
        els.tbody.innerHTML = '<tr><td class="empty" colspan="10">Gagal load progress: ' + esc(error.message) + '</td></tr>'
      }
    }

    els.tbody.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-toggle-pbi]')
      if (btn) togglePbi(btn.dataset.togglePbi)
    })
    els.sprint.addEventListener('change', () => loadProgress(els.sprint.value).catch(err => alert(err.message)))
    els.q.addEventListener('input', applyFilter)
    els.status.addEventListener('change', applyFilter)
    els.reload.addEventListener('click', () => loadProgress(els.sprint.value).catch(err => alert(err.message)))
    init()
  </script>
</body>
</html>`

function writeJson(response, statusCode, payload) {
  const body = JSON.stringify(payload, null, 2)
  response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  response.end(body)
}

async function handleRequest(request, response) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)

  if (url.pathname === '/healthz') {
    return writeJson(response, 200, { ok: true, service: 'platform-sprint-dashboard', dynamicSprintFilter: true, patConfigured: Boolean(pat), authEnabled: Boolean(dashboardPasswordSalt && dashboardPasswordHash) })
  }

  if (url.pathname === '/login' && request.method === 'GET') {
    if (isAuthenticated(request)) return redirect(response, '/')
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return response.end(loginHtml(url.searchParams.get('error') || ''))
  }

  if (url.pathname === '/login' && request.method === 'POST') {
    const form = await readForm(request)
    const username = String(form.get('username') || '')
    const password = String(form.get('password') || '')
    if (verifyLogin(username, password)) return redirect(response, '/', { 'set-cookie': authCookie(createSession(username)) })
    response.writeHead(401, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return response.end(loginHtml('Username atau password salah.'))
  }

  if (url.pathname === '/logout') {
    return redirect(response, '/login', { 'set-cookie': authCookie('', 0) })
  }

  const protectedPath = dashboardPasswordSalt && dashboardPasswordHash && (url.pathname === '/' || url.pathname === '/dashboard' || url.pathname === '/timeline' || url.pathname === '/progress' || url.pathname.startsWith('/api/'))
  if (protectedPath && !isAuthenticated(request)) {
    if (url.pathname.startsWith('/api/')) return writeJson(response, 401, { ok: false, message: 'Unauthorized' })
    return redirect(response, '/login')
  }

  if (url.pathname === '/api/sprints') {
    const team = normalizeTeamName(url.searchParams.get('team'))
    const sprints = await safeListSprints(team)
    return writeJson(response, 200, { team, sprints })
  }

  if (url.pathname === '/api/teams') {
    const teams = await safeListTeams()
    return writeJson(response, 200, { teams })
  }

  if (url.pathname === '/api/data') {
    const team = normalizeTeamName(url.searchParams.get('team'))
    const sprints = await safeListSprints(team)
    const defaultSprint = sprints.find((s) => s.timeFrame === 'current') || sprints.find((s) => s.name.includes('Sprint 9')) || sprints[0] || fallbackSprints[0]
    const sprintPath = url.searchParams.get('sprintPath') || defaultSprint.path
    const data = await safeSprintData(sprintPath, team)
    return writeJson(response, 200, data)
  }

  if (url.pathname === '/api/timeline') {
    const team = normalizeTeamName(url.searchParams.get('team'))
    const sprints = await safeListSprints(team)
    const defaultSprint = sprints.find((s) => s.timeFrame === 'current') || sprints.find((s) => s.name.includes('Sprint 9')) || sprints[0] || fallbackSprints[0]
    const sprintPath = url.searchParams.get('sprintPath') || defaultSprint.path
    const data = await safeSprintTimeline(sprintPath, team)
    return writeJson(response, 200, data)
  }

  if (url.pathname === '/api/progress') {
    const team = normalizeTeamName(url.searchParams.get('team'))
    const sprints = await safeListSprints(team)
    const defaultSprint = sprints.find((s) => s.timeFrame === 'current') || sprints.find((s) => s.name.includes('Sprint 9')) || sprints[0] || fallbackSprints[0]
    const sprintPath = url.searchParams.get('sprintPath') || defaultSprint.path
    const data = await safeLastWeekProgress(sprintPath, team)
    return writeJson(response, 200, data)
  }

  if (url.pathname === '/dashboard') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return response.end(dashboardHtml)
  }

  if (url.pathname === '/timeline') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return response.end(timelineHtml)
  }

  if (url.pathname === '/progress') {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    return response.end(progressHtml)
  }

  if (url.pathname !== '/') return redirect(response, '/')

  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
  response.end(homeHtml)
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error)
    writeJson(response, 500, { ok: false, message: error.message || 'Internal server error' })
  })
})

server.listen(port, host, () => {
  console.log(`[platform-sprint-dashboard] listening on http://${host}:${port}`)
})
