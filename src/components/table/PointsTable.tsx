import { useMemo, useRef } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Edit3, Loader2, MapPin, Trash2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatCoordinate } from "../../lib/format";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import type { MapPoint } from "../../types";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { CoordinateCell, TextCell } from "./EditableCells";

export function PointsTable() {
  const points = useMapIsoStore((state) => state.points);
  const removePoint = useMapIsoStore((state) => state.removePoint);
  const geocodeStatusByPointId = useMapIsoStore((state) => state.status.geocodeStatusByPointId);
  const parentRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<MapPoint>[]>(
    () => [
      {
        id: "marker",
        header: "",
        size: 50,
        cell: ({ row }) => (
          <span
            className="mx-auto grid h-8 w-8 place-items-center rounded-md text-white shadow-sm"
            style={{ backgroundColor: row.original.color }}
            aria-label={`${row.original.name} marker color`}
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        size: 190,
        cell: ({ row }) => <TextCell point={row.original} field="name" />,
      },
      {
        accessorKey: "lat",
        header: "Latitude",
        size: 150,
        cell: ({ row }) => <CoordinateCell point={row.original} field="lat" />,
      },
      {
        accessorKey: "lng",
        header: "Longitude",
        size: 150,
        cell: ({ row }) => <CoordinateCell point={row.original} field="lng" />,
      },
      {
        accessorKey: "address",
        header: "Address",
        size: 340,
        cell: ({ row }) => {
          const status = geocodeStatusByPointId[row.original.id];

          return (
            <div className="flex items-center gap-2">
              {status === "loading" && (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-emerald-600 dark:text-emerald-400"
                  aria-label="Resolving address"
                />
              )}
              <TextCell point={row.original} field="address" />
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        size: 110,
        cell: ({ row }) => {
          const status = geocodeStatusByPointId[row.original.id] || "idle";
          const variant =
            status === "success" ? "success" : status === "failed" ? "warning" : "outline";

          return <Badge variant={variant}>{status}</Badge>;
        },
      },
      {
        id: "formatted",
        header: "Current",
        size: 180,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
            {formatCoordinate(row.original.lat)}, {formatCoordinate(row.original.lng)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        size: 108,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => removePoint(row.original.id)}
            aria-label={`Remove ${row.original.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
        ),
      },
    ],
    [geocodeStatusByPointId, removePoint],
  );

  const table = useReactTable({
    data: points,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58,
    overscan: 8,
  });

  return (
    <section
      className="min-h-0 border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
      aria-labelledby="points-grid-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
            <Edit3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="points-grid-title" className="text-sm font-semibold text-neutral-950 dark:text-white">
              Location table
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Editable records stay synced with map markers.
            </p>
          </div>
        </div>
        <Badge variant="outline">
          {points.length} point{points.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div
        ref={parentRef}
        className={cn(
          "h-[260px] overflow-auto",
          points.length === 0 && "grid place-items-center",
        )}
      >
        {points.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">
              No locations yet.
            </p>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Click the map, use Cmd+K, or import a CSV to start.
            </p>
          </div>
        ) : (
          <table className="grid min-w-[1280px] text-left text-sm">
            <thead className="sticky top-0 z-10 grid border-b border-neutral-200 bg-neutral-50 text-xs font-semibold uppercase tracking-normal text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="flex w-full">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="flex h-11 items-center px-2"
                      style={{
                        width: header.getSize(),
                      }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody
              className="relative grid"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const row = rows[virtualRow.index];

                return (
                  <tr
                    key={row.id}
                    className="absolute left-0 flex w-full border-b border-neutral-100 bg-white text-neutral-900 dark:border-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
                    style={{
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="flex items-center px-2"
                        style={{
                          width: cell.column.getSize(),
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
