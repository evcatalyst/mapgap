export function formatCoordinate(value: number) {
  return value.toFixed(5);
}

export function formatTransportLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
