import toast from "react-hot-toast";
import { fetchLaundryPlacesInBounds } from "../lib/api";
import { poiToMapPoint } from "../lib/poi";
import { isAnyRoutingProviderReady } from "../lib/routingStatus";
import { useMapIsoStore } from "../store/useMapIsoStore";
import type { AppSettings, ApiCapabilities, RoutingProvider, ScenarioId } from "../types";
import { useIsochroneGenerator } from "./useIsochroneGenerator";

export function useScenarioLauncher() {
  const applyScenario = useMapIsoStore((state) => state.applyScenario);
  const addPoiLayer = useMapIsoStore((state) => state.addPoiLayer);
  const setGenerationError = useMapIsoStore((state) => state.setGenerationError);
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);
  const { generateIsochrones } = useIsochroneGenerator();

  const launchScenario = async (scenarioId: ScenarioId) => {
    if (!isAnyRoutingProviderReady(useMapIsoStore.getState().status)) {
      await refreshApiStatus();
    }

    applyScenario(scenarioId);

    if (scenarioId !== "laundromat-walkability") {
      return;
    }

    const { mapBounds } = useMapIsoStore.getState();

    if (!mapBounds) {
      const message = "Map view is still loading. Wait a moment, then try Laundry again.";
      setGenerationError(message);
      toast.error(message);
      return;
    }

    let result: Awaited<ReturnType<typeof fetchLaundryPlacesInBounds>>;

    try {
      result = await toast.promise(fetchLaundryPlacesInBounds(mapBounds), {
        loading: "Finding laundry places in this map view...",
        success: (data) =>
          data.points.length === 0
            ? "No laundry places found in this map view."
            : `Found ${data.points.length} laundry place${data.points.length === 1 ? "" : "s"} in this map view.`,
        error: (error) =>
          error instanceof Error ? error.message : "Laundry POI search failed.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Laundry POI search failed.";
      setGenerationError(message);
      return;
    }

    if (result.points.length === 0) {
      const message = "No laundry places found in this map view. Pan or zoom and try again.";
      setGenerationError(message);
      return;
    }

    const layerId = addPoiLayer({
      category: "laundry",
      query: "",
      label: "Laundry in view",
      source: result.source,
      points: result.points,
      message: result.message,
      truncated: result.truncated,
    });

    if (result.truncated && result.message) {
      toast(result.message);
    }

    const { settings, status } = useMapIsoStore.getState();
    const generationSettings = {
      ...settings,
      routingProvider: getReadyRoutingProvider(settings.routingProvider, status.apiCapabilities),
    };
    const points = result.points.map((point, index) =>
      poiToMapPoint(point, index, `layer-${layerId}`),
    );

    await generateIsochrones({ points, settings: generationSettings });
  };

  return { launchScenario };
}

function getReadyRoutingProvider(
  provider: RoutingProvider,
  capabilities: ApiCapabilities,
): AppSettings["routingProvider"] {
  if (provider === "ors" && !capabilities.openRouteService && capabilities.valhalla) {
    return "valhalla";
  }

  if (provider === "valhalla" && !capabilities.valhalla && capabilities.openRouteService) {
    return "ors";
  }

  return provider;
}
