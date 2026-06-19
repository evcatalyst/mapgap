export type WaterBarrier = {
  id: string;
  name: string;
  kind: "corridor" | "polygon";
  coordinates: Array<[number, number]>;
  widthPx?: number;
  minWidthPx?: number;
  maxWidthPx?: number;
};

export const WATER_BARRIERS: WaterBarrier[] = [
  {
    id: "mohawk-river-capital-region",
    name: "Mohawk River corridor",
    kind: "corridor",
    widthPx: 34,
    minWidthPx: 18,
    maxWidthPx: 96,
    coordinates: [
      [-73.930, 42.807],
      [-73.905, 42.801],
      [-73.880, 42.790],
      [-73.854, 42.779],
      [-73.828, 42.769],
      [-73.803, 42.761],
      [-73.778, 42.758],
      [-73.752, 42.759],
      [-73.724, 42.768],
      [-73.696, 42.781],
      [-73.665, 42.795],
    ],
  },
  {
    id: "hudson-river-jersey-city",
    name: "Hudson River corridor",
    kind: "corridor",
    widthPx: 52,
    minWidthPx: 28,
    maxWidthPx: 140,
    coordinates: [
      [-74.055, 40.765],
      [-74.034, 40.753],
      [-74.018, 40.730],
      [-74.011, 40.705],
      [-74.015, 40.678],
      [-74.034, 40.656],
    ],
  },
  {
    id: "upper-new-york-bay",
    name: "Upper New York Bay",
    kind: "polygon",
    coordinates: [
      [-74.095, 40.705],
      [-74.020, 40.695],
      [-73.995, 40.655],
      [-74.025, 40.610],
      [-74.110, 40.605],
      [-74.165, 40.635],
      [-74.160, 40.685],
      [-74.095, 40.705],
    ],
  },
];
