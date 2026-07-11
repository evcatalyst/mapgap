/**
 * A self-contained MapLibre style. It has no raster/vector sources, sprites,
 * glyphs, Mapbox URL, or access token, so the alpha makes no third-party
 * basemap request. Partner deployments can add approved token-free sources by
 * replacing this explicit style rather than falling back to a default style.
 */
export const TOKEN_FREE_MAP_STYLE_ID = "mapgap-token-free";

export const TOKEN_FREE_MAP_STYLE = {
  version: 8,
  name: "MapGap token-free analysis canvas",
  sources: {},
  layers: [
    {
      id: "mapgap-background",
      type: "background",
      paint: { "background-color": "#edf4f7" },
    },
  ],
};

export const TOKEN_FREE_MAP_STYLES = [
  {
    id: TOKEN_FREE_MAP_STYLE_ID,
    label: "MapGap analysis canvas (no basemap token)",
    style: TOKEN_FREE_MAP_STYLE,
  },
];

export function isTokenFreeMapStyle(value: unknown) {
  const serialized = JSON.stringify(value).toLowerCase();
  return !/(mapbox|access[_-]?token|api[_-]?key|secret)/.test(serialized);
}
