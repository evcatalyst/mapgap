import {
  INTELLIGENCE_VIEW_SCHEMA_VERSION,
  assertIntelligenceViewV1,
  type MapGapIntelligenceViewV1,
} from "@mapgap/project-contract/intelligence";

const ALBANY_INTELLIGENCE_VIEW: MapGapIntelligenceViewV1 = {
  schemaVersion: INTELLIGENCE_VIEW_SCHEMA_VERSION,
  id: "albany-civic-intelligence-v1",
  title: "Albany civic access and housing",
  sources: [
    {
      id: "access",
      label: "Routed access",
      reference: { kind: "analysis-dataset", datasetId: "mapgap-analysis-access-surface-v1" },
      geometryTypes: ["Polygon", "MultiPolygon"],
      fields: [
        { name: "id", label: "Area ID", type: "string", nullable: false },
        { name: "minutes", label: "Travel time", type: "number", nullable: false },
        { name: "accessBand", label: "Access band", type: "string", nullable: false },
      ],
      idField: "id",
    },
    {
      id: "housing",
      label: "Housing intelligence",
      reference: { kind: "analysis-dataset", datasetId: "mapgap-analysis-housing-areas-v1" },
      geometryTypes: ["Polygon", "MultiPolygon"],
      fields: [
        { name: "geoid", label: "GEOID", type: "string", nullable: false },
        { name: "medianGrossRent", label: "Median gross rent", type: "number", nullable: true },
        { name: "rentBurdenPercent", label: "Rent burden", type: "number", nullable: true },
        { name: "rentBurdenBand", label: "Rent-burden band", type: "string", nullable: true },
      ],
      idField: "geoid",
    },
  ],
  layers: [
    {
      id: "access-isochrones",
      label: "Routed access",
      sourceId: "access",
      mark: "isochrone",
      visible: true,
      order: 0,
      opacity: 0.5,
      encodings: {
        fillColor: {
          kind: "field",
          field: "accessBand",
          scale: { type: "ordinal", domain: ["near", "middle", "gap"], range: ["#2a9d8f", "#f4a261", "#e76f51"] },
        },
      },
      filters: [{ id: "under-30", field: "minutes", operator: "lte", value: 30 }],
      legend: {
        visible: true,
        title: "Travel-time access",
        placement: "panel",
        missing: { label: "No routed result", color: "#cbd5e1" },
      },
      pickable: true,
      selectable: true,
    },
    {
      id: "housing-rent-burden",
      label: "Rent burden",
      sourceId: "housing",
      mark: "choropleth",
      visible: true,
      order: 1,
      opacity: 0.72,
      encodings: {
        fillColor: {
          kind: "field",
          field: "rentBurdenPercent",
          scale: { type: "threshold", domain: [25, 30, 35, 40], range: ["#e0f2fe", "#7dd3fc", "#38bdf8", "#0284c7", "#075985"] },
        },
        label: { kind: "field", field: "rentBurdenBand" },
      },
      filters: [{ id: "known-rent", field: "rentBurdenPercent", operator: "exists", value: true }],
      legend: {
        visible: true,
        title: "Rent-burden percentage",
        placement: "panel",
        missing: { label: "ACS estimate unavailable", color: "#d1d5db" },
      },
      pickable: true,
      selectable: true,
    },
  ],
  workspace: {
    title: "Location intelligence",
    layout: "adaptive",
    activeLayerId: "housing-rent-burden",
    layerPanel: "open",
    inspector: "closed",
    legendPlacement: "panel",
  },
  activeSelection: { sourceId: "housing", entityId: "36001000100", layerId: "housing-rent-burden" },
  viewport: { longitude: -73.79, latitude: 42.68, zoom: 9.8, bearing: 0, pitch: 0 },
  link: { target: "mapgap-v2", mode: "camera", direction: "from-target" },
};

export function getAlbanyIntelligenceViewFixture(): MapGapIntelligenceViewV1 {
  return assertIntelligenceViewV1(ALBANY_INTELLIGENCE_VIEW);
}
