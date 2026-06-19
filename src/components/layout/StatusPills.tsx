import { Activity, Clock, Database, MapPin, Route, Server } from "lucide-react";
import { ROUTING_PROVIDER_LABELS, TRANSPORT_LABELS } from "../../constants";
import { isRoutingProviderReady } from "../../lib/routingStatus";
import { formatRelativeTimestamp } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Badge } from "../ui/badge";

export function StatusPills() {
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);

  const apiVariant =
    status.apiStatus === "ready" ? "success" : status.apiStatus === "error" ? "danger" : "warning";
  const providerReady = isRoutingProviderReady(status, settings.routingProvider);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Badge variant="outline" className="gap-1">
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        {points.length} points
      </Badge>
      <Badge variant="outline" className="gap-1">
        <Route className="h-3.5 w-3.5" aria-hidden="true" />
        {isochrones.length} rings
      </Badge>
      <Badge variant="outline" className="gap-1">
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        {TRANSPORT_LABELS[settings.transportMode]}
      </Badge>
      <Badge variant={providerReady ? "success" : "warning"} className="gap-1">
        <Server className="h-3.5 w-3.5" aria-hidden="true" />
        {ROUTING_PROVIDER_LABELS[settings.routingProvider]}
      </Badge>
      <Badge variant={apiVariant} className="gap-1">
        <Database className="h-3.5 w-3.5" aria-hidden="true" />
        API {status.apiStatus}
      </Badge>
      <Badge variant="outline" className="gap-1">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Generated {formatRelativeTimestamp(status.lastGeneratedAt)}
      </Badge>
    </div>
  );
}
