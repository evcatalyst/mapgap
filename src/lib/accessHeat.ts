export const ACCESS_HEAT_STOPS = [
  { minutes: 5, label: "5m", color: "#3b8798" },
  { minutes: 10, label: "10m", color: "#6fbda5" },
  { minutes: 15, label: "15m", color: "#c9e89f" },
  { minutes: 20, label: "20m", color: "#f4cf86" },
  { minutes: 25, label: "25m", color: "#ec9d70" },
  { minutes: 30, label: "30m", color: "#db7880" },
];

export function getAccessBucketColor(bucket: number) {
  const exact = ACCESS_HEAT_STOPS.find((stop) => stop.minutes === bucket);

  if (exact) {
    return exact.color;
  }

  const nearest = ACCESS_HEAT_STOPS.reduce((best, stop) =>
    Math.abs(stop.minutes - bucket) < Math.abs(best.minutes - bucket) ? stop : best,
  );

  return nearest.color;
}
