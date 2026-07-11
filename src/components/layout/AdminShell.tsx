import { lazy, Suspense } from "react";
import toast from "react-hot-toast";
import { AppSidebar } from "./AppSidebar";
import { MobileDrawer } from "./MobileDrawer";
import { TopBar } from "./TopBar";
import { MapCanvas } from "../map/MapCanvas";
import { PointsTable } from "../table/PointsTable";
import { FirstRunCards } from "../scenarios/FirstRunCards";
import { parsePointsCsvDetailed } from "../../lib/csv";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { cn } from "../../lib/utils";

const CommandPalette = lazy(() =>
  import("../commands/CommandPalette").then((module) => ({ default: module.CommandPalette })),
);

export function AdminShell() {
  const layoutMode = useMapIsoStore((state) => state.settings.layoutMode);
  const commandPaletteOpen = useMapIsoStore((state) => state.commandPaletteOpen);

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden bg-stone-50 text-neutral-950 dark:bg-neutral-950 dark:text-white lg:h-screen lg:overflow-hidden">
      <AppSidebar />
      <MobileDrawer />
      <AdminCsvImportInput />
      <main className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <TopBar />
        <div className="hidden lg:block">
          <FirstRunCards />
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-col lg:min-h-0 lg:flex-1 lg:grid",
            layoutMode === "split" && "lg:grid-rows-[minmax(360px,1fr)_320px]",
            layoutMode === "map-first" && "lg:grid-rows-[minmax(420px,1fr)_280px]",
            layoutMode === "table-first" && "lg:grid-rows-[320px_minmax(360px,1fr)]",
          )}
        >
          {layoutMode === "table-first" ? (
            <>
              <PointsTable />
              <MapCanvas />
            </>
          ) : (
            <>
              <MapCanvas />
              <PointsTable />
            </>
          )}
        </div>
        <div className="lg:hidden">
          <FirstRunCards />
        </div>
      </main>
      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
    </div>
  );
}

function AdminCsvImportInput() {
  const addImportedPoints = useMapIsoStore((state) => state.addImportedPoints);

  async function importCsv(file: File | undefined) {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = parsePointsCsvDetailed(text);

      if (parsed.points.length === 0) {
        toast.error("No valid latitude/longitude rows found.");
        return;
      }

      addImportedPoints(parsed.points);
      toast.success(
        `Imported ${parsed.points.length} point${
          parsed.points.length === 1 ? "" : "s"
        }${parsed.skippedRows ? `; skipped ${parsed.skippedRows} row${parsed.skippedRows === 1 ? "" : "s"}` : ""}.`,
      );
    } catch {
      toast.error("CSV import failed.");
    }
  }

  return (
    <input
      type="file"
      accept=".csv,text/csv"
      className="hidden"
      aria-hidden="true"
      onChange={(event) => {
        void importCsv(event.target.files?.[0]);
        event.currentTarget.value = "";
      }}
    />
  );
}
