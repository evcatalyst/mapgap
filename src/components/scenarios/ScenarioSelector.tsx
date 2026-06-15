import { SCENARIO_PRESETS } from "./scenarioPresets";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { ScenarioId } from "../../types";
import { Select } from "../ui/select";

export function ScenarioSelector() {
  const selectedScenario = useMapIsoStore((state) => state.settings.selectedScenario);
  const applyScenario = useMapIsoStore((state) => state.applyScenario);

  return (
    <label className="block">
      <span className="mb-2 block text-xs font-medium text-neutral-500">Scenario</span>
      <Select
        value={selectedScenario || ""}
        onChange={(event) => {
          const value = event.target.value;
          if (value) {
            applyScenario(value as ScenarioId);
          }
        }}
        aria-label="Scenario profile"
      >
        <option value="">No profile</option>
        {SCENARIO_PRESETS.map((scenario) => (
          <option key={scenario.id} value={scenario.id}>
            {scenario.title}
          </option>
        ))}
      </Select>
    </label>
  );
}
