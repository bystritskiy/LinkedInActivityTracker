/** Generate a unique id. Available in content, worker, and page contexts. */
export function newId(): string {
  // crypto.randomUUID is available in MV3 service workers, content scripts,
  // and modern page contexts.
  return crypto.randomUUID()
}
