export interface Extracted {
  repository_id: number
  repo: string
  number: number
  type: 'issue' | 'pull_request'
  event_type: string
  action: string
  url: string | null
}

const ISSUE_EVENTS = new Set(['issues', 'issue_comment'])
const PR_EVENTS = new Set([
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
  'pull_request_review_thread',
])

export const SUPPORTED_EVENTS = new Set([...ISSUE_EVENTS, ...PR_EVENTS])

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null
}

function actionUrl(payload: Record<string, unknown>): string | null {
  for (const key of ['comment', 'review', 'pull_request', 'issue']) {
    const html = str(obj(payload[key])?.html_url)
    if (html) return html
  }
  return null
}

export function extract(eventType: string, payload: Record<string, unknown>): Extracted | null {
  const action = str(payload.action)
  const repo = obj(payload.repository)
  const repository_id = int(repo?.id)
  const repoFullName = str(repo?.full_name)
  if (!action || repository_id === null || repoFullName === null) return null

  let number: number | null
  let type: 'issue' | 'pull_request'
  if (ISSUE_EVENTS.has(eventType)) {
    const issue = obj(payload.issue)
    number = int(issue?.number)
    type = issue?.pull_request != null ? 'pull_request' : 'issue'
  } else if (PR_EVENTS.has(eventType)) {
    const pr = obj(payload.pull_request)
    number = int(pr?.number) ?? int(payload.number)
    type = 'pull_request'
  } else {
    return null
  }
  if (number === null) return null

  return { repository_id, repo: repoFullName, number, type, event_type: eventType, action, url: actionUrl(payload) }
}
