import type { ExportFormat } from '../common/messages'
import type { StorageRoot } from '../common/types'
import { summarizeStats, type DaySummary } from '../common/summary'
import { dayKeyFromDate } from '../common/date'

export interface BuiltExport {
  format: ExportFormat
  filename: string
  mime: string
  content: string
}

function sortedSummaries(root: StorageRoot): DaySummary[] {
  return Object.keys(root.days)
    .sort()
    .map((k) => summarizeStats(root.days[k].stats))
}

// Markdown: a single day's report (spec §15). Labels are intentionally English
// and locale-independent so exports are portable.
function buildMarkdown(root: StorageRoot, dayKey: string): string {
  const day = root.days[dayKey]
  const s = day
    ? summarizeStats(day.stats)
    : ({
        dayKey,
        activeSeconds: 0,
        activeMinutes: 0,
        reactions: 0,
        comments: 0,
        connectionRequests: 0,
        messages: 0,
        reposts: 0,
        posts: 0,
        follows: 0,
      } as DaySummary)
  const lines = [
    `# LinkedIn Challenge — ${dayKey}`,
    '',
    `- Active time: ${s.activeMinutes} min`,
    `- Reactions: ${s.reactions}`,
    `- Comments: ${s.comments}`,
    `- Invitations sent: ${s.connectionRequests}`,
    `- Messages: ${s.messages}`,
    `- Reposts: ${s.reposts}`,
    `- Posts: ${s.posts}`,
    `- SSI: ${s.ssi ?? '—'}`,
    '',
    '## Notes',
    '',
    '',
  ]
  return lines.join('\n')
}

function csvField(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// CSV: one row per day (spec §15).
function buildCsv(root: StorageRoot): string {
  const header = [
    'Date',
    'ActiveMinutes',
    'Reactions',
    'Comments',
    'Invitations',
    'Messages',
    'Reposts',
    'Posts',
    'SSI',
  ]
  const rows = sortedSummaries(root).map((s) =>
    [
      s.dayKey,
      s.activeMinutes,
      s.reactions,
      s.comments,
      s.connectionRequests,
      s.messages,
      s.reposts,
      s.posts,
      s.ssi,
    ]
      .map(csvField)
      .join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

// JSON: a full backup of the entire store (spec §15, §16).
function buildJson(root: StorageRoot): string {
  return JSON.stringify(root, null, 2)
}

export function buildExport(
  root: StorageRoot,
  format: ExportFormat,
  dayKey: string = dayKeyFromDate(new Date()),
): BuiltExport {
  switch (format) {
    case 'markdown':
      return {
        format,
        filename: `linkedin-challenge-${dayKey}.md`,
        mime: 'text/markdown',
        content: buildMarkdown(root, dayKey),
      }
    case 'csv':
      return {
        format,
        filename: `linkedin-activity-${dayKeyFromDate(new Date())}.csv`,
        mime: 'text/csv',
        content: buildCsv(root),
      }
    case 'json':
      return {
        format,
        filename: `linkedin-activity-backup-${dayKeyFromDate(new Date())}.json`,
        mime: 'application/json',
        content: buildJson(root),
      }
  }
}
