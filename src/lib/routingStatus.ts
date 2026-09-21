import type { AppSettings, AppStatus, RoutingProvider } from "../types";

export function isRoutingProviderReady(status: AppStatus, provider: RoutingProvider) {
  if (provider === "synthetic") return status.apiCapabilities.synthetic === true;
  if (provider === "google") return status.apiCapabilities.google === true;
  return provider === "valhalla"
    ? status.apiCapabilities.valhalla
    : status.apiCapabilities.openRouteService;
}

export function isAnyRoutingProviderReady(status: AppStatus) {
  return Boolean(status.apiCapabilities.synthetic || status.apiCapabilities.google || status.apiCapabilities.openRouteService || status.apiCapabilities.valhalla);
}

export function isValhallaAccessReady(status: AppStatus, settings: AppSettings) {
  return (
    settings.routingProvider !== "valhalla" ||
    !status.apiCapabilities.valhallaRequiresSecret ||
    settings.valhallaAccessSecret.trim().length > 0
  );
}

export function getValhallaAccessRequiredMessage() {
  return "Enter Valhalla access secret.";
}

export function getRoutingSetupMessage(status: AppStatus) {
  if (status.apiCapabilities.synthetic) return "Mock isochrones — schematic reach, not network travel time.";
  if (isAnyRoutingProviderReady(status)) {
    return "Routing is online. Generate access heatmaps from the active provider.";
  }

  return "This public MapGap deploy is live, but heatmap generation needs a server-side routing provider. Configure OPENROUTE_SERVICE_API_KEY or a hosted VALHALLA_BASE_URL in Netlify.";
}

export function getRoutingProviderUnavailableMessage(provider: RoutingProvider) {
  if (provider === "synthetic") return "The synthetic provider is not enabled in this environment.";
  if (provider === "google") return "Live Google Isochrones is not enabled in this preview.";
  return provider === "valhalla"
    ? "Configure a hosted VALHALLA_BASE_URL in Netlify to enable Valhalla routing."
    : "Configure OPENROUTE_SERVICE_API_KEY in Netlify to enable ORS routing.";
}
