import { Download, FileJson, ImageDown, Menu, Moon, Search, Sun } from "lucide-react";
import toast from "react-hot-toast";
import { exportCsv, exportGeoJson, exportPng } from "../../lib/exports";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import { Button } from "../ui/button";
import { StatusPills } from "./StatusPills";

export function TopBar() {
  const theme = useMapIsoStore((state) => state.theme);
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const sidebarOpen = useMapIsoStore((state) => state.sidebarOpen);
  const toggleSidebar = useMapIsoStore((state) => state.toggleSidebar);
  const toggleTheme = useMapIsoStore((state) => state.toggleTheme);
  const setCommandPaletteOpen = useMapIsoStore((state) => state.setCommandPaletteOpen);
  const setLastExported = useMapIsoStore((state) => state.setLastExported);
  const setExportStatus = useMapIsoStore((state) => state.setExportStatus);
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const exportPngCommand = async () => {
    const element = document.getElementById("mapiso-capture");

    if (!element) {
      toast.error("Map export target was not found.");
      return;
    }

    setExportStatus("loading");
    try {
      await exportPng(element);
      setLastExported("png");
      toast.success("PNG exported.");
    } catch {
      setExportStatus("failed");
      toast.error("PNG export failed.");
    }
  };

  return (
    <header className="flex min-h-16 shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Open sidebar"}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-neutral-950 dark:text-white">
            MapGap Control Plane
          </h1>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            Nearby things aren't always easy to get to
          </p>
        </div>
      </div>

      <StatusPills />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          className="min-w-[180px] justify-start text-neutral-500"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1 text-left">Search commands</span>
          <kbd className="rounded border border-neutral-200 px-1.5 py-0.5 text-[10px] dark:border-neutral-800">
            Cmd K
          </kbd>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            exportCsv(points);
            setLastExported("csv");
            toast.success("CSV exported.");
          }}
          disabled={points.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          CSV
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            exportGeoJson(points, isochrones);
            setLastExported("geojson");
            toast.success("GeoJSON exported.");
          }}
          disabled={points.length === 0 && isochrones.length === 0}
        >
          <FileJson className="h-4 w-4" aria-hidden="true" />
          GeoJSON
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={exportPngCommand}>
          <ImageDown className="h-4 w-4" aria-hidden="true" />
          PNG
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <ThemeIcon className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>
    </header>
  );
}
