let nextSessionId = 0;

/** Creates a browser-process-unique namespace for one devtools lifecycle. */
export function createDevtoolsSessionId(prefix = "session"): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${prefix}-${uuid}`;
  nextSessionId += 1;
  return `${prefix}-${Date.now().toString(36)}-${nextSessionId.toString(36)}`;
}
