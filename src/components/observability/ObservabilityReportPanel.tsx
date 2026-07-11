import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  DollarSign,
  FileText,
  Route,
  Search,
} from "lucide-react";
import { isRoutingProviderReady, isValhallaAccessReady } from "../../lib/routingStatus";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Badge } from "../ui/badge";

type ObservabilityReportPanelProps = {
  compact?: boolean;
  className?: string;
};

type FlowState = "ready" | "watch" | "blocked";

const BILLING_PERIOD = "Jul 1, 2025 - Jul 31, 2026";

const PROJECT_BILLING = {
  name: "Niskayuna Atlas API",
  actualCost: 23.45,
  forecastCost: 0.04,
};

const SERVICE_COSTS = [
  {
    name: "Places API",
    detail: "New",
    actualCost: 17.76,
    forecastCost: 0,
    colorClass: "bg-sky-500",
  },
  {
    name: "Cloud Run",
    actualCost: 5.65,
    forecastCost: 0,
    colorClass: "bg-rose-500",
  },
  {
    name: "Artifact Registry",
    actualCost: 0.03,
    forecastCost: 0.06,
    colorClass: "bg-amber-500",
  },
  {
    name: "Cloud Build",
    actualCost: 0.01,
    forecastCost: 0.01,
    colorClass: "bg-emerald-500",
  },
];

const maxServiceCost = Math.max(...SERVICE_COSTS.map((service) => service.actualCost));

export function ObservabilityReportPanel({
  compact = false,
  className,
}: ObservabilityReportPanelProps) {
  const points = useMapIsoStore((state) => state.points);
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const candidateHomes = useMapIsoStore((state) => state.candidateHomes);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);

  const routingReady =
    isRoutingProviderReady(status, settings.routingProvider) &&
    isValhallaAccessReady(status, settings);
  const appHasRunData =
    points.length > 0 || poiLayers.length > 0 || isochrones.length > 0 || candidateHomes.length > 0;
  const apiProxyState = getApiProxyFlowState(status.apiStatus);
  const routingState: FlowState = routingReady
    ? "ready"
    : status.apiStatus === "error"
      ? "blocked"
      : "watch";
  const reportingState: FlowState = appHasRunData ? "ready" : "watch";

  const flowRows = [
    {
      label: "Search to layer",
      compactLabel: "Search",
      path: "Ask -> Place search -> Places API -> POI layer",
      compactPath: "Ask -> Places -> layer",
      driver: "Places API",
      state: apiProxyState,
      icon: Search,
    },
    {
      label: "Access heatmap",
      compactLabel: "Heatmap",
      path: "Point set -> Routing proxy -> provider -> contours",
      compactPath: "Points -> routing -> contours",
      driver: settings.routingProvider === "valhalla" ? "Cloud Run" : "Routing API",
      state: routingState,
      icon: Route,
    },
    {
      label: "Decision report",
      compactLabel: "Report",
      path: "Run data -> scoring -> memo/export",
      compactPath: "Run data -> memo/export",
      driver: "Browser export",
      state: reportingState,
      icon: FileText,
    },
  ];

  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950",
        compact ? "space-y-3" : "space-y-4",
        className,
      )}
      aria-label="Observability and billing"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
            <Activity className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            Observability
          </h2>
          {!compact && (
            <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
              Billing snapshot and transaction flow health.
            </p>
          )}
        </div>
        <Badge variant={routingReady ? "success" : "warning"} className="shrink-0">
          {routingReady ? "live" : "watch"}
        </Badge>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
              <DollarSign className="h-3.5 w-3.5" aria-hidden="true" />
              Billing
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-neutral-950 dark:text-white">
              {PROJECT_BILLING.name}
            </div>
            <div className="mt-0.5 text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
              {BILLING_PERIOD}
            </div>
            {compact && (
              <div className="mt-1 truncate text-[11px] font-medium leading-4 text-neutral-500 dark:text-neutral-400">
                {points.length} pt / {poiLayers.length} layers / {isochrones.length} rings
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-semibold leading-none text-neutral-950 dark:text-white">
              {formatCurrency(PROJECT_BILLING.actualCost)}
            </div>
            <div className="mt-1 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
              +{formatCurrency(PROJECT_BILLING.forecastCost)} forecast
            </div>
          </div>
        </div>

        {!compact && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Points" value={points.length} />
            <Metric label="Layers" value={poiLayers.length} />
            <Metric label="Rings" value={isochrones.length} />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            Services and APIs
          </h3>
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Actual / forecast
          </span>
        </div>
        <div className="grid gap-2">
          {SERVICE_COSTS.map((service) => (
            <ServiceCostRow key={service.name} service={service} compact={compact} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
          User journey flows
        </h3>
        <div className={compact ? "grid grid-cols-3 gap-2" : "grid gap-2"}>
          {flowRows.map((flow) =>
            compact ? (
              <CompactFlowChip key={flow.label} flow={flow} />
            ) : (
              <FlowRow key={flow.label} flow={flow} />
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-white px-2 py-1.5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="truncate text-[10px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function ServiceCostRow({
  service,
  compact = false,
}: {
  service: (typeof SERVICE_COSTS)[number];
  compact?: boolean;
}) {
  const width = Math.max(3, Math.round((service.actualCost / maxServiceCost) * 100));

  return (
    <div
      className={cn(
        "grid rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-xs dark:border-neutral-800 dark:bg-neutral-900/60",
        compact ? "gap-1 py-1.5" : "gap-1.5 py-2",
      )}
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn("h-2.5 w-2.5 shrink-0 rounded-full", service.colorClass)}
            aria-hidden="true"
          />
          <span className="truncate font-medium text-neutral-800 dark:text-neutral-100">
            {service.name}
            {service.detail ? ` (${service.detail})` : ""}
          </span>
        </div>
        <div className="shrink-0 text-right font-semibold text-neutral-950 dark:text-white">
          {formatCurrency(service.actualCost)}
          <span className="ml-2 font-medium text-neutral-500 dark:text-neutral-400">
            {formatForecast(service.forecastCost)}
          </span>
        </div>
      </div>
      {!compact && (
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div
            className={cn("h-full rounded-full", service.colorClass)}
            style={{ width: `${width}%` }}
          />
        </div>
      )}
    </div>
  );
}

function FlowRow({
  flow,
  compact = false,
}: {
  flow: {
    label: string;
    compactLabel: string;
    path: string;
    compactPath: string;
    driver: string;
    state: FlowState;
    icon: typeof Search;
  };
  compact?: boolean;
}) {
  const Icon = flow.icon;
  const path = compact ? flow.compactPath : flow.path;

  return (
    <div
      className={cn(
        "grid rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 dark:border-neutral-800 dark:bg-neutral-900/60",
        compact ? "gap-1.5" : "gap-2",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <span
            className={cn(
              "grid shrink-0 place-items-center rounded-md bg-white text-emerald-600 dark:bg-neutral-950 dark:text-emerald-300",
              compact ? "h-7 w-7" : "h-8 w-8",
            )}
          >
            <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
              {flow.label}
            </div>
            <div className="mt-0.5 truncate text-xs leading-4 text-neutral-500 dark:text-neutral-400">
              {path}
            </div>
          </div>
        </div>
        <FlowStateBadge state={flow.state} />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-neutral-200 pt-2 text-[11px] dark:border-neutral-800">
        <span className="truncate text-neutral-500 dark:text-neutral-400">Cost driver</span>
        <span className="truncate font-medium text-neutral-700 dark:text-neutral-200">
          {flow.driver}
        </span>
      </div>
    </div>
  );
}

function CompactFlowChip({
  flow,
}: {
  flow: {
    compactLabel: string;
    state: FlowState;
    icon: typeof Search;
  };
}) {
  const Icon = flow.icon;
  const stateClasses = getFlowStateClasses(flow.state);

  return (
    <div className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
        <span className={cn("h-2 w-2 shrink-0 rounded-full", stateClasses.dot)} aria-hidden="true" />
      </div>
      <div className="mt-1 truncate text-[11px] font-semibold leading-4 text-neutral-950 dark:text-white">
        {flow.compactLabel}
      </div>
      <div className={cn("truncate text-[10px] font-medium leading-4", stateClasses.text)}>
        {stateLabel(flow.state)}
      </div>
    </div>
  );
}

function FlowStateBadge({ state }: { state: FlowState }) {
  if (state === "ready") {
    return (
      <Badge variant="success" className="shrink-0 gap-1">
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        ready
      </Badge>
    );
  }

  if (state === "blocked") {
    return (
      <Badge variant="danger" className="shrink-0 gap-1">
        <CircleAlert className="h-3 w-3" aria-hidden="true" />
        blocked
      </Badge>
    );
  }

  return (
    <Badge variant="warning" className="shrink-0 gap-1">
      <CircleAlert className="h-3 w-3" aria-hidden="true" />
      watch
    </Badge>
  );
}

function getApiProxyFlowState(apiStatus: string): FlowState {
  if (apiStatus === "ready" || apiStatus === "degraded") {
    return "ready";
  }

  if (apiStatus === "error") {
    return "blocked";
  }

  return "watch";
}

function getFlowStateClasses(state: FlowState) {
  if (state === "ready") {
    return {
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-300",
    };
  }

  if (state === "blocked") {
    return {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-300",
    };
  }

  return {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  };
}

function stateLabel(state: FlowState) {
  return state === "ready" ? "ready" : state === "blocked" ? "blocked" : "watch";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: value < 1 ? 2 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatForecast(value: number) {
  return value === 0 ? "$0.00" : `+${formatCurrency(value)}`;
}
