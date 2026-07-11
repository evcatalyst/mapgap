import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  FileUp,
  Grid2X2,
  Layers3,
  MapPin,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import toast from "react-hot-toast";
import { makeScenarioProfile } from "../../domain/profileDefaults";
import type { DecisionConstraint } from "../../domain/decisionTypes";
import { parsePointsCsvDetailed } from "../../lib/csv";
import { fetchServicePoints } from "../../services/servicePointsClient";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type {
  MapBounds,
  PoiCategory,
  PoiLayerSource,
  ScenarioId,
  ServicePointCategory,
} from "../../types";
import { AssetAuditPanel } from "../assets/AssetAuditPanel";
import { CandidateZonesPanel } from "../candidates/CandidateZonesPanel";
import { MapCanvas } from "../map/MapCanvas";
import { ProfilePanel } from "../profile/ProfilePanel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DecisionAnchorMarkers } from "./DecisionAnchorMarkers";

export type V2DecisionWorkflow = "relocate" | "audit";

const relocationScenarios: Array<{ value: ScenarioId; label: string }> = [
  { value: "relocation-household", label: "Household relocation" },
  { value: "dual-career", label: "Dual-career household" },
  { value: "hospital-on-call", label: "Hospital on-call" },
];

const evidenceCategories: Array<{
  category: Exclude<ServicePointCategory, "custom">;
  label: string;
  poiCategory: PoiCategory;
}> = [
  { category: "coffee", label: "Coffee", poiCategory: "coffee" },
  { category: "grocery", label: "Groceries", poiCategory: "grocery" },
  { category: "laundry", label: "Laundry", poiCategory: "laundry" },
  { category: "library", label: "Libraries", poiCategory: "library" },
];

export function V2DecisionWorkflowShell({ workflow }: { workflow: V2DecisionWorkflow }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const applyScenario = useMapIsoStore((state) => state.applyScenario);
  const clearCandidateHomes = useMapIsoStore((state) => state.clearCandidateHomes);
  const clearIsochrones = useMapIsoStore((state) => state.clearIsochrones);
  const clearPoiLayers = useMapIsoStore((state) => state.clearPoiLayers);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);
  const profile = useMapIsoStore((state) => state.decisionProfile);
  const initialScenario: ScenarioId = workflow === "relocate" ? "relocation-household" : "asset-audit";

  useEffect(() => {
    const nextProfile = makeScenarioProfile(initialScenario);
    applyScenario(initialScenario);
    clearCandidateHomes();
    clearIsochrones();
    clearPoiLayers();
    jumpToProfile(nextProfile.anchors, setMapJumpTarget);
  }, [applyScenario, clearCandidateHomes, clearIsochrones, clearPoiLayers, initialScenario, setMapJumpTarget]);

  const title = workflow === "relocate" ? "Relocation decision brief" : "Civic capacity pilot";

  return (
    <main className="mapgap-v2-shell relative h-dvh min-h-screen overflow-hidden bg-neutral-100 text-neutral-950 dark:bg-neutral-950 dark:text-neutral-50">
      <MapCanvas
        allowPointCreate={false}
        className="h-dvh min-h-screen"
        fitStoredPoints={workflow === "audit"}
        publicMode
        showLegacyData
        showRegionLabel={false}
      >
        <DecisionAnchorMarkers anchors={profile.anchors} />
      </MapCanvas>

      <header className="mapgap-v2-topbar pointer-events-none absolute left-[5.25rem] right-3 z-[1100] flex items-start justify-between gap-3 sm:left-4 sm:right-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl border border-white/80 bg-white/95 px-3 py-2 shadow-lg shadow-neutral-950/10 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
          <a
            href="/v2"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-neutral-300 dark:hover:bg-neutral-900"
            aria-label="Back to Explore Nearby"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </a>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="hidden truncate text-xs text-neutral-500 sm:block dark:text-neutral-400">
              {profile.regionLabel}
            </div>
          </div>
        </div>
        {!panelOpen && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto h-11 w-11 rounded-full bg-white/95 shadow-lg dark:bg-neutral-950/90"
            onClick={() => setPanelOpen(true)}
            aria-label="Open decision panel"
          >
            <PanelRightOpen className="h-5 w-5" aria-hidden="true" />
          </Button>
        )}
      </header>

      {panelOpen && (
        <aside
          className="mapgap-v2-workflow-panel fixed inset-x-0 bottom-0 z-[900] mx-auto flex max-h-[62dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-[24px] border border-neutral-200 bg-stone-50 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950 lg:inset-y-4 lg:left-auto lg:right-4 lg:max-h-none lg:w-[390px] lg:rounded-xl"
          aria-label={title}
        >
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-neutral-200 px-4 dark:border-neutral-800">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{title}</h1>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                {workflow === "relocate" ? "Profile · evidence · candidates" : "Assets · reach · evidence memo"}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-full"
              onClick={() => setPanelOpen(false)}
              aria-label="Close decision panel"
            >
              <PanelRightClose className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
            {workflow === "relocate" ? <RelocationWorkflow /> : <AuditWorkflow />}
          </div>
        </aside>
      )}
    </main>
  );
}

function RelocationWorkflow() {
  const profile = useMapIsoStore((state) => state.decisionProfile);
  const applyScenario = useMapIsoStore((state) => state.applyScenario);
  const setMapJumpTarget = useMapIsoStore((state) => state.setMapJumpTarget);

  function changeScenario(scenario: ScenarioId) {
    const nextProfile = makeScenarioProfile(scenario);
    applyScenario(scenario);
    jumpToProfile(nextProfile.anchors, setMapJumpTarget);
  }

  return (
    <>
      <section className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <label htmlFor="v2-relocation-scenario" className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
          Household scenario
        </label>
        <div className="relative mt-2">
          <select
            id="v2-relocation-scenario"
            value={profile.scenarioId}
            onChange={(event) => changeScenario(event.target.value as ScenarioId)}
            className="h-11 w-full appearance-none rounded-md border border-neutral-300 bg-white px-3 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:bg-neutral-950"
          >
            {relocationScenarios.map((scenario) => (
              <option key={scenario.value} value={scenario.value}>
                {scenario.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-neutral-500" aria-hidden="true" />
        </div>
      </section>
      <RelocationInputs />
      <DailyLifeEvidence />
      <ProfilePanel compact />
      <CandidateZonesPanel compact />
    </>
  );
}

function RelocationInputs() {
  const profile = useMapIsoStore((state) => state.decisionProfile);
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const updateAnchor = useMapIsoStore((state) => state.updateDecisionProfileAnchor);
  const replaceConstraint = useMapIsoStore((state) => state.replaceDecisionProfileConstraint);
  const center = useMemo(() => centerOfBounds(mapBounds), [mapBounds]);

  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950" aria-label="Relocation inputs">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          Anchors and limits
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Pan the map, then set an anchor to the visible center.
        </p>
      </div>

      <div className="space-y-2">
        {profile.anchors.map((anchor) => (
          <div key={anchor.id} className="flex items-center justify-between gap-2 rounded-md border border-neutral-200 px-2.5 py-2 dark:border-neutral-800">
            <div className="min-w-0">
              <div className="truncate text-xs font-medium">{anchor.name}</div>
              <div className="text-[11px] text-neutral-500">{anchor.priority} · {anchor.category}</div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!center}
              onClick={() => {
                if (center) updateAnchor(anchor.id, center);
              }}
            >
              Set here
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        {profile.constraints.map((constraint, index) => (
          <ConstraintInput
            key={`${constraint.type}-${index}`}
            constraint={constraint}
            onChange={(next) => replaceConstraint(index, next)}
          />
        ))}
      </div>
    </section>
  );
}

function ConstraintInput({
  constraint,
  onChange,
}: {
  constraint: DecisionConstraint;
  onChange: (constraint: DecisionConstraint) => void;
}) {
  const minutes =
    constraint.type === "job"
      ? constraint.maxCommuteMinutes
      : "maxMinutes" in constraint
        ? constraint.maxMinutes
        : undefined;

  if (minutes === undefined) {
    return (
      <div className="rounded-md bg-neutral-50 px-2.5 py-2 text-xs dark:bg-neutral-900">
        {constraint.type.replace("-", " ")} · {constraint.priority}
      </div>
    );
  }

  return (
    <label className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-2.5 py-2 text-xs dark:bg-neutral-900">
      <span className="min-w-0 truncate capitalize">{constraint.type.replace("-", " ")} limit</span>
      <span className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          min={1}
          max={120}
          value={minutes}
          onChange={(event) => {
            const value = Math.max(1, Math.min(120, Number(event.target.value) || 1));
            onChange(
              constraint.type === "job"
                ? { ...constraint, maxCommuteMinutes: value }
                : { ...constraint, maxMinutes: value },
            );
          }}
          className="h-10 w-16 rounded-md border border-neutral-300 bg-white px-2 text-right dark:border-neutral-700 dark:bg-neutral-950"
          aria-label={`${constraint.type} minutes`}
        />
        min
      </span>
    </label>
  );
}

function DailyLifeEvidence() {
  const [loadingCategory, setLoadingCategory] = useState<ServicePointCategory | null>(null);
  const mapBounds = useMapIsoStore((state) => state.mapBounds);
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const addPoiLayer = useMapIsoStore((state) => state.addPoiLayer);

  async function loadEvidence(item: (typeof evidenceCategories)[number]) {
    if (!mapBounds) {
      toast.error("Map view is still loading.");
      return;
    }

    setLoadingCategory(item.category);
    try {
      const response = await fetchServicePoints({ category: item.category, bounds: mapBounds });
      const sources = new Set(response.points.map((point) => point.source));
      const source: PoiLayerSource =
        sources.size > 1
          ? "mixed"
          : sources.has("google_places")
            ? "google"
            : "open-data";

      addPoiLayer({
        category: item.poiCategory,
        query: item.label,
        label: `${item.label} in view`,
        source,
        points: response.points.map((point) => ({
          id: point.id,
          name: point.name,
          address: point.address,
          lat: point.location.lat,
          lng: point.location.lng,
          category: item.poiCategory,
          source: point.source === "google_places" ? "google" : "open-data",
          sourceId: point.id,
        })),
        message: response.warnings?.[0],
      });
      toast.success(`${response.count} ${item.label.toLowerCase()} places loaded.`);
    } catch {
      toast.error(`${item.label} evidence could not be loaded.`);
    } finally {
      setLoadingCategory(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950" aria-label="Daily-life evidence">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Layers3 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Daily-life evidence
          </h2>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Current map view</p>
        </div>
        <Badge variant="outline">{poiLayers.length} layers</Badge>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {evidenceCategories.map((item) => (
          <Button
            key={item.category}
            type="button"
            variant="secondary"
            size="sm"
            disabled={loadingCategory !== null}
            onClick={() => void loadEvidence(item)}
          >
            {loadingCategory === item.category ? "Loading..." : item.label}
          </Button>
        ))}
      </div>
    </section>
  );
}

function AuditWorkflow() {
  const addImportedPoints = useMapIsoStore((state) => state.addImportedPoints);

  async function importCsv(file: File | undefined) {
    if (!file) return;

    try {
      const parsed = parsePointsCsvDetailed(await file.text());
      if (parsed.points.length === 0) {
        toast.error("No valid asset rows with latitude and longitude were found.");
        return;
      }
      addImportedPoints(parsed.points);
      toast.success(`Imported ${parsed.points.length} civic assets.`);
    } catch {
      toast.error("Asset CSV import failed.");
    }
  }

  return (
    <>
      <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              Asset inventory
            </h2>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">CSV with coordinates, capacity, use, and cost</p>
          </div>
          <Badge variant="warning">Pilot</Badge>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 focus-within:ring-2 focus-within:ring-emerald-500">
          <FileUp className="h-4 w-4" aria-hidden="true" />
          Import asset CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => {
              void importCsv(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </section>
      <AssetAuditPanel compact />
      <ProfilePanel compact />
      <CandidateZonesPanel compact />
      <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
        <Grid2X2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Candidate zones currently use imported capacity and routed reach; demographic need overlays remain a pilot data gate.
      </div>
    </>
  );
}

function centerOfBounds(bounds?: MapBounds) {
  if (!bounds) return undefined;
  return {
    lat: (bounds.south + bounds.north) / 2,
    lng: (bounds.west + bounds.east) / 2,
  };
}

function jumpToProfile(
  anchors: Array<{ lat: number; lng: number }>,
  setMapJumpTarget: ReturnType<typeof useMapIsoStore.getState>["setMapJumpTarget"],
) {
  if (anchors.length === 0) return;
  const lat = anchors.reduce((sum, anchor) => sum + anchor.lat, 0) / anchors.length;
  const lng = anchors.reduce((sum, anchor) => sum + anchor.lng, 0) / anchors.length;
  setMapJumpTarget({ id: "decision-profile", label: "Decision profile", lat, lng, zoom: 10 });
}
