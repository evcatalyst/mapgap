import { expect, test } from "@playwright/test";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = {
  GOOGLE_PLACES_API_KEY: process.env.GOOGLE_PLACES_API_KEY,
  NY_LIBRARY_ARCGIS_URL: process.env.NY_LIBRARY_ARCGIS_URL,
  NY_LIBRARIES_ARCGIS_URL: process.env.NY_LIBRARIES_ARCGIS_URL,
  NY_LIBRARY_ARCGIS_ITEM_ID: process.env.NY_LIBRARY_ARCGIS_ITEM_ID,
};

type MockFeatureInput = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  city?: string;
  state?: string;
};

function arcgisFeature(input: MockFeatureInput) {
  return {
    attributes: {
      OBJECTID: input.id,
      NAME: input.name,
      ADDRESS: input.address || "100 Main St",
      CITY: input.city || "Test City",
      STATE: input.state,
      ZIP: "10000",
    },
    geometry: {
      x: input.lng,
      y: input.lat,
    },
  };
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

async function importHandler() {
  const module = await import(
    `../netlify/functions/service-points.mjs?test=${Date.now()}-${Math.random()}`
  );
  return module.handler as (event: {
    httpMethod: string;
    queryStringParameters?: Record<string, string>;
  }) => Promise<{ statusCode: number; body: string }>;
}

async function callServicePoints(queryStringParameters: Record<string, string>) {
  const handler = await importHandler();
  const response = await handler({
    httpMethod: "GET",
    queryStringParameters,
  });

  return {
    response,
    body: JSON.parse(response.body) as {
      category: string;
      label?: string;
      query?: string;
      count: number;
      sources: string[];
      warnings?: string[];
      points: Array<{
        id: string;
        name: string;
        source: string;
        category: string;
        location: { lat: number; lng: number };
        provenance?: { label?: string; datasetId?: string };
      }>;
    },
  };
}

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  restoreEnv("GOOGLE_PLACES_API_KEY", ORIGINAL_ENV.GOOGLE_PLACES_API_KEY);
  restoreEnv("NY_LIBRARY_ARCGIS_URL", ORIGINAL_ENV.NY_LIBRARY_ARCGIS_URL);
  restoreEnv("NY_LIBRARIES_ARCGIS_URL", ORIGINAL_ENV.NY_LIBRARIES_ARCGIS_URL);
  restoreEnv("NY_LIBRARY_ARCGIS_ITEM_ID", ORIGINAL_ENV.NY_LIBRARY_ARCGIS_ITEM_ID);
});

test("service-points returns NJ open-data libraries from the default ArcGIS item", async () => {
  delete process.env.NY_LIBRARY_ARCGIS_URL;
  delete process.env.NY_LIBRARIES_ARCGIS_URL;
  delete process.env.NY_LIBRARY_ARCGIS_ITEM_ID;
  delete process.env.GOOGLE_PLACES_API_KEY;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/sharing/rest/content/items/9341dca37cdf4f258f2df6ae439f5be4")) {
      return jsonResponse({
        url: "https://services.example.test/nj/arcgis/rest/services/Libraries_2023/FeatureServer",
      });
    }

    if (url === "https://services.example.test/nj/arcgis/rest/services/Libraries_2023/FeatureServer?f=json") {
      return jsonResponse({
        layers: [{ id: 11, geometryType: "esriGeometryPoint", name: "Libraries_2025" }],
      });
    }

    if (url.includes("/nj/arcgis/rest/services/Libraries_2023/FeatureServer/11/query")) {
      return jsonResponse({
        features: [
          arcgisFeature({
            id: 1,
            name: "Trenton Free Public Library",
            lat: 40.221,
            lng: -74.763,
            state: "NJ",
          }),
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "library",
    bbox: "-74.80,40.18,-74.70,40.25",
  });

  expect(response.statusCode).toBe(200);
  expect(body.count).toBe(1);
  expect(body.sources).toEqual(["nj_libraries"]);
  expect(body.points[0].source).toBe("nj_libraries");
  expect(body.points[0].provenance?.label).toBe("NJ Open Data");
  expect(body.warnings || []).toEqual([]);
});

test("service-points returns configured NY open-data libraries", async () => {
  process.env.NY_LIBRARY_ARCGIS_URL =
    "https://services.example.test/ny/arcgis/rest/services/Public_Libraries/FeatureServer";
  delete process.env.GOOGLE_PLACES_API_KEY;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url === "https://services.example.test/ny/arcgis/rest/services/Public_Libraries/FeatureServer?f=json") {
      return jsonResponse({
        layers: [{ id: 7, geometryType: "esriGeometryPoint", name: "Public Libraries" }],
      });
    }

    if (url.includes("/ny/arcgis/rest/services/Public_Libraries/FeatureServer/7/query")) {
      return jsonResponse({
        features: [
          arcgisFeature({
            id: 2,
            name: "Albany Public Library",
            lat: 42.6526,
            lng: -73.7562,
            state: "NY",
          }),
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "library",
    bbox: "-73.79,42.63,-73.73,42.68",
  });

  expect(response.statusCode).toBe(200);
  expect(body.count).toBe(1);
  expect(body.sources).toEqual(["ny_libraries"]);
  expect(body.points[0].source).toBe("ny_libraries");
  expect(body.points[0].provenance?.label).toBe("NY Open Data");
});

test("service-points uses the official NYS ITS library layer by default", async () => {
  delete process.env.NY_LIBRARY_ARCGIS_URL;
  delete process.env.NY_LIBRARIES_ARCGIS_URL;
  delete process.env.NY_LIBRARY_ARCGIS_ITEM_ID;
  delete process.env.GOOGLE_PLACES_API_KEY;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/NYS_Schools/FeatureServer/15/query")) {
      return jsonResponse({
        features: [
          {
            attributes: {
              OBJECTID: 66,
              LEGAL_NAME: "ALBANY PUBLIC LIBRARY",
              PHYSADDRLINE1: "161 WASHINGTON AVE",
              PHYSCITY: "ALBANY",
              PHYSICALSTATE: "NY",
              PHYSZIPCD5: "12210",
              CEO_PHONENUM: "5184274379",
            },
            geometry: { x: -73.7621, y: 42.6566 },
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "library",
    bbox: "-73.79,42.63,-73.73,42.68",
  });

  expect(response.statusCode).toBe(200);
  expect(body.count).toBe(1);
  expect(body.sources).toEqual(["ny_libraries"]);
  expect(body.points[0].name).toBe("ALBANY PUBLIC LIBRARY");
  expect(body.points[0].provenance?.datasetId).toBe("b6c624c740e4476689aa60fdc4aacb8f");
});

test("service-points combines NY and NJ library sources for border viewports", async () => {
  process.env.NY_LIBRARY_ARCGIS_URL =
    "https://services.example.test/ny/arcgis/rest/services/Public_Libraries/FeatureServer";
  delete process.env.GOOGLE_PLACES_API_KEY;

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/sharing/rest/content/items/9341dca37cdf4f258f2df6ae439f5be4")) {
      return jsonResponse({
        url: "https://services.example.test/nj/arcgis/rest/services/Libraries_2023/FeatureServer",
      });
    }

    if (url === "https://services.example.test/ny/arcgis/rest/services/Public_Libraries/FeatureServer?f=json") {
      return jsonResponse({
        layers: [{ id: 7, geometryType: "esriGeometryPoint", name: "Public Libraries" }],
      });
    }

    if (url === "https://services.example.test/nj/arcgis/rest/services/Libraries_2023/FeatureServer?f=json") {
      return jsonResponse({
        layers: [{ id: 11, geometryType: "esriGeometryPoint", name: "Libraries_2025" }],
      });
    }

    if (url.includes("/ny/arcgis/rest/services/Public_Libraries/FeatureServer/7/query")) {
      return jsonResponse({
        features: [
          arcgisFeature({
            id: 3,
            name: "Battery Park City Library",
            lat: 40.7118,
            lng: -74.0159,
            state: "NY",
          }),
        ],
      });
    }

    if (url.includes("/nj/arcgis/rest/services/Libraries_2023/FeatureServer/11/query")) {
      return jsonResponse({
        features: [
          arcgisFeature({
            id: 4,
            name: "Jersey City Free Public Library",
            lat: 40.7178,
            lng: -74.0431,
            state: "NJ",
          }),
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "library",
    bbox: "-74.06,40.70,-73.98,40.73",
  });

  expect(response.statusCode).toBe(200);
  expect(body.count).toBe(2);
  expect(body.sources).toEqual(["nj_libraries", "ny_libraries"]);
  expect(body.points.map((point) => point.source).sort()).toEqual([
    "nj_libraries",
    "ny_libraries",
  ]);
});

test("service-points falls back to Google Places when official library sources are unavailable", async () => {
  delete process.env.NY_LIBRARY_ARCGIS_URL;
  delete process.env.NY_LIBRARIES_ARCGIS_URL;
  delete process.env.NY_LIBRARY_ARCGIS_ITEM_ID;
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/sharing/rest/content/items/9341dca37cdf4f258f2df6ae439f5be4")) {
      return jsonResponse({ url: undefined });
    }

    if (url.includes("places.googleapis.com/v1/places:searchNearby")) {
      return jsonResponse({
        places: [
          {
            id: "google-library-1",
            displayName: { text: "Fallback Public Library" },
            formattedAddress: "1 Library Way",
            location: { latitude: 40.221, longitude: -74.763 },
            types: ["library"],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "library",
    bbox: "-74.80,40.18,-74.70,40.25",
  });

  expect(response.statusCode).toBe(200);
  expect(body.count).toBe(1);
  expect(body.sources).toEqual(["google_places"]);
  expect(body.points[0].source).toBe("google_places");
  expect(body.warnings || []).toContain(
    "Official NY/NJ open data temporarily unavailable - showing Google Places backup.",
  );
});

test("service-points supports custom Google text-search categories", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";
  let requestBody: { textQuery?: string } | undefined;

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("places.googleapis.com/v1/places:searchText")) {
      requestBody = JSON.parse(String(init?.body || "{}"));

      return jsonResponse({
        places: [
          {
            id: "google-pharmacy-1",
            displayName: { text: "Neighborhood Pharmacy" },
            formattedAddress: "10 Main St",
            location: { latitude: 40.722, longitude: -74.045 },
            types: ["pharmacy"],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "custom",
    q: "pharmacies",
    bbox: "-74.08,40.68,-74.02,40.74",
  });

  expect(response.statusCode).toBe(200);
  expect(requestBody?.textQuery).toBe("pharmacies");
  expect(body.category).toBe("custom");
  expect(body.label).toBe("pharmacies");
  expect(body.count).toBe(1);
  expect(body.sources).toEqual(["google_places"]);
  expect(body.points[0].category).toBe("custom");
  expect(body.points[0].name).toBe("Neighborhood Pharmacy");
  expect(body.warnings || []).toContain(
    "Custom categories use Google Places provider matching. Verify result relevance.",
  );
});

test("service-points excludes cleaning services and dry-clean-only laundry results", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("places.googleapis.com/v1/places:searchText")) {
      return jsonResponse({
        places: [
          {
            id: "real-laundry",
            displayName: { text: "Journal Square Laundromat" },
            formattedAddress: "1 Newark Ave",
            location: { latitude: 40.722, longitude: -74.045 },
            types: ["laundry"],
          },
          {
            id: "carpet-cleaner",
            displayName: { text: "Hudson Carpet Cleaning" },
            formattedAddress: "2 Newark Ave",
            location: { latitude: 40.723, longitude: -74.044 },
            types: ["laundry", "service"],
          },
          {
            id: "dry-cleaner",
            displayName: { text: "City Dry Cleaners" },
            formattedAddress: "3 Newark Ave",
            location: { latitude: 40.724, longitude: -74.043 },
            types: ["laundry"],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { body } = await callServicePoints({
    category: "laundry",
    bbox: "-74.08,40.68,-74.02,40.74",
  });

  expect(body.points.map((point) => point.name)).toEqual(["Journal Square Laundromat"]);
});

test("service-points library fallback rejects academic and mislabeled places", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("/sharing/rest/content/items/9341dca37cdf4f258f2df6ae439f5be4")) {
      return jsonResponse({ url: undefined });
    }

    if (url.includes("places.googleapis.com/v1/places:searchNearby")) {
      return jsonResponse({
        places: [
          {
            id: "public-library",
            displayName: { text: "Trenton Free Public Library" },
            formattedAddress: "120 Academy St",
            location: { latitude: 40.222, longitude: -74.764 },
            types: ["library"],
          },
          {
            id: "graduate-library",
            displayName: { text: "Dewey Graduate Library" },
            formattedAddress: "135 Western Ave",
            location: { latitude: 40.223, longitude: -74.763 },
            types: ["library"],
          },
          {
            id: "sculpture",
            displayName: { text: "Sculpture" },
            formattedAddress: "221 Madison Ave",
            location: { latitude: 40.224, longitude: -74.762 },
            types: ["library", "museum", "tourist_attraction"],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { body } = await callServicePoints({
    category: "library",
    bbox: "-74.80,40.18,-74.70,40.25",
  });

  expect(body.points.map((point) => point.name)).toEqual(["Trenton Free Public Library"]);
});

function restoreEnv(name: string, value?: string) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
