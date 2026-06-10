// Azure DevOps API utilities for Nuxt server routes

const cache = new Map<string, { at: number; value: unknown }>()
const cacheMs = 60_000

function cfg() {
  const c = useRuntimeConfig()
  return {
    org: (c.azureDevOpsOrg as string) || 'KiriminAja2026',
    project: (c.azureDevOpsProject as string) || 'Product Delivery',
    team: (c.azureDevOpsTeam as string) || 'Platform Squad',
    teams: ((c.azureDevOpsTeams as string) || '').split(',').map((v: string) => v.trim()).filter(Boolean),
    pat: (c.azureDevOpsPat as string) || '',
    ver: '7.1',
  }
}

function wiqlQuote(v: string) { return String(v).replaceAll("'", "''") }
export function assignedName(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'object' && v !== null) return (v as Record<string, string>).displayName || (v as Record<string, string>).uniqueName || ''
  return String(v)
}
function toIsoDate(v: unknown) {
  const d = new Date((v as string) || Date.now())
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString()
}
function addDaysIso(v: unknown, days: number) {
  return new Date(new Date(v as string).getTime() + days * 86_400_000).toISOString()
}
function stateName(v: unknown) { return String(v || '').trim() }
export function normalizeTeamName(v: unknown): string {
  return String(v || '').trim() || cfg().team
}

function headers(pat: string) {
  if (!pat) throw new Error('AZURE_DEVOPS_PAT is not set')
  return { authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`, accept: 'application/json' }
}

async function adoFetch(url: string, options: Record<string, unknown> = {}) {
  const { pat } = cfg()
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers(pat),
      ...((options.body as string) ? { 'content-type': 'application/json' } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
    signal: AbortSignal.timeout(30_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Azure DevOps ${res.status}: ${text.slice(0, 400)}`)
  return text.trim() ? JSON.parse(text) : null
}

async function batchWorkItems(ids: number[], opts: { fields?: string[]; expand?: string; project?: string } = {}) {
  const { org, project: defaultProject, ver } = cfg()
  const project = opts.project || defaultProject
  const result: unknown[] = []
  for (let i = 0; i < ids.length; i += 200) {
    const body: Record<string, unknown> = { ids: ids.slice(i, i + 200), errorPolicy: 'Omit' }
    if (opts.fields && !opts.expand) body.fields = opts.fields
    if (opts.expand) body.$expand = opts.expand
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workitemsbatch?api-version=${ver}`
    const data = await adoFetch(url, { method: 'POST', body: JSON.stringify(body) })
    result.push(...((data.value as unknown[]) || []))
  }
  return result as Record<string, unknown>[]
}

export async function getOpiData(customStart?: string, customEnd?: string, sprintPath?: string) {
  const { org, ver } = cfg()
  const project = 'OPI Board'
  
  // Base date calculation for fallback
  const now = new Date()
  const dayOfWeek = now.getDay() || 7 // 1-7 (Mon-Sun)
  const lastSunday = new Date(now)
  lastSunday.setDate(now.getDate() - dayOfWeek)
  lastSunday.setHours(23, 59, 59, 999)

  const lastMonday = new Date(lastSunday)
  lastMonday.setDate(lastSunday.getDate() - 6)
  lastMonday.setHours(0, 0, 0, 0)

  const startDate = customStart || lastMonday.toISOString().split('T')[0]
  const endDate = customEnd || lastSunday.toISOString().split('T')[0]

  const key = `opi_data_${startDate}_${endDate}_${sprintPath || ""}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value



  // Query only User Stories, Bugs, Issues matching the date range
  let wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='${wiqlQuote(project)}' AND [System.WorkItemType] IN ('User Story', 'Bug', 'Issue')`
  if (sprintPath) wiql += ` AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}'`
  if (!sprintPath) wiql += ` AND ([Microsoft.VSTS.Common.ActivatedDate] >= '${startDate}' AND [Microsoft.VSTS.Common.ActivatedDate] <= '${endDate}' OR [Microsoft.VSTS.Common.ClosedDate] >= '${startDate}' AND [Microsoft.VSTS.Common.ClosedDate] <= '${endDate}')`
  wiql += ` ORDER BY [System.Id]`
  const wiqlData = await adoFetch(`https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${ver}`, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const storyIds = ((wiqlData.workItems as Record<string, number>[]) || []).map((i) => i.id)
  
  const stories: Record<string, unknown>[] = []
  let totalTasks = 0
  let completedTasks = 0

  if (storyIds.length > 0) {
    // Fetch stories to get relations (child tasks)
    const storyItems = await batchWorkItems(storyIds, { expand: 'Relations', project })
    
    const childIds: number[] = []
    const childrenByParent = new Map<number, number[]>()
    
    for (const story of storyItems) {
      for (const rel of (story.relations as Record<string, unknown>[]) || []) {
        if (rel.rel !== 'System.LinkTypes.Hierarchy-Forward') continue
        const childId = Number(String(rel.url).split('/').pop())
        if (!Number.isFinite(childId)) continue
        childIds.push(childId)
        if (!childrenByParent.has(story.id as number)) childrenByParent.set(story.id as number, [])
        childrenByParent.get(story.id as number)!.push(childId)
      }
    }

    // Fetch all child tasks
    const fields = ['System.Id','System.WorkItemType','System.Title','System.State','System.AssignedTo','System.Parent']
    const childItems = childIds.length ? await batchWorkItems([...new Set(childIds)], { fields, project }) : []
    const childById = new Map(childItems.map((i) => [i.id as number, i]))

    for (const story of storyItems) {
      const f = story.fields as Record<string, unknown>
      const id = story.id as number
      const title = String(f['System.Title'] || '')
      const state = stateName(f['System.State'])
      const assignedTo = assignedName(f['System.AssignedTo'])
      const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_workitems/edit/${id}`

      const cIds = childrenByParent.get(id) || []
      const tasks = cIds.map(cid => childById.get(cid)).filter(Boolean).map(c => {
        const cf = c!.fields as Record<string, unknown>
        const cState = stateName(cf['System.State'])
        totalTasks++
        if (['Closed', 'Done', 'Resolved'].includes(cState)) completedTasks++
        return {
          id: c!.id,
          title: String(cf['System.Title'] || ''),
          state: cState,
          assignedTo: assignedName(cf['System.AssignedTo']),
          url: `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_workitems/edit/${c!.id}`,
          type: String(cf['System.WorkItemType'] || 'Task'),
        }
      })

      stories.push({
        id, title, state, assignedTo, url, tasks,
        type: String(f['System.WorkItemType'] || 'User Story'),
      })
    }
  }

  const result = {
    team: 'OPI Board Team',
    dateRange: (sprintPath && !customStart && !customEnd) ? 'Iteration Timeframe' : `${startDate} - ${endDate}`,
    stats: {
      totalStories: stories.length,
      totalTasks,
      completedTasks,
      progressPercentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    },
    stories
  }

  cache.set(key, { at: Date.now(), value: result })
  return result
}

async function getRevisions(id: number) {
  const { org, project, ver } = cfg()
  const all: unknown[] = []
  let skip = 0
  while (true) {
    const url = `https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/workItems/${id}/revisions?$top=200&$skip=${skip}&api-version=${ver}`
    const data = await adoFetch(url)
    const value: unknown[] = data.value || []
    all.push(...value)
    if (value.length < 200) break
    skip += 200
  }
  return all as Record<string, unknown>[]
}

export async function listTeams(): Promise<string[]> {
  const key = 'teams'
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value as string[]
  const { org, project, team: defaultTeam, teams: configured, ver } = cfg()
  let teams: string[] = []
  if (configured.length) {
    teams = configured
  } else {
    const url = `https://dev.azure.com/${org}/_apis/projects/${encodeURIComponent(project)}/teams?api-version=${ver}`
    const data = await adoFetch(url)
    teams = ((data.value as Record<string, string>[]) || []).map((i) => i.name).filter(Boolean)
  }
  if (!teams.includes(defaultTeam)) teams.unshift(defaultTeam)
  const value = [...new Set(teams)].sort((a, b) => a.localeCompare(b))
  cache.set(key, { at: Date.now(), value })
  return value
}

export async function listSprints(teamName?: string, projectName?: string) {
  const { org, project: defaultProject, team: defaultTeam, ver } = cfg()
  const p = projectName || defaultProject
  const t = normalizeTeamName(teamName) || defaultTeam
  const key = `sprints:${p}:${t}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value as Record<string, unknown>[]
  const url = `https://dev.azure.com/${org}/${encodeURIComponent(p)}/${encodeURIComponent(t)}/_apis/work/teamsettings/iterations?api-version=${ver}`
  const data = await adoFetch(url)
  const value = ((data.value as Record<string, unknown>[]) || []).map((item) => ({
    id: item.id, name: item.name, path: item.path,
    timeFrame: (item.attributes as Record<string, string>)?.timeFrame || '',
  }))
  cache.set(key, { at: Date.now(), value })
  return value
}

export async function getSprintData(sprintPath: string, teamName?: string) {
  const { org, project, team: defaultTeam, ver } = cfg()
  const t = normalizeTeamName(teamName) || defaultTeam
  const key = `data:${t}:${sprintPath}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='${wiqlQuote(project)}' AND [System.WorkItemType]='Product Backlog Item' AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}' ORDER BY [System.Id]`
  const wiqlData = await adoFetch(`https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${ver}`, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const pbiIds = ((wiqlData.workItems as Record<string, number>[]) || []).map((i) => i.id)
  const pbiItems = pbiIds.length ? await batchWorkItems(pbiIds, { expand: 'Relations' }) : []

  const childIds: number[] = []
  const childrenByParent = new Map<number, number[]>()
  for (const pbi of pbiItems) {
    for (const rel of (pbi.relations as Record<string, unknown>[]) || []) {
      if (rel.rel !== 'System.LinkTypes.Hierarchy-Forward') continue
      const childId = Number(String(rel.url).split('/').pop())
      if (!Number.isFinite(childId)) continue
      childIds.push(childId)
      if (!childrenByParent.has(pbi.id as number)) childrenByParent.set(pbi.id as number, [])
      childrenByParent.get(pbi.id as number)!.push(childId)
    }
  }

  const fields = ['System.Id','System.WorkItemType','System.Title','System.State','System.AssignedTo','System.Parent']
  const childItems = childIds.length ? await batchWorkItems([...new Set(childIds)], { fields }) : []
  const childById = new Map(childItems.map((i) => [i.id as number, i]))
  const pbis: Record<string, unknown>[] = []

  for (const pbi of pbiItems) {
    const pf = (pbi.fields as Record<string, unknown>) || {}
    const pbiState = String(pf['System.State'] || '')
    const isResolved = pbiState.toLowerCase() === 'resolved'
    const allChildren = (childrenByParent.get(pbi.id as number) || []).map((id) => childById.get(id)).filter(Boolean) as Record<string, unknown>[]
    const reviewChildren = allChildren.filter((c) => String((c.fields as Record<string, unknown>)?.['System.State'] || '').toLowerCase() === 'on review product')
    const planChildren = allChildren.filter((c) => String((c.fields as Record<string, unknown>)?.['System.State'] || '').toLowerCase() === 'release plan')
    if (!isResolved && !reviewChildren.length && !planChildren.length) continue

    const reasons = []
    if (isResolved) reasons.push('PBI Resolved')
    if (reviewChildren.length) reasons.push('Task On Review Product')
    if (planChildren.length) reasons.push('Task Release Plan')
    const reason = reasons.join(' + ')

    const tasks = allChildren.map((c) => {
      const cf = (c.fields as Record<string, unknown>) || {}
      return { taskId: c.id, taskTitle: cf['System.Title'] || '', taskState: cf['System.State'] || '', taskAssignedTo: assignedName(cf['System.AssignedTo']) }
    })
    pbis.push({ pbiId: pbi.id, pbiTitle: pf['System.Title'] || '', pbiState, pbiAssignedTo: assignedName(pf['System.AssignedTo']), reason, taskCount: tasks.length, reviewTaskCount: reviewChildren.length, releasePlanTaskCount: planChildren.length, tasks })
  }

  const value = { generatedAt: new Date().toISOString(), team: t, sprintPath, pbis, stats: { pbiInSprint: pbiIds.length, readyReleasePbis: pbis.length, resolvedPbis: pbis.filter((p) => p.pbiState === 'Resolved').length, reviewTasks: pbis.reduce((s, p) => s + (p.reviewTaskCount as number), 0), releasePlanTasks: pbis.reduce((s, p) => s + (p.releasePlanTaskCount as number), 0) } }
  cache.set(key, { at: Date.now(), value })
  return value
}

const TRACKED = new Set(['In Progress','On Review QA','On Review Product','Release Plan','Released'])

export async function getSprintTimeline(sprintPath: string, teamName?: string) {
  const { org, project, team: defaultTeam, ver } = cfg()
  const t = normalizeTeamName(teamName) || defaultTeam
  const key = `timeline:${t}:${sprintPath}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='${wiqlQuote(project)}' AND [System.WorkItemType]='Task' AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}' ORDER BY [System.Id]`
  const wiqlData = await adoFetch(`https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${ver}`, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const taskIds = ((wiqlData.workItems as Record<string, number>[]) || []).map((i) => i.id)
  const fields = ['System.Id','System.Title','System.State','System.AssignedTo','System.Parent','System.ChangedDate']
  const taskItems = taskIds.length ? await batchWorkItems(taskIds, { fields }) : []
  const now = new Date().toISOString()
  const items: Record<string, unknown>[] = []

  for (const task of taskItems) {
    const tf = (task.fields as Record<string, unknown>) || {}
    let revisionWarning = ''
    let revisions: Record<string, unknown>[] = []
    try { revisions = await getRevisions(task.id as number) } catch (e: unknown) { revisionWarning = (e as Error).message }

    const changes: { state: string; at: string }[] = []
    let lastState = ''
    for (const rev of revisions) {
      const rf = (rev.fields as Record<string, unknown>) || {}
      const s = stateName(rf['System.State'])
      if (!s || s === lastState) continue
      lastState = s
      changes.push({ state: s, at: toIsoDate(rf['System.ChangedDate'] || rf['System.RevisedDate']) })
    }

    const segments: Record<string, unknown>[] = []
    for (let i = 0; i < changes.length; i++) {
      const ch = changes[i]
      if (!TRACKED.has(ch.state)) continue
      const next = changes.slice(i + 1).find((x) => x.at > ch.at)
      const end = next?.at || (ch.state === 'Released' ? addDaysIso(ch.at, 1) : now)
      segments.push({ state: ch.state, start: ch.at, end, current: !next && ch.state !== 'Released' })
    }

    const inProgressAt = changes.find((c) => c.state === 'In Progress')?.at || null
    const releasedAt = changes.find((c) => c.state === 'Released')?.at || null
    const cycleDays = inProgressAt && releasedAt ? Math.max(0, (new Date(releasedAt).getTime() - new Date(inProgressAt).getTime()) / 86_400_000) : null
    items.push({ taskId: task.id, taskTitle: tf['System.Title'] || '', taskState: tf['System.State'] || '', taskAssignedTo: assignedName(tf['System.AssignedTo']), parentId: tf['System.Parent'] || null, inProgressAt, releasedAt, cycleDays: Number.isFinite(cycleDays) ? Math.round((cycleDays as number) * 10) / 10 : null, segments, changes, warning: revisionWarning })
  }

  const withTl = items.filter((i) => (i.segments as unknown[]).length > 0)
  const released = items.filter((i) => i.releasedAt)
  const days = released.map((i) => i.cycleDays).filter((d) => Number.isFinite(d)) as number[]
  const stats = { totalTasks: items.length, tasksWithTimeline: withTl.length, releasedTasks: released.length, avgCycleDays: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10 : null }
  const value = { generatedAt: new Date().toISOString(), team: t, sprintPath, trackedStates: [...TRACKED], items, stats }
  cache.set(key, { at: Date.now(), value })
  return value
}

function isWorkday(d: Date) { const day = d.getDay(); return day !== 0 && day !== 6 }
function workHoursBetween(startMs: number, endMs: number) {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return 0
  let total = 0
  const cur = new Date(startMs); cur.setHours(0, 0, 0, 0)
  while (cur.getTime() < endMs) {
    if (isWorkday(cur)) {
      // Pagi: 08:00 - 12:00
      const ws1 = new Date(cur); ws1.setHours(8, 0, 0, 0)
      const we1 = new Date(cur); we1.setHours(12, 0, 0, 0)
      const os1 = Math.max(startMs, ws1.getTime()); const oe1 = Math.min(endMs, we1.getTime())
      if (oe1 > os1) total += oe1 - os1

      // Siang: 13:00 - 17:00
      const ws2 = new Date(cur); ws2.setHours(13, 0, 0, 0)
      const we2 = new Date(cur); we2.setHours(17, 0, 0, 0)
      const os2 = Math.max(startMs, ws2.getTime()); const oe2 = Math.min(endMs, we2.getTime())
      if (oe2 > os2) total += oe2 - os2
    }
    cur.setDate(cur.getDate() + 1)
  }
  return total / 3_600_000
}

function prevWeekRange() {
  const ref = new Date()
  const local = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
  const day = local.getDay()
  const curMon = new Date(local); curMon.setDate(local.getDate() - ((day + 6) % 7))
  const start = new Date(curMon); start.setDate(curMon.getDate() - 7)
  const end = new Date(curMon)
  const label = `${start.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })} - ${new Date(end.getTime() - 1).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' })}`
  return { start, end, startIso: start.toISOString(), endIso: end.toISOString(), label }
}

export async function getLastWeekProgress(sprintPath: string, teamName?: string) {
  const { org, project, team: defaultTeam, ver } = cfg()
  const t = normalizeTeamName(teamName) || defaultTeam
  const range = prevWeekRange()
  const key = `progress:${t}:${sprintPath}:${range.startIso}`
  const cached = cache.get(key)
  if (cached && Date.now() - cached.at < cacheMs) return cached.value

  const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject]='${wiqlQuote(project)}' AND [System.WorkItemType]='Task' AND [System.IterationPath] UNDER '${wiqlQuote(sprintPath)}' ORDER BY [System.Id]`
  const wiqlData = await adoFetch(`https://dev.azure.com/${org}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=${ver}`, { method: 'POST', body: JSON.stringify({ query: wiql }) })
  const taskIds = ((wiqlData.workItems as Record<string, number>[]) || []).map((i) => i.id)
  const fields = ['System.Id','System.Title','System.State','System.AssignedTo','System.Parent','System.ChangedDate', 'Microsoft.VSTS.Scheduling.RemainingWork', 'Microsoft.VSTS.Scheduling.Effort', 'Microsoft.VSTS.Scheduling.StoryPoints']
  const taskItems = taskIds.length ? await batchWorkItems(taskIds, { fields }) : []
  const rangeStart = range.start.getTime(); const rangeEnd = range.end.getTime()
  const now = new Date().toISOString()
  const items: Record<string, unknown>[] = []

  for (const task of taskItems) {
    const tf = (task.fields as Record<string, unknown>) || {}
    let revisions: Record<string, unknown>[] = []
    let revisionWarning = ''
    try { revisions = await getRevisions(task.id as number) } catch (e: unknown) { revisionWarning = (e as Error).message }

    const changes: { state: string; at: string }[] = []
    let lastState = ''
    for (const rev of revisions) {
      const rf = (rev.fields as Record<string, unknown>) || {}
      const s = stateName(rf['System.State'])
      if (!s || s === lastState) continue
      lastState = s
      changes.push({ state: s, at: toIsoDate(rf['System.ChangedDate'] || rf['System.RevisedDate']) })
    }

    const segments: Record<string, unknown>[] = []
    for (let i = 0; i < changes.length; i++) {
      const ch = changes[i]
      if (ch.state !== 'In Progress') continue
      const next = changes.slice(i + 1).find((x) => x.at > ch.at)
      const segStart = new Date(ch.at).getTime(); const segEnd = new Date(next?.at || now).getTime()
      if (!Number.isFinite(segStart) || !Number.isFinite(segEnd)) continue
      if (segEnd <= segStart || segStart >= rangeEnd || segEnd <= rangeStart) continue
      const os = Math.max(segStart, rangeStart); const oe = Math.min(segEnd, rangeEnd)
      segments.push({ inProgressStart: new Date(segStart).toISOString(), inProgressEnd: next?.at || null, overlapStart: new Date(os).toISOString(), overlapEnd: new Date(oe).toISOString(), durationHours: Math.round(workHoursBetween(os, oe) * 10) / 10, stillInProgress: !next })
    }

    if (segments.length) {
      const durationHours = Math.round(segments.reduce((s, seg) => s + (seg.durationHours as number), 0) * 10) / 10
      const effortPoint = Number(tf['Microsoft.VSTS.Scheduling.RemainingWork']) || Number(tf['Microsoft.VSTS.Scheduling.Effort']) || Number(tf['Microsoft.VSTS.Scheduling.StoryPoints']) || 0
      let targetMaxHours = null
      if (effortPoint === 1) targetMaxHours = 4
      else if (effortPoint === 2) targetMaxHours = 8
      else if (effortPoint === 3) targetMaxHours = 17.9 // < 18
      else if (effortPoint === 5) targetMaxHours = 35.9 // < 4 hari (36)
      else if (effortPoint === 8) targetMaxHours = 45 // 1 minggu (5 hari * 9 jam)
      else if (effortPoint === 13) targetMaxHours = 90 // 2 minggu

      let isWithinTarget = null
      if (targetMaxHours !== null) isWithinTarget = durationHours <= targetMaxHours

      items.push({ taskId: task.id, taskTitle: tf['System.Title'] || '', taskState: tf['System.State'] || '', taskAssignedTo: assignedName(tf['System.AssignedTo']), parentId: tf['System.Parent'] || null, inProgressStart: (segments[0] as Record<string, unknown>).inProgressStart, inProgressEnd: (segments[segments.length - 1] as Record<string, unknown>).inProgressEnd, overlapStart: (segments[0] as Record<string, unknown>).overlapStart, overlapEnd: (segments[segments.length - 1] as Record<string, unknown>).overlapEnd, durationHours, effortPoint, targetMaxHours, isWithinTarget, progressSegments: segments, stillInProgress: (segments[segments.length - 1] as Record<string, unknown>).stillInProgress, warning: revisionWarning })
    }
  }

  const parentIds = [...new Set(items.map((i) => i.parentId).filter(Boolean))] as number[]
  const parentItems = parentIds.length ? await batchWorkItems(parentIds, { fields: ['System.Id','System.Title','System.State','System.AssignedTo'] }) : []
  const parentById = new Map(parentItems.map((i) => [i.id as number, i]))
  for (const item of items) {
    const parent = parentById.get(item.parentId as number)
    const pf = (parent?.fields as Record<string, unknown>) || {}
    item.pbiTitle = pf['System.Title'] || ''
    item.pbiState = pf['System.State'] || ''
    item.pbiAssignedTo = assignedName(pf['System.AssignedTo'])
  }

  items.sort((a, b) => String(a.taskAssignedTo).localeCompare(String(b.taskAssignedTo)) || new Date(a.overlapStart as string).getTime() - new Date(b.overlapStart as string).getTime())

  // Build PBI groups
  const groups = new Map<string, Record<string, unknown>>()
  for (const item of items) {
    const gkey = String(item.parentId || `no-parent:${item.taskId}`)
    if (!groups.has(gkey)) groups.set(gkey, { pbiId: item.parentId || null, pbiTitle: item.pbiTitle || '(Task tanpa Parent PBI)', pbiState: item.pbiState || '', pbiAssignedTo: item.pbiAssignedTo || '', taskCount: 0, stillInProgress: 0, durationHours: 0, effortPoint: 0, firstOverlapStart: item.overlapStart || '', lastOverlapEnd: item.overlapEnd || '', tasks: [] })
    const g = groups.get(gkey)!
    ;(g.tasks as unknown[]).push(item)
    g.taskCount = (g.taskCount as number) + 1
    g.stillInProgress = (g.stillInProgress as number) + (item.stillInProgress ? 1 : 0)
    g.durationHours = Math.round(((g.durationHours as number) + (item.durationHours as number)) * 10) / 10
    g.effortPoint = (g.effortPoint as number) + (item.effortPoint as number)
    if (item.overlapStart && (!g.firstOverlapStart || new Date(item.overlapStart as string) < new Date(g.firstOverlapStart as string))) g.firstOverlapStart = item.overlapStart
    if (item.overlapEnd && (!g.lastOverlapEnd || new Date(item.overlapEnd as string) > new Date(g.lastOverlapEnd as string))) g.lastOverlapEnd = item.overlapEnd
  }
  const pbiGroups = [...groups.values()].sort((a, b) => String(a.pbiTitle).localeCompare(String(b.pbiTitle)))

  const totalHours = Math.round(items.reduce((s, i) => s + (i.durationHours as number), 0) * 10) / 10
  const totalEffort = items.reduce((s, i) => s + (i.effortPoint as number), 0)
  const stats = { totalTasksScanned: taskItems.length, inProgressTasks: items.length, stillInProgress: items.filter((i) => i.stillInProgress).length, totalHours, avgHours: items.length ? Math.round(totalHours / items.length * 10) / 10 : 0, assignees: new Set(items.map((i) => i.taskAssignedTo).filter(Boolean)).size, totalEffort }

  const value = { generatedAt: new Date().toISOString(), team: t, sprintPath, range: { start: range.startIso, end: range.endIso, label: range.label }, items, pbiGroups, stats }
  cache.set(key, { at: Date.now(), value })
  return value
}

// Safe wrappers
const fallbackSprints = [{ id: 'fallback-sprint-9', name: 'Sprint 9 - Platform Squad', path: 'Product Delivery\\Sprint 9 - Platform Squad', timeFrame: 'current' }]

export async function safeListTeams(): Promise<string[]> {
  try { return await listTeams() } catch (e) { console.error(e); return [cfg().team] }
}
export async function safeListSprints(teamName?: string, projectName?: string) {
  try { return await listSprints(teamName, projectName) } catch (e) { console.error(e); return fallbackSprints }
}
export async function safeSprintData(sprintPath: string, teamName?: string) {
  try { return await getSprintData(sprintPath, teamName) } catch (e: unknown) {
    console.error(e)
    return { generatedAt: new Date().toISOString(), team: normalizeTeamName(teamName), sprintPath, pbis: [], stats: { pbiInSprint: 0, readyReleasePbis: 0, resolvedPbis: 0, reviewTasks: 0, releasePlanTasks: 0 }, warning: (e as Error).message }
  }
}
export async function safeSprintTimeline(sprintPath: string, teamName?: string) {
  try { return await getSprintTimeline(sprintPath, teamName) } catch (e: unknown) {
    console.error(e)
    return { generatedAt: new Date().toISOString(), team: normalizeTeamName(teamName), sprintPath, trackedStates: [...TRACKED], items: [], stats: { totalTasks: 0, tasksWithTimeline: 0, releasedTasks: 0, avgCycleDays: null }, warning: (e as Error).message }
  }
}
export async function safeLastWeekProgress(sprintPath: string, teamName?: string) {
  try { return await getLastWeekProgress(sprintPath, teamName) } catch (e: unknown) {
    console.error(e)
    const range = prevWeekRange()
    return { generatedAt: new Date().toISOString(), team: normalizeTeamName(teamName), sprintPath, range: { start: range.startIso, end: range.endIso, label: range.label }, items: [], pbiGroups: [], stats: { totalTasksScanned: 0, inProgressTasks: 0, stillInProgress: 0, totalHours: 0, avgHours: 0, assignees: 0 }, warning: (e as Error).message }
  }
}
