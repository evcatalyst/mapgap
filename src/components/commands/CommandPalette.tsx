import { useRef } from "react";
import toast from "react-hot-toast";
import { DEFAULT_CENTER } from "../../constants";
import { parsePointsCsvDetailed } from "../../lib/csv";
import {
  exportCsv,
  exportDecisionMemoMarkdown,
  exportGeoJson,
  exportPng,
} from "../../lib/exports";
import { buildShareUrl, createShareSnapshot } from "../../lib/shareSnapshot";
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
  const poiLayers = useMapIsoStore((state) => state.poiLayers);
  const candidateHomes = useMapIsoStore((state) => state.candidateHomes);
  const isochrones = useMapIsoStore((state) => state.isochrones);
  const settings = useMapIsoStore((state) => state.settings);
  const decisionProfile = useMapIsoStore((state) => state.decisionProfile);
  const addPoint = useMapIsoStore((state) => state.addPoint);
  const addImportedPoints = useMapIsoStore((state) => state.addImportedPoints);
  const clearAll = useMapIsoStore((state) => state.clearAll);
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

  const exportMemoCommand = () => {
    exportDecisionMemoMarkdown({
      profile: decisionProfile,
      candidates: candidateHomes,
      poiLayers,
      points,
      isochrones,
      settings,
    });
    setLastExported("memo");
    toast.success("Decision memo exported.");
  };

  const shareSnapshotCommand = async () => {
    const url = buildShareUrl(
      createShareSnapshot({
        scenario: settings.selectedScenario || decisionProfile.scenarioId,
        settings,
        points,
      }),
    );

    window.history.replaceState(null, "", url);

    try {
      await navigator.clipboard?.writeText(url);
      toast.success("Share link copied.");
    } catch {
      toast.success("Share link added to the address bar.");
    }
  };

  const IconAdd = commandIcons.addPoint;
  const IconImport = commandIcons.importCsv;
  const IconGenerate = commandIcons.generate;
  const IconClear = commandIcons.clear;
  const IconCsv = commandIcons.exportCsv;
  const IconGeoJson = commandIcons.exportGeoJson;
  const IconMemo = commandIcons.exportMemo;
  const IconPng = commandIcons.exportPng;
  const IconShare = commandIcons.share;
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
                <CommandItem onSelect={() => run(clearAll)}>
                  <IconClear className="h-4 w-4" aria-hidden="true" />
                  Clear all
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
                <CommandItem onSelect={() => run(exportMemoCommand)}>
                  <IconMemo className="h-4 w-4" aria-hidden="true" />
                  Export decision memo
                </CommandItem>
                <CommandItem onSelect={() => run(exportPngCommand)}>
                  <IconPng className="h-4 w-4" aria-hidden="true" />
                  Export PNG
                </CommandItem>
              </CommandGroup>
              <CommandGroup heading="Share">
                <CommandItem onSelect={() => run(shareSnapshotCommand)}>
                  <IconShare className="h-4 w-4" aria-hidden="true" />
                  Share snapshot link
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
