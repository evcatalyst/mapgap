import type { AppStatus, RoutingProvider } from "../types";

export function isRoutingProviderReady(status: AppStatus, provider: RoutingProvider) {
  return provider === "valhalla"
    ? status.apiCapabilities.valhalla
    : status.apiCapabilities.openRouteService;
}

export function isAnyRoutingProviderReady(status: AppStatus) {
  return status.apiCapabilities.openRouteService || status.apiCapabilities.valhalla;
}

export function getRoutingSetupMessage(status: AppStatus) {
  if (isAnyRoutingProviderReady(status)) {
    return "Routing is online. Generate access heatmaps from the active provider.";
  }

  return "This public MapGap deploy is live, but heatmap generation needs a server-side routing provider. Configure OPENROUTE_SERVICE_API_KEY or a hosted VALHALLA_BASE_URL in Netlify.";
}

export function getRoutingProviderUnavailableMessage(provider: RoutingProvider) {
  return provider === "valhalla"
    ? "Configure a hosted VALHALLA_BASE_URL in Netlify to enable Valhalla routing."
    : "Configure OPENROUTE_SERVICE_API_KEY in Netlify to enable ORS routing.";
}
