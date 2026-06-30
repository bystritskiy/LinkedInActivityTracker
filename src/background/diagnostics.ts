import type {
  DetectorKey,
  DetectorStatus,
  DiagnosticLevel,
  StorageRoot,
} from '../common/types'
import { MAX_DIAGNOSTICS } from '../common/constants'
import { newId } from '../common/ids'
import { localTimeZone, nowIso } from '../common/date'

export function pushDiagnostic(
  root: StorageRoot,
  level: DiagnosticLevel,
  source: string,
  code: string,
  message: string,
): void {
  root.diagnostics.unshift({ id: newId(), timestamp: nowIso(), level, source, code, message })
  if (root.diagnostics.length > MAX_DIAGNOSTICS) {
    root.diagnostics.length = MAX_DIAGNOSTICS
  }
}

export function setSelectorHealth(
  root: StorageRoot,
  detector: DetectorKey,
  status: DetectorStatus,
  note?: string,
): void {
  const now = nowIso()
  const prev = root.selectorHealth[detector] ?? { status: 'unknown' }
  root.selectorHealth[detector] = {
    ...prev,
    status,
    lastCheckedAt: now,
    note,
    ...(status === 'working' ? { lastConfirmedAt: now } : {}),
  }
}

function appVersion(): string {
  try {
    return chrome.runtime.getManifest().version
  } catch {
    return '0.0.0'
  }
}

/** A diagnostics-only export that deliberately contains no personal activity. */
export function buildDiagnosticsExport(root: StorageRoot): string {
  return JSON.stringify(
    {
      version: appVersion(),
      schemaVersion: root.schemaVersion,
      timezone: localTimeZone(),
      installedAt: root.installedAt,
      selectorHealth: root.selectorHealth,
      diagnostics: root.diagnostics,
    },
    null,
    2,
  )
}
