import toast from "react-hot-toast";
import { useEffect, useRef } from "react";
import { ROUTING_PROVIDER_LABELS } from "../constants";
import { fetchIsochrones } from "../lib/api";
import { debugError } from "../lib/debug";
import {
  getValhallaAccessRequiredMessage,
  getRoutingProviderUnavailableMessage,
  isValhallaAccessReady,
  isRoutingProviderReady,
} from "../lib/routingStatus";
import { useMapIsoStore } from "../store/useMapIsoStore";
import type { AppSettings, MapPoint } from "../types";

type GenerateIsochronesOptions = {
  points?: MapPoint[];
  quiet?: boolean;
  settings?: AppSettings;
};

let activeController: AbortController | undefined;
export function cancelIsochroneGeneration() {
  activeController?.abort();
  activeController = undefined;
  useMapIsoStore.getState().setGeneratingIsochrones(false);
}

export function useIsochroneGenerator() {
  const ownedController = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => {
    if (ownedController.current && activeController === ownedController.current) cancelIsochroneGeneration();
  }, []);
  const points = useMapIsoStore((state) => state.points);
  const settings = useMapIsoStore((state) => state.settings);
  const setIsochrones = useMapIsoStore((state) => state.setIsochrones);
  const isGeneratingIsochrones = useMapIsoStore((state) => state.isGeneratingIsochrones);
  const setGeneratingIsochrones = useMapIsoStore((state) => state.setGeneratingIsochrones);
  const setGenerationError = useMapIsoStore((state) => state.setGenerationError);
  const setRoutingProvider = useMapIsoStore((state) => state.setRoutingProvider);
  const refreshApiStatus = useMapIsoStore((state) => state.refreshApiStatus);

  const generateIsochrones = async (options: GenerateIsochronesOptions = {}) => {
    cancelIsochroneGeneration();
    const controller = new AbortController();
    activeController = controller;
    ownedController.current = controller;
    const targetPoints = options.points || points;
    const targetSettings = options.settings || settings;
    const targetStatus = useMapIsoStore.getState().status;

    if (targetPoints.length === 0) {
      if (!options.quiet) {
        toast.error("Add at least one point before generating isochrones.");
      }
      return;
    }

    const routingAvailable = isRoutingProviderReady(targetStatus, targetSettings.routingProvider);
    const providerLabel = ROUTING_PROVIDER_LABELS[targetSettings.routingProvider];

    if (!routingAvailable) {
      const message = getRoutingProviderUnavailableMessage(targetSettings.routingProvider);
      setGenerationError(message);
      refreshApiStatus();
      if (!options.quiet) {
        toast.error(message);
      }
      return;
    }

    if (!isValhallaAccessReady(targetStatus, targetSettings)) {
      const message = getValhallaAccessRequiredMessage();
      setGenerationError(message);
      if (!options.quiet) {
        toast.error(message);
      }
      return;
    }

    setGeneratingIsochrones(true);
    setGenerationError(undefined);
    useMapIsoStore.getState().setGenerationSummary(undefined);
    useMapIsoStore.getState().clearIsochrones();

    try {
      const result = options.quiet
        ? await fetchIsochrones(targetPoints, targetSettings, controller.signal)
        : await toast.promise(fetchIsochrones(targetPoints, targetSettings, controller.signal), {
            loading: `Calculating MapGap access heat with ${providerLabel}...`,
            success: (result) => `Generated ${result.completedCount} contours with ${providerLabel}.${result.warnings.length ? " Some results are unavailable." : ""}`,
            error: (error) =>
              error instanceof Error ? error.message : "Isochrone generation failed.",
          });

      if (controller.signal.aborted || activeController !== controller) return;
      setIsochrones(result.features);
      useMapIsoStore.getState().setGenerationSummary(result);
    } catch (error) {
      if (controller.signal.aborted || activeController !== controller) return;
      const message = error instanceof Error ? error.message : "Isochrone generation failed.";

      if (
        targetSettings.routingProvider === "ors" &&
        targetStatus.apiCapabilities.valhalla &&
        isProviderAccessDenied(message)
      ) {
        const fallbackSettings = {
          ...targetSettings,
          routingProvider: "valhalla" as const,
        };

        if (!isValhallaAccessReady(targetStatus, fallbackSettings)) {
          setGenerationError(message);
          debugError("Isochrone generation failed", error);
          return;
        }

        setRoutingProvider("valhalla");
        setGenerationError(undefined);

        try {
          const result = options.quiet
            ? await fetchIsochrones(targetPoints, fallbackSettings, controller.signal)
            : await toast.promise(fetchIsochrones(targetPoints, fallbackSettings, controller.signal), {
                loading: "ORS denied isochrone access. Retrying with Valhalla beta...",
                success: (result) => `Generated ${result.completedCount} contours with Valhalla beta.${result.warnings.length ? " Some results are unavailable." : ""}`,
                error: (fallbackError) =>
                  fallbackError instanceof Error
                    ? fallbackError.message
                    : "Valhalla fallback failed.",
              });

          if (controller.signal.aborted || activeController !== controller) return;
          setIsochrones(result.features);
          useMapIsoStore.getState().setGenerationSummary(result);
          return;
        } catch (fallbackError) {
          if (controller.signal.aborted || activeController !== controller) return;
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
      if (activeController === controller) {
        activeController = undefined;
        setGeneratingIsochrones(false);
        refreshApiStatus();
      }
    }
  };

  return {
    generateIsochrones,
    cancelGeneration: cancelIsochroneGeneration,
    isGeneratingIsochrones,
  };
}

function isProviderAccessDenied(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("access to this api has been disallowed") ||
    normalized.includes("denied this isochrone request") ||
    normalized.includes(" 403:")
  );
}
