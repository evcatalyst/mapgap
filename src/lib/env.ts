import type { ApiCapabilities, ApiStatus } from "../types";

export type ApiHealth = {
  status: ApiStatus;
  message: string;
  capabilities: ApiCapabilities;
};

const DEFAULT_CAPABILITIES: ApiCapabilities = {
  openRouteService: false,
  openCage: false,
};

function normalizeApiStatus(value: unknown, capabilities: ApiCapabilities): ApiStatus {
  if (value === "ready" || value === "degraded" || value === "error" || value === "unknown") {
    return value;
  }

  return capabilities.openRouteService && capabilities.openCage ? "ready" : "degraded";
}

export function getInitialApiHealth(): ApiHealth {
  return {
    status: "unknown",
    message: "Checking MapGap API proxy...",
    capabilities: DEFAULT_CAPABILITIES,
  };
}

export async function fetchApiHealth(): Promise<ApiHealth> {
  const response = await fetch("/api/health", {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`MapGap API health check failed with status ${response.status}.`);
  }

  const data = (await response.json()) as {
    status?: unknown;
    message?: unknown;
    openRouteService?: unknown;
    openCage?: unknown;
  };

  const capabilities = {
    openRouteService: Boolean(data.openRouteService),
    openCage: Boolean(data.openCage),
  };

  return {
    status: normalizeApiStatus(data.status, capabilities),
    message:
      typeof data.message === "string"
        ? data.message
        : "MapGap API proxy responded without a status message.",
    capabilities,
  };
}

export function getUnavailableApiHealth(): ApiHealth {
  return {
    status: "degraded",
    message:
      "MapGap API proxy is unavailable. Use Netlify Dev locally or configure Netlify Functions in production.",
    capabilities: DEFAULT_CAPABILITIES,
  };
}
