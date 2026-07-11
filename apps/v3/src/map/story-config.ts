import {MAPGAP_DATASET_IDS, type MapGapProjectV1} from "@mapgap/project-contract";

export type StoryId = "relocation" | "civic";

type LayerKind = "point" | "polygon";

type StoryLayer = {
  id: string;
  dataId: string;
  label: string;
  kind: LayerKind;
  color: [number, number, number];
  strokeColor?: [number, number, number];
  opacity?: number;
  radius?: number;
};

const RELOCATION_LAYERS: StoryLayer[] = [
  {
    id: "mapgap-relocation-access",
    dataId: MAPGAP_DATASET_IDS.isochrones,
    label: "30-minute routed access",
    kind: "polygon",
    color: [37, 99, 235],
    strokeColor: [30, 64, 175],
    opacity: 0.2,
  },
  {
    id: "mapgap-relocation-candidates",
    dataId: MAPGAP_DATASET_IDS.candidates,
    label: "Candidate locations",
    kind: "point",
    color: [234, 88, 12],
    radius: 18,
  },
  {
    id: "mapgap-relocation-anchors",
    dataId: MAPGAP_DATASET_IDS.points,
    label: "Profile anchors",
    kind: "point",
    color: [15, 118, 110],
    radius: 12,
  },
  {
    id: "mapgap-relocation-pois",
    dataId: MAPGAP_DATASET_IDS.pois,
    label: "Daily-life evidence",
    kind: "point",
    color: [22, 163, 74],
    radius: 9,
  },
];

const CIVIC_LAYERS: StoryLayer[] = [
  {
    id: "mapgap-civic-access",
    dataId: MAPGAP_DATASET_IDS.isochrones,
    label: "15-minute routed service area",
    kind: "polygon",
    color: [14, 116, 144],
    strokeColor: [8, 145, 178],
    opacity: 0.2,
  },
  {
    id: "mapgap-civic-underserved",
    dataId: MAPGAP_DATASET_IDS.underserved,
    label: "Underserved-capacity proxy",
    kind: "polygon",
    color: [249, 115, 22],
    strokeColor: [194, 65, 12],
    opacity: 0.3,
  },
  {
    id: "mapgap-civic-assets",
    dataId: MAPGAP_DATASET_IDS.assets,
    label: "Civic assets",
    kind: "point",
    color: [126, 34, 206],
    radius: 18,
  },
  {
    id: "mapgap-civic-anchor",
    dataId: MAPGAP_DATASET_IDS.points,
    label: "Service anchor",
    kind: "point",
    color: [15, 118, 110],
    radius: 11,
  },
];

export function getStoryLayers(storyId: StoryId, project: MapGapProjectV1) {
  const available = new Set<string>();
  if (project.points.length) available.add(MAPGAP_DATASET_IDS.points);
  if (project.isochrones.length) available.add(MAPGAP_DATASET_IDS.isochrones);
  if (project.poiLayers.some((layer) => layer.points.length)) available.add(MAPGAP_DATASET_IDS.pois);
  if (project.candidates.length) available.add(MAPGAP_DATASET_IDS.candidates);
  if (project.civic.assets.length) available.add(MAPGAP_DATASET_IDS.assets);
  if (project.civic.underservedAreas.length) available.add(MAPGAP_DATASET_IDS.underserved);
  return (storyId === "relocation" ? RELOCATION_LAYERS : CIVIC_LAYERS).filter((layer) =>
    available.has(layer.dataId),
  );
}

export function getStoryMapConfig(storyId: StoryId, project: MapGapProjectV1) {
  const layers = getStoryLayers(storyId, project);
  const mapState = storyId === "relocation"
    ? {bearing: 0, dragRotate: false, latitude: 40.7255, longitude: -74.075, pitch: 0, zoom: 11.75}
    : {bearing: 0, dragRotate: false, latitude: 42.668, longitude: -73.778, pitch: 0, zoom: 11.9};

  return {
    version: "v1" as const,
    config: {
      visState: {
        filters: [],
        layers: layers.map(toKeplerLayer),
        interactionConfig: {
          tooltip: {
            fieldsToShow: Object.fromEntries(
              layers.map((layer) => [layer.dataId, tooltipFields(layer.dataId).map((name) => ({name, format: null}))]),
            ),
            compareMode: false,
            compareType: "absolute",
            enabled: true,
          },
        },
        layerBlending: "normal",
      },
      mapState,
    },
  };
}

function toKeplerLayer(layer: StoryLayer) {
  const polygon = layer.kind === "polygon";
  return {
    id: layer.id,
    type: "geojson",
    config: {
      dataId: layer.dataId,
      label: layer.label,
      color: layer.color,
      columns: {geojson: "_geojson"},
      isVisible: true,
      visConfig: {
        opacity: layer.opacity ?? 0.9,
        thickness: polygon ? 2.5 : 1,
        strokeColor: layer.strokeColor ?? [255, 255, 255],
        radius: layer.radius ?? 10,
        sizeRange: [0, 10],
        radiusRange: [0, 50],
        heightRange: [0, 500],
        elevationScale: 5,
        stroked: true,
        filled: true,
        enable3d: false,
        wireframe: false,
      },
    },
    visualChannels: {
      colorField: null,
      colorScale: "quantile",
      sizeField: null,
      sizeScale: "linear",
      strokeColorField: null,
      strokeColorScale: "quantile",
      heightField: null,
      heightScale: "linear",
      radiusField: null,
      radiusScale: "linear",
    },
  };
}

function tooltipFields(dataId: string) {
  switch (dataId) {
    case MAPGAP_DATASET_IDS.candidates:
      return ["label", "totalScore", "failedConstraints"];
    case MAPGAP_DATASET_IDS.assets:
      return ["name", "capacity", "utilizationPercent", "hoursOpen"];
    case MAPGAP_DATASET_IDS.underserved:
      return ["underservedScore", "reachableCapacity", "evidence"];
    case MAPGAP_DATASET_IDS.isochrones:
      return ["pointName", "timeMinutes", "routingProvider", "mobilityMode"];
    default:
      return ["name", "provenanceLabel"];
  }
}
