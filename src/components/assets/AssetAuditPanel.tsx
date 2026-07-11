import { Building2, Database, Route } from "lucide-react";
import toast from "react-hot-toast";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { cn } from "../../lib/utils";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

type AssetAuditPanelProps = {
  compact?: boolean;
  className?: string;
};

export function AssetAuditPanel({ compact = false, className }: AssetAuditPanelProps) {
  const points = useMapIsoStore((state) => state.points);
  const settings = useMapIsoStore((state) => state.settings);
  const profile = useMapIsoStore((state) => state.decisionProfile);
  const { generateIsochrones, isGeneratingIsochrones } = useIsochroneGenerator();
  const assets = points.filter(hasAssetMetadata);
  const totalCapacity = assets.reduce((sum, asset) => sum + (asset.capacity || 0), 0);
  const annualCost = assets.reduce((sum, asset) => sum + (asset.annualCost || 0), 0);
  const utilizationCount = assets.filter((asset) => asset.utilization).length;
  const fundingSourceCount = new Set(
    assets.map((asset) => asset.fundingSource).filter(Boolean),
  ).size;
  const typeCounts = countAssetTypes(assets);
  const civicConstraints = profile.constraints.filter((constraint) => constraint.type === "civic-asset");
  const reachMinutes = Math.max(...civicConstraints.map((constraint) => constraint.maxMinutes), 15);
  const requiredCapacity = civicConstraints.reduce(
    (sum, constraint) => sum + (constraint.minimumCapacity || 0),
    0,
  );

  const generateAssetServiceAreas = async () => {
    if (assets.length === 0) {
      toast.error("Import or add assets with audit metadata before generating service areas.");
      return;
    }

    await generateIsochrones({
      points: assets,
      settings: {
        ...settings,
        transportMode: "foot-walking",
        mobilityMode: "walk",
        timeMinutes: reachMinutes,
        timeBuckets: makeServiceBuckets(reachMinutes),
        isochroneMode: "overlap",
      },
    });
  };

  return (
    <section
      className={cn(
        "rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950",
        compact ? "space-y-3" : "space-y-4",
        className,
      )}
      aria-label="Existing asset audit"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
            <Building2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
            Existing assets
          </h2>
          <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">
            Imported civic capacity from typed map locations.
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {assets.length} asset{assets.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Metric label="Capacity" value={totalCapacity || "n/a"} />
        <Metric label="Target" value={requiredCapacity || "n/a"} />
        <Metric label="Types" value={typeCounts.length || "n/a"} />
        <Metric label="Reach" value={`${reachMinutes} min`} />
        <Metric label="Utilization" value={utilizationCount || "n/a"} />
        <Metric label="Annual cost" value={annualCost ? formatCurrency(annualCost) : "n/a"} />
      </div>

      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={generateAssetServiceAreas}
        disabled={assets.length === 0 || isGeneratingIsochrones}
        className="w-full"
      >
        <Route className="h-4 w-4" aria-hidden="true" />
        Generate asset service areas
      </Button>

      {assets.length === 0 ? (
        <div className="rounded-md border border-dashed border-neutral-200 p-3 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          No imported assets with audit metadata are active.
        </div>
      ) : (
        <div className="grid gap-3">
          {fundingSourceCount > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100">
              {fundingSourceCount} funding source{fundingSourceCount === 1 ? "" : "s"} captured
              for audit traceability.
            </div>
          )}
          <div className="grid gap-2">
            {typeCounts.map(([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900/60"
              >
                <span className="flex min-w-0 items-center gap-2 truncate font-medium text-neutral-700 dark:text-neutral-200">
                  <Database className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                  <span className="truncate">{type}</span>
                </span>
                <Badge variant="outline" className="shrink-0">
                  {count}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function hasAssetMetadata(asset: {
  assetType?: string;
  capacity?: number;
  hoursOpen?: string;
  utilization?: string;
  staffing?: string;
  annualCost?: number;
  fundingSource?: string;
}) {
  return Boolean(
    asset.assetType ||
      asset.capacity !== undefined ||
      asset.hoursOpen ||
      asset.utilization ||
      asset.staffing ||
      asset.annualCost !== undefined ||
      asset.fundingSource,
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-2 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="text-[11px] font-medium uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-neutral-950 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function countAssetTypes(assets: Array<{ assetType?: string }>) {
  const counts = assets.reduce<Record<string, number>>((accumulator, asset) => {
    const key = asset.assetType || "Unspecified";
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});

  return Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
}

function makeServiceBuckets(maxMinutes: number) {
  const roundedMax = Math.max(5, Math.min(60, Math.ceil(maxMinutes / 5) * 5));
  const buckets: number[] = [];

  for (let minutes = 5; minutes <= Math.min(roundedMax, 30); minutes += 5) {
    buckets.push(minutes);
  }

  if (roundedMax > 30 && !buckets.includes(roundedMax)) {
    buckets.push(roundedMax);
  }

  return buckets;
}
