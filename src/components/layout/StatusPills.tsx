import { Activity, Clock, Database, MapPin, Route, Server } from "lucide-react";
import { ROUTING_PROVIDER_LABELS, TRANSPORT_LABELS } from "../../constants";
import { isRoutingProviderReady } from "../../lib/routingStatus";
import { formatRelativeTimestamp } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

type StatusPillsProps = {
  compact?: boolean;
  className?: string;
};

export function StatusPills({ compact = false, className }: StatusPillsProps) {
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);

  const apiVariant =
    status.apiStatus === "ready" ? "success" : status.apiStatus === "error" ? "danger" : "warning";
  const providerReady = isRoutingProviderReady(status, settings.routingProvider);
  const pillClass = compact ? "h-7 gap-1 px-2 text-[11px]" : "gap-1";
  const iconClass = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const ringLabel = `${isochrones.length} ${isochrones.length === 1 ? "ring" : "rings"}`;

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1.5", className)}>
      <Badge variant="outline" className={pillClass}>
        <MapPin className={iconClass} aria-hidden="true" />
        {compact ? `${points.length} pt` : `${points.length} points`}
      </Badge>
      <Badge variant="outline" className={pillClass}>
        <Route className={iconClass} aria-hidden="true" />
        {ringLabel}
      </Badge>
      <Badge variant="outline" className={cn(pillClass, compact && "hidden sm:inline-flex")}>
        <Activity className={iconClass} aria-hidden="true" />
        {TRANSPORT_LABELS[settings.transportMode]}
      </Badge>
      <Badge
        variant={providerReady ? "success" : "warning"}
        className={cn(pillClass, compact && "hidden md:inline-flex")}
      >
        <Server className={iconClass} aria-hidden="true" />
        {ROUTING_PROVIDER_LABELS[settings.routingProvider]}
      </Badge>
      <Badge variant={apiVariant} className={cn(pillClass, compact && "hidden lg:inline-flex")}>
        <Database className={iconClass} aria-hidden="true" />
        API {status.apiStatus}
      </Badge>
      <Badge variant="outline" className={cn(pillClass, compact && "hidden xl:inline-flex")}>
        <Clock className={iconClass} aria-hidden="true" />
        Generated {formatRelativeTimestamp(status.lastGeneratedAt)}
      </Badge>
    </div>
  );
}
