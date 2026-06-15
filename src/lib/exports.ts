import { toPng } from "html-to-image";
import type { IsochroneCollection, MapPoint } from "../types";
import { exportPointsCsv } from "./csv";
import { buildMapIsoGeoJson } from "./geojson";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export function exportCsv(points: MapPoint[]) {
  exportPointsCsv(points);
}

export function exportGeoJson(points: MapPoint[], isochrones: IsochroneCollection) {
  const payload = buildMapIsoGeoJson(points, isochrones);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/geo+json;charset=utf-8",
  });

  downloadBlob(blob, `mapgap-export-${timestamp()}.geojson`);
}

export async function exportPng(element: HTMLElement) {
  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: document.documentElement.classList.contains("dark") ? "#0a0a0a" : "#fafaf9",
  });

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  downloadBlob(blob, `mapgap-map-${timestamp()}.png`);
}
