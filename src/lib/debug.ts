export function debugLog(message: string, data?: unknown) {
  if (import.meta.env.DEV) {
    if (data === undefined) {
      console.debug(`[MapGap] ${message}`);
      return;
    }

    console.debug(`[MapGap] ${message}`, data);
  }
}

export function debugError(message: string, error: unknown) {
  console.error(`[MapGap] ${message}`, error);
}
