import { useMapIsoStore } from "../../store/useMapIsoStore";
import { WorkflowStep } from "./WorkflowStep";

export function WorkflowPanel() {
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const isGenerating = useMapIsoStore((state) => state.isGeneratingIsochrones);
  const status = useMapIsoStore((state) => state.status);

  const hasPoints = points.length > 0;
  const hasIsochrones = isochrones.length > 0;
  const apiReady = status.apiStatus === "ready";

  return (
    <section aria-labelledby="workflow-title">
      <div className="mb-3">
        <h2 id="workflow-title" className="text-sm font-semibold">
          Operator workflow
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          Track the access analysis from locations to shared MapGap heat.
        </p>
      </div>
      <ol className="space-y-2">
        <WorkflowStep
          label="Add locations"
          description="Drop map points or import a CSV."
          status={hasPoints ? "complete" : "ready"}
        />
        <WorkflowStep
          label="Validate/geocode"
          description="Resolve addresses where API access is configured."
          status={!apiReady ? "blocked" : hasPoints ? "ready" : "idle"}
        />
        <WorkflowStep
          label="Generate isochrones"
          description="Build time rings for the active travel profile."
          status={isGenerating ? "active" : hasIsochrones ? "complete" : hasPoints && apiReady ? "ready" : "idle"}
        />
        <WorkflowStep
          label="Analyze overlap"
          description="Compare unified, individual, and overlap views."
          status={hasIsochrones ? "ready" : "idle"}
        />
        <WorkflowStep
          label="Export"
          description="Download CSV, GeoJSON, or a map snapshot."
          status={status.lastExportedAt ? "complete" : hasPoints ? "ready" : "idle"}
        />
      </ol>
    </section>
  );
}
