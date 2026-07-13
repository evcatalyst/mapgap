import {expect, test} from "@playwright/test";
import {V2_CONTEXT_MAX_BYTES, V2_CONTEXT_SCHEMA, validateV2ContextEvent} from "../src/bridge/v2-context";

const source = {} as Window;
const valid = {
  schema: V2_CONTEXT_SCHEMA,
  revision: 7,
  context: {
    bbox: [-74.2, 40.5, -73.6, 41],
    category: "library",
    activeExtensions: [],
    selectedPointId: null,
    servicePoints: [{id: "library-1", name: "Library", category: "library", location: {lat: 40.7, lng: -74}, source: "official_local"}],
    isochrones: [],
    heatmapMode: "walk",
  },
};

test("host accepts only the exact source, origin, schema and monotonic revision", () => {
  expect(parse(valid, 6)).toMatchObject({ok: true, value: {revision: 7}});
  expect(parse(valid, 7)).toEqual({ok: false, reason: "revision"});
  expect(validateV2ContextEvent({event: {...event(valid), origin: "https://evil.example"}, expectedOrigin: "https://mapgap-access.netlify.app", expectedSource: source, lastRevision: 0})).toEqual({ok: false, reason: "origin"});
  expect(validateV2ContextEvent({event: {...event(valid), source: {} as Window}, expectedOrigin: "https://mapgap-access.netlify.app", expectedSource: source, lastRevision: 0})).toEqual({ok: false, reason: "source"});
});

test("host rejects extra state and invalid provider coordinates", () => {
  expect(parse({...valid, internalStore: {token: "secret"}}, 0)).toEqual({ok: false, reason: "shape"});
  const invalid = structuredClone(valid);
  invalid.context.servicePoints[0].location.lat = 900;
  expect(parse(invalid, 0)).toEqual({ok: false, reason: "shape"});
});

test("host rejects oversized envelopes before attempting schema projection", () => {
  const oversized = {...valid, padding: "x".repeat(V2_CONTEXT_MAX_BYTES)};
  expect(parse(oversized, 0)).toEqual({ok: false, reason: "bytes"});
});

function parse(data: unknown, lastRevision: number) {
  return validateV2ContextEvent({event: event(data), expectedOrigin: "https://mapgap-access.netlify.app", expectedSource: source, lastRevision});
}

function event(data: unknown) {
  return {data, origin: "https://mapgap-access.netlify.app", source} as MessageEvent<unknown>;
}
