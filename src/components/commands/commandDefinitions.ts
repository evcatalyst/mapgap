import {
  Download,
  FileJson,
  ImageDown,
  Layers,
  MapPinPlus,
  Moon,
  RotateCcw,
  Sparkles,
  Table2,
  Upload,
} from "lucide-react";
import type { LayoutMode } from "../../types";

export const layoutModeCommands: Array<{ label: string; value: LayoutMode }> = [
  { label: "Switch layout: Map first", value: "map-first" },
  { label: "Switch layout: Split", value: "split" },
  { label: "Switch layout: Table first", value: "table-first" },
];

export const commandIcons = {
  addPoint: MapPinPlus,
  importCsv: Upload,
  generate: Sparkles,
  clear: RotateCcw,
  exportCsv: Download,
  exportGeoJson: FileJson,
  exportPng: ImageDown,
  theme: Moon,
  layout: Layers,
  table: Table2,
};
