import { expect, test } from "@playwright/test";
import type { IsochroneFeature, ServicePoint } from "../src/types";
import {
  createV2ContextPublisher,
  DEFAULT_V3_HOST_ORIGIN,
  getV2ContextPayloadBytes,
  makeV2ContextMessage,
  resolveV2BridgeTargetOrigin,
  V2_CONTEXT_MAX_BYTES,
  V2_CONTEXT_MAX_ISOCHRONES,
  V2_CONTEXT_MAX_POINTS,
  V2_CONTEXT_SCHEMA,
  V2_READY_SCHEMA,
  type V2BridgeHost,
  type V2ContextInput,
  type V2ContextMessage,
  type V2ReadyMessage,
} from "../src/lib/v2ContextBridge";

type PostedMessage = {
  message: V2ContextMessage | V2ReadyMessage;
  targetOrigin: string;
};

function makePoint(overrides: Partial<ServicePoint> = {}): ServicePoint {
  return {
    id: "point-1",
    name: "Northside Library",
    category: "library",
    categoryLabel: "Libraries",
    location: { lat: 42.81, lng: -73.89 },
    source: "official_local",
    address: "100 Main Street",
    phone: "SECRET-PHONE",
    website: "https://example.test/?token=SECRET-TOKEN",
    sourceUrl: "https://private.example.test/source",
    sourceDatasetId: "albany-libraries",
    sourceUpdatedAt: "2026-07-01",
    rawData: { apiKey: "SECRET-RAW-KEY" },
    provenance: { note: "SECRET-NOTE" },
    ...overrides,
  };
}

function makeIsochrone(coordinates?: Array<[number, number]>): IsochroneFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        coordinates || [
          [-73.91, 42.8],
          [-73.88, 42.8],
          [-73.88, 42.83],
          [-73.91, 42.8],
        ],
      ],
    },
    properties: {
      id: "iso-1",
      pointId: "point-1",
      pointName: "Northside Library",
      color: "#047857",
      timeMinutes: 15,
      bucketMinutes: 15,
      adjustedMinutes: 15,
      effortScore: 1,
      mobilityMode: "walk",
      transportMode: "foot-walking",
      routingProvider: "ors",
      isochroneMode: "individual",
    },
  };
}

function makeInput(overrides: Partial<V2ContextInput> = {}): V2ContextInput {
  return {
    bounds: { west: -74, south: 42.7, east: -73.7, north: 42.9 },
    category: "library",
    query: "public libraries",
    activeExtensions: ["computer_labs"],
    selectedPointId: "point-1",
    servicePoints: [makePoint()],
    isochrones: [makeIsochrone()],
    heatmapMode: "walk",
    ...overrides,
  };
}

function makeEmbeddedHost() {
  const messages: PostedMessage[] = [];
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const parent = {
    postMessage(message: V2ContextMessage | V2ReadyMessage, targetOrigin: string) {
      messages.push({ message, targetOrigin });
    },
  };
  const host: V2BridgeHost = {
    parent,
    setTimeout(handler) {
      timerId += 1;
      timers.set(timerId, handler);
      return timerId;
    },
    clearTimeout(handle) {
      if (handle !== undefined) {
        timers.delete(handle);
      }
    },
  };

  return {
    host,
    messages,
    timers,
    flushTimers() {
      const pending = Array.from(timers.values());
      timers.clear();
      pending.forEach((handler) => handler());
    },
  };
}

test("standalone V2 never posts context", () => {
  const messages: PostedMessage[] = [];
  const host = {
    parent: undefined as unknown,
    setTimeout: () => 1,
    clearTimeout: () => undefined,
    postMessage(message: V2ContextMessage | V2ReadyMessage, targetOrigin: string) {
      messages.push({ message, targetOrigin });
    },
  } as unknown as V2BridgeHost & { parent: V2BridgeHost };
  host.parent = host;

  const publisher = createV2ContextPublisher({ host, targetOrigin: DEFAULT_V3_HOST_ORIGIN });
  publisher.ready();
  publisher.publish(makeInput());

  expect(publisher.embedded).toBe(false);
  expect(messages).toEqual([]);
});

test("embedded V2 posts only a sanitized, capped contract to the exact origin", () => {
  const fixture = makeEmbeddedHost();
  const publisher = createV2ContextPublisher({
    host: fixture.host,
    targetOrigin: "https://mapgap-v3-preview.netlify.app",
  });

  publisher.ready();
  publisher.publish(makeInput());

  expect(fixture.messages).toHaveLength(2);
  expect(fixture.messages[0]).toEqual({
    message: { schema: V2_READY_SCHEMA, contextSchema: V2_CONTEXT_SCHEMA },
    targetOrigin: DEFAULT_V3_HOST_ORIGIN,
  });

  const posted = fixture.messages[1];
  expect(posted.targetOrigin).toBe(DEFAULT_V3_HOST_ORIGIN);
  expect(posted.message.schema).toBe(V2_CONTEXT_SCHEMA);

  const message = posted.message as V2ContextMessage;
  expect(message.revision).toBeGreaterThan(0);
  expect(message.context.bbox).toEqual([-74, 42.7, -73.7, 42.9]);
  expect(message.context.servicePoints[0]).toEqual({
    id: "point-1",
    name: "Northside Library",
    category: "library",
    categoryLabel: "Libraries",
    location: { lat: 42.81, lng: -73.89 },
    source: "official_local",
    address: "100 Main Street",
    sourceDatasetId: "albany-libraries",
    sourceUpdatedAt: "2026-07-01",
  });
  expect(JSON.stringify(message)).not.toContain("SECRET");
  expect(getV2ContextPayloadBytes(message)).toBeLessThanOrEqual(V2_CONTEXT_MAX_BYTES);
});

test("viewport churn debounces while selection and heat changes publish immediately", () => {
  const fixture = makeEmbeddedHost();
  const publisher = createV2ContextPublisher({
    host: fixture.host,
    targetOrigin: DEFAULT_V3_HOST_ORIGIN,
    debounceMs: 25,
  });

  publisher.publish(makeInput({ bounds: { west: -74, south: 42, east: -73, north: 43 } }), "viewport");
  publisher.publish(
    makeInput({ bounds: { west: -75, south: 41, east: -72, north: 44 } }),
    "viewport",
  );

  expect(fixture.messages).toEqual([]);
  expect(fixture.timers.size).toBe(1);

  fixture.flushTimers();

  expect(fixture.messages).toHaveLength(1);
  const viewportMessage = fixture.messages[0].message as V2ContextMessage;
  expect(viewportMessage.context.bbox).toEqual([-75, 41, -72, 44]);

  publisher.publish(makeInput({ selectedPointId: "point-2", heatmapMode: "drive" }), "immediate");

  expect(fixture.messages).toHaveLength(2);
  const immediateMessage = fixture.messages[1].message as V2ContextMessage;
  expect(immediateMessage.revision).toBeGreaterThan(viewportMessage.revision);
  expect(immediateMessage.context.selectedPointId).toBe("point-2");
  expect(immediateMessage.context.heatmapMode).toBe("drive");
});

test("contract enforces record, geometry and total byte limits", () => {
  const points = Array.from({ length: V2_CONTEXT_MAX_POINTS + 20 }, (_, index) =>
    makePoint({ id: `point-${index}`, name: `Point ${index}` }),
  );
  const oversizedRing = Array.from({ length: 20_000 }, (_, index): [number, number] => [
    -73.9 + (index % 100) * 0.00000123456789,
    42.8 + (index % 100) * 0.00000123456789,
  ]);
  const isochrones = Array.from({ length: V2_CONTEXT_MAX_ISOCHRONES + 5 }, (_, index) => ({
    ...makeIsochrone(index === 0 ? oversizedRing : undefined),
    properties: { ...makeIsochrone().properties, id: `iso-${index}` },
  }));

  const message = makeV2ContextMessage(makeInput({ servicePoints: points, isochrones }), 99);

  expect(message.context.servicePoints.length).toBeLessThanOrEqual(V2_CONTEXT_MAX_POINTS);
  expect(message.context.isochrones.length).toBeLessThanOrEqual(V2_CONTEXT_MAX_ISOCHRONES);
  expect(getV2ContextPayloadBytes(message)).toBeLessThanOrEqual(V2_CONTEXT_MAX_BYTES);
});

test("invalid evidence coordinates are dropped rather than moved to world edges", () => {
  const invalidPoints = [
    makePoint({id: "too-far", location: {lat: 123, lng: -73.9}}),
    makePoint({id: "infinite", location: {lat: 42.8, lng: Number.POSITIVE_INFINITY}}),
    makePoint({id: "nan", location: {lat: Number.NaN, lng: -73.9}}),
  ];
  const invalidIsochrone = makeIsochrone([
    [-999, 999],
    [-998, 999],
    [-998, 998],
    [-999, 999],
  ]);

  const message = makeV2ContextMessage(makeInput({
    servicePoints: [makePoint(), ...invalidPoints],
    isochrones: [invalidIsochrone],
  }), 101);

  expect(message.context.servicePoints.map((point) => point.id)).toEqual(["point-1"]);
  expect(message.context.isochrones).toEqual([]);
});

test("bridge target configuration accepts only exact secure origins or local development", () => {
  expect(resolveV2BridgeTargetOrigin()).toBe(DEFAULT_V3_HOST_ORIGIN);
  expect(resolveV2BridgeTargetOrigin("https://intelligence.mapgap.app/")).toBe(
    "https://intelligence.mapgap.app",
  );
  expect(resolveV2BridgeTargetOrigin("http://127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
  expect(resolveV2BridgeTargetOrigin("https://*.mapgap.app")).toBeNull();
  expect(resolveV2BridgeTargetOrigin("https://mapgap.app/embed")).toBeNull();
  expect(resolveV2BridgeTargetOrigin("http://mapgap.app")).toBeNull();
  expect(resolveV2BridgeTargetOrigin("javascript:alert(1)")).toBeNull();
});
