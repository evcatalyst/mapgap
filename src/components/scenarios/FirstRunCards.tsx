import { Building2, Home, Landmark } from "lucide-react";
import { SCENARIO_PRESETS } from "./scenarioPresets";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { ScenarioId } from "../../types";
import { Badge } from "../ui/badge";

const icons: Record<ScenarioId, typeof Building2> = {
  "real-estate-dev": Building2,
  "home-seeker": Home,
  "urban-planner": Landmark,
};

export function FirstRunCards() {
  const hasCompletedFirstRun = useMapIsoStore(
    (state) => state.settings.hasCompletedFirstRun,
  );
  const applyScenario = useMapIsoStore((state) => state.applyScenario);

  if (hasCompletedFirstRun) {
    return null;
  }

  return (
    <section className="border-b border-neutral-200 bg-white/95 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)] xl:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Choose your operating profile</h2>
            <Badge variant="outline">First run</Badge>
          </div>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Apply sensible defaults, then start on the map.
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
        {SCENARIO_PRESETS.map((scenario) => {
          const Icon = icons[scenario.id];

          return (
            <button
              key={scenario.id}
              type="button"
              className="flex min-h-[76px] items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-800 dark:bg-neutral-950"
              onClick={() => applyScenario(scenario.id)}
            >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold">{scenario.title}</h3>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-300">
                      Apply
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
                    {scenario.subtitle}
                  </p>
                </div>
            </button>
          );
        })}
        </div>
      </div>
    </section>
  );
}
