import { useEffect } from "react";
import L from "leaflet";
import { useMap } from "react-leaflet";
import { getAccessBucketColor } from "../../lib/accessHeat";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { IsochroneFeature } from "../../types";

type ScratchCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
};

function drawRing(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  topLeft: L.Point,
  coordinates: number[][],
) {
  coordinates.forEach(([lng, lat], index) => {
    const point = map.latLngToLayerPoint([lat, lng]).subtract(topLeft);

    if (index === 0) {
      ctx.moveTo(point.x, point.y);
      return;
    }

    ctx.lineTo(point.x, point.y);
  });
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  topLeft: L.Point,
  coordinates: number[][][],
) {
  coordinates.forEach((ring) => {
    drawRing(ctx, map, topLeft, ring);
    ctx.closePath();
  });
}

function drawFeature(
  ctx: CanvasRenderingContext2D,
  map: L.Map,
  topLeft: L.Point,
  feature: IsochroneFeature,
) {
  const geometry = feature.geometry;

  ctx.beginPath();

  if (geometry.type === "Polygon") {
    drawPolygon(ctx, map, topLeft, geometry.coordinates);
  } else {
    geometry.coordinates.forEach((polygon) => drawPolygon(ctx, map, topLeft, polygon));
  }

  ctx.fill("evenodd");
}

function makeScratchCanvas(width: number, height: number): ScratchCanvas | undefined {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return undefined;
  }

  canvas.width = width;
  canvas.height = height;

  return { canvas, ctx };
}

function clearScratch(scratch: ScratchCanvas, width: number, height: number) {
  scratch.ctx.setTransform(1, 0, 0, 1, 0, 0);
  scratch.ctx.clearRect(0, 0, width, height);
  scratch.ctx.globalAlpha = 1;
  scratch.ctx.globalCompositeOperation = "source-over";
  scratch.ctx.filter = "none";
}

function buildMask(
  scratch: ScratchCanvas,
  features: IsochroneFeature[],
  map: L.Map,
  topLeft: L.Point,
  dpr: number,
  width: number,
  height: number,
  blurPx: number,
) {
  clearScratch(scratch, width, height);
  scratch.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scratch.ctx.filter = `blur(${blurPx}px)`;
  scratch.ctx.fillStyle = "#000";

  features.forEach((feature) => drawFeature(scratch.ctx, map, topLeft, feature));
}

function paintMask(
  ctx: CanvasRenderingContext2D,
  colorScratch: ScratchCanvas,
  mask: HTMLCanvasElement,
  color: string,
  alpha: number,
  cssWidth: number,
  cssHeight: number,
  pixelWidth: number,
  pixelHeight: number,
  operation: GlobalCompositeOperation = "source-over",
) {
  clearScratch(colorScratch, pixelWidth, pixelHeight);
  colorScratch.ctx.fillStyle = color;
  colorScratch.ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  colorScratch.ctx.globalCompositeOperation = "destination-in";
  colorScratch.ctx.drawImage(mask, 0, 0);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = operation;
  ctx.drawImage(colorScratch.canvas, 0, 0, cssWidth, cssHeight);
  ctx.restore();
}

function eraseMask(
  ctx: CanvasRenderingContext2D,
  colorScratch: ScratchCanvas,
  mask: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
  pixelWidth: number,
  pixelHeight: number,
) {
  clearScratch(colorScratch, pixelWidth, pixelHeight);
  colorScratch.ctx.fillStyle = "#000";
  colorScratch.ctx.fillRect(0, 0, pixelWidth, pixelHeight);
  colorScratch.ctx.globalCompositeOperation = "destination-in";
  colorScratch.ctx.drawImage(mask, 0, 0);

  ctx.save();
  ctx.globalAlpha = 0.96;
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(colorScratch.canvas, 0, 0, cssWidth, cssHeight);
  ctx.restore();
}

function getBuckets(features: IsochroneFeature[]) {
  return Array.from(new Set(features.map((feature) => feature.properties.bucketMinutes))).sort(
    (a, b) => b - a,
  );
}

function getFeaturesByBucket(features: IsochroneFeature[], bucket: number) {
  return features.filter((feature) => feature.properties.bucketMinutes === bucket);
}

function getOutermostFeaturesByPoint(features: IsochroneFeature[]) {
  const byPoint = new Map<string, IsochroneFeature>();

  features.forEach((feature) => {
    const existing = byPoint.get(feature.properties.pointId);

    if (!existing || feature.properties.bucketMinutes > existing.properties.bucketMinutes) {
      byPoint.set(feature.properties.pointId, feature);
    }
  });

  return Array.from(byPoint.values());
}

export function RasterIsochroneLayer({ features }: { features: IsochroneFeature[] }) {
  const map = useMap();
  const settings = useMapIsoStore((state) => state.settings);
  const theme = useMapIsoStore((state) => state.theme);

  useEffect(() => {
    if (features.length === 0) {
      return undefined;
    }

    const canvas = L.DomUtil.create("canvas", "mapiso-raster-isochrones");
    const pane = map.getPanes().overlayPane;
    const buckets = getBuckets(features);
    const outermostFeatures = getOutermostFeaturesByPoint(features);

    canvas.style.pointerEvents = "none";
    pane.appendChild(canvas);

    const redraw = () => {
      const size = map.getSize();
      const dpr = window.devicePixelRatio || 1;
      const topLeft = map.containerPointToLayerPoint([0, 0]);
      const pixelWidth = size.x * dpr;
      const pixelHeight = size.y * dpr;
      const ctx = canvas.getContext("2d");
      const maskScratch = makeScratchCanvas(pixelWidth, pixelHeight);
      const colorScratch = makeScratchCanvas(pixelWidth, pixelHeight);

      if (!ctx || !maskScratch || !colorScratch) {
        return;
      }

      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      L.DomUtil.setPosition(canvas, topLeft);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      buckets.forEach((bucket) => {
        const bucketFeatures = getFeaturesByBucket(features, bucket);
        const color = getAccessBucketColor(bucket);

        buildMask(
          maskScratch,
          bucketFeatures,
          map,
          topLeft,
          dpr,
          pixelWidth,
          pixelHeight,
          theme === "dark" ? 34 : 30,
        );
        paintMask(
          ctx,
          colorScratch,
          maskScratch.canvas,
          color,
          Math.min(0.2, Math.max(0.08, settings.opacity * 0.42)),
          size.x,
          size.y,
          pixelWidth,
          pixelHeight,
        );
      });

      buckets.forEach((bucket) => {
        const bucketFeatures = getFeaturesByBucket(features, bucket);
        const color = getAccessBucketColor(bucket);

        buildMask(
          maskScratch,
          bucketFeatures,
          map,
          topLeft,
          dpr,
          pixelWidth,
          pixelHeight,
          theme === "dark" ? 14 : 12,
        );
        eraseMask(
          ctx,
          colorScratch,
          maskScratch.canvas,
          size.x,
          size.y,
          pixelWidth,
          pixelHeight,
        );
        paintMask(
          ctx,
          colorScratch,
          maskScratch.canvas,
          color,
          settings.isochroneMode === "individual"
            ? Math.min(0.42, Math.max(0.22, settings.opacity * 1.04))
            : Math.min(0.54, Math.max(0.3, settings.opacity * 1.42)),
          size.x,
          size.y,
          pixelWidth,
          pixelHeight,
        );
      });

      if (settings.isochroneMode === "overlap" && outermostFeatures.length > 1) {
        clearScratch(maskScratch, pixelWidth, pixelHeight);
        maskScratch.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        maskScratch.ctx.filter = theme === "dark" ? "blur(18px)" : "blur(16px)";
        maskScratch.ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
        outermostFeatures.forEach((feature) =>
          drawFeature(maskScratch.ctx, map, topLeft, feature),
        );

        paintMask(
          ctx,
          colorScratch,
          maskScratch.canvas,
          theme === "dark" ? "#88d6bd" : "#276f78",
          theme === "dark" ? 0.09 : 0.075,
          size.x,
          size.y,
          pixelWidth,
          pixelHeight,
          theme === "dark" ? "screen" : "multiply",
        );
      }
    };

    redraw();
    map.on("moveend zoomend resize viewreset", redraw);

    return () => {
      map.off("moveend zoomend resize viewreset", redraw);
      canvas.remove();
    };
  }, [features, map, settings.isochroneMode, settings.opacity, theme]);

  return null;
}
