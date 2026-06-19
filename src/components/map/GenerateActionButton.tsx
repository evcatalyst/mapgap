import { Sparkles } from "lucide-react";
import { MOBILITY_MODES } from "../../constants";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import {
  getValhallaAccessRequiredMessage,
  isValhallaAccessReady,
} from "../../lib/routingStatus";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { LoadingSpinner } from "../LoadingSpinner";
import { Button } from "../ui/button";

type GenerateActionButtonProps = {
  className?: string;
  label?: "short" | "full";
};

export function GenerateActionButton({
  className,
  label = "short",
}: GenerateActionButtonProps) {
  const points = useMapIsoStore((state) => state.points);
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);
  const setSidebarOpen = useMapIsoStore((state) => state.setSidebarOpen);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();
  const selectedMode = MOBILITY_MODES[settings.mobilityMode];
  const routingReady =
    settings.routingProvider === "valhalla"
      ? status.apiCapabilities.valhalla
      : status.apiCapabilities.openRouteService;
  const valhallaAccessReady = isValhallaAccessReady(status, settings);
  const needsValhallaAccess = routingReady && !valhallaAccessReady;
  const disabled = isGeneratingIsochrones || points.length === 0 || !routingReady;
  const canGenerate = !disabled && !needsValhallaAccess;

  const handleClick = () => {
    if (needsValhallaAccess) {
      setSidebarOpen(true);
      return;
    }

    generateIsochrones();
  };

  const actionLabel =
    !routingReady
      ? "Routing API required"
      : needsValhallaAccess
        ? getValhallaAccessRequiredMessage()
        : label === "full"
          ? "Generate access heatmap"
          : "Generate";

  return (
    <Button
      type="button"
      variant={canGenerate ? "primary" : "secondary"}
      className={cn("min-h-12 shadow-soft", className)}
      style={canGenerate ? { backgroundColor: selectedMode.color } : undefined}
      onClick={handleClick}
      disabled={disabled}
      aria-label={
        needsValhallaAccess
          ? "Open Valhalla access secret controls to generate isochrones"
          : "Generate effort-adjusted isochrones"
      }
    >
      {isGeneratingIsochrones ? (
        <LoadingSpinner label="Finding gaps" />
      ) : (
        <>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {actionLabel}
        </>
      )}
    </Button>
  );
}
