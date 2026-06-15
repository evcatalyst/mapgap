import toast from "react-hot-toast";
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
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);
  const status = useMapIsoStore((state) => state.status);

  const generateIsochrones = async () => {
    if (points.length === 0) {
      toast.error("Add at least one point before generating isochrones.");
      return;
    }

    if (!status.apiCapabilities.openRouteService) {
      const message =
        "OpenRouteService proxy is not configured. Add OPENROUTE_SERVICE_API_KEY in Netlify.";
      setGenerationError(message);
      refreshApiStatus();
      toast.error(message);
      return;
    }

    setGeneratingIsochrones(true);
    setGenerationError(undefined);

    try {
      const result = await toast.promise(fetchIsochrones(points, settings), {
        loading: "Calculating MapGap access heat...",
        success: `Generated ${resultLabel(points.length, settings.timeBuckets.length)}.`,
        error: (error) =>
          error instanceof Error ? error.message : "Isochrone generation failed.",
      });

      setIsochrones(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Isochrone generation failed.";
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
