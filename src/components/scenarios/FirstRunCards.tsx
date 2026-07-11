import {
  Building2,
  BriefcaseBusiness,
  ClipboardCheck,
  HeartPulse,
  Home,
  Landmark,
  School,
  Shirt,
  Users,
} from "lucide-react";
import { SCENARIO_PRESETS } from "./scenarioPresets";
import { useScenarioLauncher } from "../../hooks/useScenarioLauncher";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { ScenarioId } from "../../types";
import { Badge } from "../ui/badge";

const icons: Record<ScenarioId, typeof Building2> = {
  "relocation-household": Home,
  "dual-career": Users,
  "hospital-on-call": HeartPulse,
  "school-fit": School,
  "workforce-access": BriefcaseBusiness,
  "asset-audit": ClipboardCheck,
  "laundromat-walkability": Shirt,
  "real-estate-dev": Building2,
  "home-seeker": Home,
  "urban-planner": Landmark,
};

export function FirstRunCards() {
  const hasCompletedFirstRun = useMapIsoStore(
    (state) => state.settings.hasCompletedFirstRun,
  );
  const points = useMapIsoStore((state) => state.points);
  const { launchScenario } = useScenarioLauncher();

  if (points.length > 0) {
    return null;
  }

  const featuredScenarios = SCENARIO_PRESETS.filter((scenario) => scenario.featured);
  const isFirstRun = !hasCompletedFirstRun;

  return (
    <section className="border-b border-neutral-200 bg-white/95 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-950/95 sm:px-4">
      <div className="grid gap-2 2xl:grid-cols-[210px_minmax(0,1fr)] 2xl:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold sm:text-sm">Choose your operating profile</h2>
            <Badge variant="outline" className="h-7 px-2 text-[11px]">
              {isFirstRun ? "First run" : "Empty map"}
            </Badge>
          </div>
          <p className="mt-0.5 hidden text-xs text-neutral-500 dark:text-neutral-400 sm:block">
            {isFirstRun
              ? "Apply sensible defaults, then start on the map."
              : "Reload a demo or choose a workflow to restart."}
          </p>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {featuredScenarios.map((scenario) => {
            const Icon = icons[scenario.id];

            return (
              <button
                key={scenario.id}
                type="button"
                className="flex min-h-[52px] items-center gap-2.5 rounded-md border border-neutral-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-emerald-400 hover:shadow-soft focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-neutral-800 dark:bg-neutral-950"
                onClick={() => launchScenario(scenario.id)}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-sm font-semibold">{scenario.title}</h3>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-300">
                      Apply
                    </span>
                  </div>
                  <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
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
