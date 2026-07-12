import {expect, test} from "@playwright/test";
import {
  DUAL_MAP,
  SINGLE_MAP,
  extractSharedSelection,
  planComparisonTransition,
  type ComparisonPaneMasks,
  type KeplerComparisonState,
} from "../src/map/comparison-runtime";

const MASKS: ComparisonPaneMasks = {
  access: {
    "access-surface": true,
    housing: false,
    selection: true,
  },
  intelligence: {
    "access-surface": false,
    housing: true,
    selection: true,
  },
};

test("single access enters deterministic dual mode and restores exact pane masks", () => {
  const intents = planComparisonTransition(
    singleState({"access-surface": true, housing: false, selection: true}),
    "dual",
    MASKS,
  );

  expect(intents).toEqual([
    {kind: "set-global-layer-visibility", layerId: "housing", isVisible: true},
    {kind: "set-map-split-mode", mapSplitMode: DUAL_MAP},
    {kind: "toggle-layer-for-map", mapIndex: 0, layerId: "housing"},
    {kind: "toggle-layer-for-map", mapIndex: 1, layerId: "housing"},
    {kind: "toggle-layer-for-map", mapIndex: 1, layerId: "selection"},
  ]);
});

test("dual mode collapses to one intelligence canvas after global visibility is narrowed", () => {
  const intents = planComparisonTransition(dualState(), "single-intelligence", MASKS);

  expect(intents).toEqual([
    {kind: "set-global-layer-visibility", layerId: "access-surface", isVisible: false},
    {kind: "set-map-split-mode", mapSplitMode: SINGLE_MAP},
  ]);
});

test("single intelligence reconstructs dual masks instead of leaking its layers left", () => {
  const intents = planComparisonTransition(
    singleState({"access-surface": false, housing: true, selection: true}),
    "dual",
    MASKS,
  );

  expect(intents).toEqual([
    {kind: "set-global-layer-visibility", layerId: "access-surface", isVisible: true},
    {kind: "set-map-split-mode", mapSplitMode: DUAL_MAP},
    {kind: "toggle-layer-for-map", mapIndex: 0, layerId: "housing"},
    {kind: "toggle-layer-for-map", mapIndex: 1, layerId: "housing"},
    {kind: "toggle-layer-for-map", mapIndex: 1, layerId: "selection"},
  ]);
});

test("pane reconciliation removes a newly added intelligence layer from access", () => {
  const masks: ComparisonPaneMasks = {
    access: {...MASKS.access, transit: false},
    intelligence: {...MASKS.intelligence, transit: true},
  };
  const state = dualState();
  state.visState.layers = [
    ...state.visState.layers,
    {id: "transit", config: {isVisible: true}},
  ];
  state.visState.splitMaps = [
    {id: "access", layers: {...state.visState.splitMaps[0].layers, transit: true}},
    {id: "intelligence", layers: {...state.visState.splitMaps[1].layers, transit: true}},
  ];

  expect(planComparisonTransition(state, "dual", masks)).toEqual([
    {kind: "toggle-layer-for-map", mapIndex: 0, layerId: "transit"},
  ]);
});

test("already-correct dual state is a no-op and input masks remain unchanged", () => {
  const before = JSON.stringify(MASKS);
  expect(planComparisonTransition(dualState(), "dual", MASKS)).toEqual([]);
  expect(JSON.stringify(MASKS)).toBe(before);
});

test("incoherent split state is repaired before pane toggles", () => {
  const state = dualState();
  state.mapState.isSplit = false;
  state.visState.splitMaps = [];

  expect(planComparisonTransition(state, "dual", MASKS)).toEqual([
    {kind: "set-map-split-mode", mapSplitMode: SINGLE_MAP},
    {kind: "set-map-split-mode", mapSplitMode: DUAL_MAP},
    {kind: "toggle-layer-for-map", mapIndex: 0, layerId: "housing"},
    {kind: "toggle-layer-for-map", mapIndex: 1, layerId: "housing"},
    {kind: "toggle-layer-for-map", mapIndex: 1, layerId: "selection"},
  ]);
});

test("shared selection extracts a stable id, geometry, and coordinate from Kepler clicked", () => {
  expect(extractSharedSelection({
    clicked: {
      picked: true,
      layer: {id: "housing-polygons-fill"},
      coordinate: [-73.76, 42.65],
      object: {
        type: "Feature",
        geometry: {type: "Polygon", coordinates: []},
        properties: {entityId: "tract-001", medianRent: 1180, index: 0},
      },
    },
  })).toEqual({
    id: "tract-001",
    layerId: "housing-polygons-fill",
    coordinate: [-73.76, 42.65],
    geometry: {type: "Polygon", coordinates: []},
    properties: {entityId: "tract-001", medianRent: 1180, index: 0},
  });
});

test("shared selection rejects map clicks and unstable picked values", () => {
  expect(extractSharedSelection({clicked: null})).toBeNull();
  expect(extractSharedSelection({clicked: {picked: false, object: {id: "ignored"}}})).toBeNull();
  expect(extractSharedSelection({clicked: {picked: true, object: {properties: {index: 2}}}})).toBeNull();
});

function singleState(visibility: Record<string, boolean>): KeplerComparisonState {
  return {
    mapState: {isSplit: false, mapSplitMode: SINGLE_MAP},
    visState: {
      layers: Object.entries(visibility).map(([id, isVisible]) => ({id, config: {isVisible}})),
      splitMaps: [],
      clicked: null,
    },
  };
}

function dualState(): KeplerComparisonState {
  return {
    mapState: {isSplit: true, mapSplitMode: DUAL_MAP},
    visState: {
      layers: [
        {id: "access-surface", config: {isVisible: true}},
        {id: "housing", config: {isVisible: true}},
        {id: "selection", config: {isVisible: true}},
      ],
      splitMaps: [
        {id: "access", layers: {"access-surface": true, selection: true}},
        {id: "intelligence", layers: {housing: true, selection: true}},
      ],
      clicked: null,
    },
  };
}
