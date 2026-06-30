import { STORAGE_KEY } from '../common/constants'
import type { ExportResult, Message } from '../common/messages'
import type { StorageRoot } from '../common/types'

export async function sendMessage<T = unknown>(message: Message): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>
}

export async function loadState(): Promise<StorageRoot> {
  return sendMessage<StorageRoot>({ kind: 'getState' })
}

export function subscribeState(onState: (root: StorageRoot) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: chrome.storage.AreaName,
  ) => {
    if (areaName !== 'local') return
    const change = changes[STORAGE_KEY]
    if (!change?.newValue) return
    onState(change.newValue as StorageRoot)
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}

export function downloadText(filename: string, mime: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportAndDownload(
  format: 'markdown' | 'json' | 'csv',
  dayKey?: string,
): Promise<void> {
  const result = await sendMessage<ExportResult>({ kind: 'export', format, dayKey })
  if (!result.ok || !result.filename || !result.mime || result.content === undefined) {
    throw new Error(result.error ?? 'export_failed')
  }
  downloadText(result.filename, result.mime, result.content)
}

export function openDashboard(): void {
  chrome.runtime.openOptionsPage()
}
