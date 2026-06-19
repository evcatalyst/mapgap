import toast from "react-hot-toast";
import { ROUTING_PROVIDER_LABELS } from "../constants";
import { fetchIsochrones } from "../lib/api";
import { debugError } from "../lib/debug";
import { useMapIsoStore } from "../store/useMapIsoStore";

export function useIsochroneGenerator() {
  const points = useMapIsoStore((state) => state.points);
  const settings = useMapIsoStore((state) => state.settings);
  const setIsochrones = useMapIsoStore((state) => state.setIsochrones);
  const isGeneratingIsochrones = useMapIsoStore((state) => state.isGeneratingIsochrones);
  const setGeneratingIsochrones = useMapIsoStore((state) => state.setGeneratingIsochrones);
  const setGenerationError = useMapIsoStore((state) => state.setGenerationError);
  const setRoutingProvider = useMapIsoStore((state) => state.setRoutingProvider);
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);
  const status = useMapIsoStore((state) => state.status);

  const generateIsochrones = async () => {
    if (points.length === 0) {
      toast.error("Add at least one point before generating isochrones.");
      return;
    }

    const routingAvailable =
      settings.routingProvider === "valhalla"
        ? status.apiCapabilities.valhalla
        : status.apiCapabilities.openRouteService;
    const providerLabel = ROUTING_PROVIDER_LABELS[settings.routingProvider];

    if (!routingAvailable) {
      const message =
        settings.routingProvider === "valhalla"
          ? "Valhalla is not available. Start local Valhalla and set VALHALLA_BASE_URL, or switch back to ORS."
          : "OpenRouteService proxy is not configured. Add OPENROUTE_SERVICE_API_KEY in Netlify.";
      setGenerationError(message);
      refreshApiStatus();
      toast.error(message);
      return;
    }

    setGeneratingIsochrones(true);
    setGenerationError(undefined);

    try {
      const result = await toast.promise(fetchIsochrones(points, settings), {
        loading: `Calculating MapGap access heat with ${providerLabel}...`,
        success: `Generated ${resultLabel(points.length, settings.timeBuckets.length)} with ${providerLabel}.`,
        error: (error) =>
          error instanceof Error ? error.message : "Isochrone generation failed.",
      });

      setIsochrones(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Isochrone generation failed.";

      if (
        settings.routingProvider === "ors" &&
        status.apiCapabilities.valhalla &&
        isProviderAccessDenied(message)
      ) {
        const fallbackSettings = {
          ...settings,
          routingProvider: "valhalla" as const,
        };

        setRoutingProvider("valhalla");
        setGenerationError(undefined);

        try {
          const result = await toast.promise(fetchIsochrones(points, fallbackSettings), {
            loading: "ORS denied isochrone access. Retrying with Valhalla beta...",
            success: `Generated ${resultLabel(points.length, settings.timeBuckets.length)} with Valhalla beta.`,
            error: (fallbackError) =>
              fallbackError instanceof Error
                ? fallbackError.message
                : "Valhalla fallback failed.",
          });

          setIsochrones(result);
          return;
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error ? fallbackError.message : "Valhalla fallback failed.";
          setGenerationError(fallbackMessage);
          debugError("Valhalla fallback generation failed", fallbackError);
          return;
        }
      }

      setGenerationError(message);
      debugError("Isochrone generation failed", error);
    } finally {
      setGeneratingIsochrones(false);
      refreshApiStatus();
    }
  };

  return {
    generateIsochrones,
    isGeneratingIsochrones,
  };
}

function resultLabel(pointCount: number, bucketCount: number) {
  const ringCount = pointCount * Math.max(1, bucketCount);
  return `${ringCount} effort-adjusted ring${ringCount === 1 ? "" : "s"}`;
}

function isProviderAccessDenied(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("access to this api has been disallowed") ||
    normalized.includes("denied this isochrone request") ||
    normalized.includes(" 403:")
  );
}
