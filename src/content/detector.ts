import type { DetectorKey, LinkedInPageType } from '../common/types'

export interface DetectionContext {
  pageType: LinkedInPageType
  /** Sanitized URL (origin + pathname). */
  url?: string
}

/**
 * A detector observes one category of user action. It is attached once at
 * startup; on SPA navigation it gets an `onNavigate` callback so it can reset
 * any per-page state (e.g. scoped observers) without re-binding global
 * listeners (which would risk duplicate handlers).
 */
export interface LinkedInDetector {
  readonly key: DetectorKey
  attach(ctx: DetectionContext): void
  detach(): void
  onNavigate?(ctx: DetectionContext): void
}

/**
 * Owns the detector lifecycle and wires SPA navigation. Decoupled from the
 * concrete navigation/context implementations (injected) so it is unit-testable.
 */
export class DetectorManager {
  private readonly detectors: LinkedInDetector[] = []
  private stopNav?: () => void
  private started = false

  constructor(
    private readonly refreshContext: () => DetectionContext,
    private readonly watchNavigation: (cb: () => void) => () => void,
  ) {}

  register(detector: LinkedInDetector): this {
    this.detectors.push(detector)
    return this
  }

  start(): void {
    if (this.started) return
    this.started = true
    const ctx = this.refreshContext()
    for (const d of this.detectors) {
      try {
        d.attach(ctx)
      } catch {
        // A misbehaving detector must not break the others.
      }
    }
    this.stopNav = this.watchNavigation(() => this.handleNavigate())
  }

  private handleNavigate(): void {
    const ctx = this.refreshContext()
    for (const d of this.detectors) {
      try {
        d.onNavigate?.(ctx)
      } catch {
        // ignore
      }
    }
  }

  stop(): void {
    this.stopNav?.()
    for (const d of this.detectors) {
      try {
        d.detach()
      } catch {
        // ignore
      }
    }
    this.started = false
  }
}
