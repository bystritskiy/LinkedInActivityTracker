import type { LocaleCode, TrackedEventType } from '../types'
import { en, type MessageKey } from './en'
import { ru } from './ru'

export type { MessageKey }

const dictionaries: Record<LocaleCode, Record<MessageKey, string>> = { en, ru }

/**
 * Translate a key for a locale, with optional `{placeholder}` interpolation.
 * Falls back to English, then to the raw key.
 */
export function t(
  locale: LocaleCode,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const dict = dictionaries[locale] ?? en
  let str = dict[key] ?? en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v))
    }
  }
  return str
}

/** Build a translator bound to a locale. */
export function translator(locale: LocaleCode) {
  return (key: MessageKey, params?: Record<string, string | number>) =>
    t(locale, key, params)
}

/** The i18n key for an event type's plural display label. */
export function eventLabelKey(type: TrackedEventType): MessageKey {
  return `events.${type}` as MessageKey
}
