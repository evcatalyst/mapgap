import {
  Download,
  FileText,
  FileJson,
  ImageDown,
  Layers,
  MapPinPlus,
  Moon,
  RotateCcw,
  Share2,
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
  exportMemo: FileText,
  exportPng: ImageDown,
  share: Share2,
  theme: Moon,
  layout: Layers,
  table: Table2,
};
