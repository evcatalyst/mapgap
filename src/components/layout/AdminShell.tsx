import { AppSidebar } from "./AppSidebar";
import { MobileDrawer } from "./MobileDrawer";
import { TopBar } from "./TopBar";
import { MapCanvas } from "../map/MapCanvas";
import { PointsTable } from "../table/PointsTable";
import { CommandPalette } from "../commands/CommandPalette";
import { FirstRunCards } from "../scenarios/FirstRunCards";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { cn } from "../../lib/utils";

export function AdminShell() {
  const layoutMode = useMapIsoStore((state) => state.settings.layoutMode);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-stone-50 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <AppSidebar />
      <MobileDrawer />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <FirstRunCards />
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1",
            layoutMode === "split" && "grid grid-rows-[minmax(360px,1fr)_320px]",
            layoutMode === "map-first" && "grid grid-rows-[minmax(420px,1fr)_280px]",
            layoutMode === "table-first" && "grid grid-rows-[320px_minmax(360px,1fr)]",
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
      </main>
      <CommandPalette />
    </div>
  );
}
