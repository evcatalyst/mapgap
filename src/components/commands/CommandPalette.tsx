import { useRef } from "react";
import toast from "react-hot-toast";
import { DEFAULT_CENTER } from "../../constants";
import { parsePointsCsv } from "../../lib/csv";
import { exportCsv, exportGeoJson, exportPng } from "../../lib/exports";
import { useIsochroneGenerator } from "../../hooks/useIsochroneGenerator";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { commandIcons, layoutModeCommands } from "./commandDefinitions";

export function CommandPalette() {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = useMapIsoStore((state) => state.commandPaletteOpen);
  const setOpen = useMapIsoStore((state) => state.setCommandPaletteOpen);
  const points = useMapIsoStore((state) => state.points);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const addPoint = useMapIsoStore((state) => state.addPoint);
  const addImportedPoints = useMapIsoStore((state) => state.addImportedPoints);
  const clearPoints = useMapIsoStore((state) => state.clearPoints);
  const toggleTheme = useMapIsoStore((state) => state.toggleTheme);
  const setLayoutMode = useMapIsoStore((state) => state.setLayoutMode);
  const setLastExported = useMapIsoStore((state) => state.setLastExported);
  const setExportStatus = useMapIsoStore((state) => state.setExportStatus);
  const { generateIsochrones } = useIsochroneGenerator();

  const run = async (action: () => void | Promise<void>) => {
    setOpen(false);
    await action();
  };

  const importCsv = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = parsePointsCsv(text);

      if (parsed.length === 0) {
        toast.error("No valid latitude/longitude rows found.");
        return;
      }

      addImportedPoints(parsed);
      toast.success(`Imported ${parsed.length} point${parsed.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error("CSV import failed.");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

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

  const exportGeoJsonCommand = () => {
    exportGeoJson(points, isochrones);
    setLastExported("geojson");
    toast.success("GeoJSON exported.");
  };

  const exportCsvCommand = () => {
    exportCsv(points);
    setLastExported("csv");
    toast.success("CSV exported.");
  };

  const IconAdd = commandIcons.addPoint;
  const IconImport = commandIcons.importCsv;
  const IconGenerate = commandIcons.generate;
  const IconClear = commandIcons.clear;
  const IconCsv = commandIcons.exportCsv;
  const IconGeoJson = commandIcons.exportGeoJson;
  const IconPng = commandIcons.exportPng;
  const IconTheme = commandIcons.theme;
  const IconLayout = commandIcons.layout;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => importCsv(event.target.files?.[0])}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <DialogDescription className="sr-only">
            Search and run MapGap commands.
          </DialogDescription>
          <Command>
            <CommandInput placeholder="Search commands..." />
            <CommandList>
              <CommandEmpty>No command found.</CommandEmpty>
              <CommandGroup heading="Locations">
                <CommandItem
                  onSelect={() =>
                    run(() => {
                      addPoint(DEFAULT_CENTER, { name: "New location" });
                      toast.success("Point added at map center.");
                    })
                  }
                >
                  <IconAdd className="h-4 w-4" aria-hidden="true" />
                  Add point
                </CommandItem>
                <CommandItem onSelect={() => run(() => inputRef.current?.click())}>
                  <IconImport className="h-4 w-4" aria-hidden="true" />
                  Import CSV
                </CommandItem>
                <CommandItem onSelect={() => run(clearPoints)}>
                  <IconClear className="h-4 w-4" aria-hidden="true" />
                  Clear map
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Isochrones">
                <CommandItem onSelect={() => run(generateIsochrones)}>
                  <IconGenerate className="h-4 w-4" aria-hidden="true" />
                  Generate access heatmap
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Export">
                <CommandItem onSelect={() => run(exportCsvCommand)}>
                  <IconCsv className="h-4 w-4" aria-hidden="true" />
                  Export CSV
                </CommandItem>
                <CommandItem onSelect={() => run(exportGeoJsonCommand)}>
                  <IconGeoJson className="h-4 w-4" aria-hidden="true" />
                  Export GeoJSON
                </CommandItem>
                <CommandItem onSelect={() => run(exportPngCommand)}>
                  <IconPng className="h-4 w-4" aria-hidden="true" />
                  Export PNG
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="View">
                <CommandItem onSelect={() => run(toggleTheme)}>
                  <IconTheme className="h-4 w-4" aria-hidden="true" />
                  Toggle theme
                </CommandItem>
                {layoutModeCommands.map((command) => (
                  <CommandItem
                    key={command.value}
                    onSelect={() => run(() => setLayoutMode(command.value))}
                  >
                    <IconLayout className="h-4 w-4" aria-hidden="true" />
                    {command.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
