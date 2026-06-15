import { useEffect, useState } from "react";
import { reverseGeocode } from "../../lib/api";
import { debugError } from "../../lib/debug";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { MapPoint } from "../../types";

export function TextCell({ point, field }: { point: MapPoint; field: "name" | "address" }) {
  const updatePoint = useMapIsoStore((state) => state.updatePoint);
  const [value, setValue] = useState(point[field] ?? "");

  useEffect(() => {
    setValue(point[field] ?? "");
  }, [point, field]);

  return (
    <input
      value={value}
      onChange={(event) => {
        setValue(event.target.value);
        updatePoint(point.id, { [field]: event.target.value });
      }}
      className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 text-sm outline-none transition hover:border-neutral-200 hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:focus:border-emerald-500 dark:focus:bg-neutral-950 dark:focus:ring-emerald-900"
      aria-label={`Edit ${field} for ${point.name}`}
    />
  );
}

export function CoordinateCell({ point, field }: { point: MapPoint; field: "lat" | "lng" }) {
  const updatePoint = useMapIsoStore((state) => state.updatePoint);
  const setGeocodeStatus = useMapIsoStore((state) => state.setGeocodeStatus);
  const canReverseGeocode = useMapIsoStore(
    (state) => state.status.apiCapabilities.openCage,
  );
  const [value, setValue] = useState(String(point[field]));

  useEffect(() => {
    setValue(String(point[field]));
  }, [point, field]);

  const commit = async (nextValue: string) => {
    const parsed = Number(nextValue);

    if (!Number.isFinite(parsed)) {
      setValue(String(point[field]));
      return;
    }

    updatePoint(point.id, {
      [field]: parsed,
      address: undefined,
    });

    const nextLat = field === "lat" ? parsed : point.lat;
    const nextLng = field === "lng" ? parsed : point.lng;

    if (!canReverseGeocode) {
      setGeocodeStatus(point.id, "failed");
      return;
    }

    setGeocodeStatus(point.id, "loading");

    try {
      const address = await reverseGeocode(nextLat, nextLng);
      if (address) {
        updatePoint(point.id, { address });
        setGeocodeStatus(point.id, "success");
      } else {
        setGeocodeStatus(point.id, "failed");
      }
    } catch (error) {
      setGeocodeStatus(point.id, "failed");
      debugError("Reverse geocode after table edit failed", error);
    }
  };

  return (
    <input
      type="number"
      value={value}
      step="0.0001"
      onChange={(event) => {
        setValue(event.target.value);
        const parsed = Number(event.target.value);
        if (Number.isFinite(parsed)) {
          updatePoint(point.id, { [field]: parsed, address: undefined });
        }
      }}
      onBlur={(event) => commit(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      className="h-9 w-full rounded-md border border-transparent bg-transparent px-2 font-mono text-sm outline-none transition hover:border-neutral-200 hover:bg-white focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 dark:hover:border-neutral-700 dark:hover:bg-neutral-900 dark:focus:border-emerald-500 dark:focus:bg-neutral-950 dark:focus:ring-emerald-900"
      aria-label={`Edit ${field === "lat" ? "latitude" : "longitude"} for ${point.name}`}
    />
  );
}
