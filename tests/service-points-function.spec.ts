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
  let fieldMask = "";

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("places.googleapis.com/v1/places:searchText")) {
      requestBody = JSON.parse(String(init?.body || "{}"));
      fieldMask = String((init?.headers as Record<string, string>)?.["X-Goog-FieldMask"] || "");

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
  expect(fieldMask).toContain("places.displayName");
  expect(fieldMask).not.toContain("places.currentOpeningHours");
  expect(fieldMask).not.toContain("places.nationalPhoneNumber");
  expect(fieldMask).not.toContain("places.websiteUri");
  expect(body.warnings || []).toContain(
    "Custom categories use Google Places provider matching. Verify result relevance.",
  );
});

test("service-points uses typed OSM dog parks and verifies the Blatnick Park facility", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";
  let googleCalls = 0;
  const overpassCalls: string[] = [];

  globalThis.fetch = async (input) => {
    const url = String(input);

    if (url.includes("overpass")) {
      overpassCalls.push(url);

      if (url.includes("maps.mail.ru")) {
        return jsonResponse({}, false, 504);
      }

      return jsonResponse({
        elements: [
          {
            type: "way",
            id: 485187501,
            center: { lat: 42.8136451, lon: -73.8623708 },
            tags: {
              access: "permit",
              barrier: "fence",
              leisure: "dog_park",
              name: "Niskayuna Dog Park",
              operator: "Town of Niskayuna",
            },
          },
          {
            type: "way",
            id: 1107096494,
            center: { lat: 42.7963218, lon: -73.744202 },
            tags: { leisure: "dog_park" },
          },
          {
            type: "way",
            id: 999,
            center: { lat: 42.8019098, lon: -73.8626843 },
            tags: { leisure: "park", name: "River Road Town Park" },
          },
          {
            type: "way",
            id: 1000,
            center: { lat: 42.781, lon: -73.81 },
            tags: { dog: "leashed", leisure: "park", name: "Leash-Friendly Community Park" },
          },
          {
            type: "way",
            id: 1001,
            center: { lat: 42.782, lon: -73.812 },
            tags: { dog: "yes", leisure: "park", name: "Dog-Friendly Neighborhood Park" },
          },
          {
            type: "way",
            id: 1002,
            center: { lat: 42.783, lon: -73.813 },
            tags: { dog: "no", leisure: "park", name: "No Dogs Park" },
          },
        ],
      });
    }

    if (url.includes("places.googleapis.com")) {
      googleCalls += 1;
      return jsonResponse({ places: [] });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { response, body } = await callServicePoints({
    category: "custom",
    q: "dog parks",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(response.statusCode).toBe(200);
  expect(googleCalls).toBe(0);
  expect(overpassCalls).toHaveLength(2);
  expect(decodeURIComponent(overpassCalls[1])).toContain('["dog"~"^(yes|leashed)$"]');
  expect(body.count).toBe(2);
  expect(body.sources).toEqual(["official_local", "openstreetmap"]);
  expect(body.extensions.map((extension) => extension.id)).toEqual([
    "leashed_parks",
    "dog_friendly_parks",
  ]);
  expect(body.points[0]).toMatchObject({
    name: "Niskayuna Dog Park (Blatnick Park)",
    source: "official_local",
    category: "custom",
  });
  expect(body.points.map((point) => point.name)).not.toContain("River Road Town Park");
  expect(body.points[1]).toMatchObject({
    name: "Town of Colonie Dog Park",
    source: "openstreetmap",
    match: { tier: "primary" },
  });
  expect(body.warnings || []).toEqual([]);

  const extended = await callServicePoints({
    category: "custom",
    q: "dog parks",
    include: "leashed_parks",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(googleCalls).toBe(0);
  expect(overpassCalls).toHaveLength(4);
  expect(extended.body.count).toBe(3);
  expect(extended.body.activeExtensions).toEqual(["leashed_parks"]);
  expect(extended.body.points[2]).toMatchObject({
    name: "Leash-Friendly Community Park",
    source: "openstreetmap",
    categoryLabel: "Dog-friendly parks",
    match: {
      tier: "related",
      extensionId: "leashed_parks",
      conditions: ["Leash required", "Not a dedicated dog park"],
    },
  });
  expect(extended.body.warnings || []).toContain(
    "Extended with 1 park where mapped dog-access rules apply. Dedicated dog parks remain first.",
  );

  const broader = await callServicePoints({
    category: "custom",
    q: "dog parks",
    include: "dog_friendly_parks",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(googleCalls).toBe(0);
  expect(overpassCalls).toHaveLength(6);
  expect(broader.body.points.map((point) => point.name)).toEqual([
    "Niskayuna Dog Park (Blatnick Park)",
    "Town of Colonie Dog Park",
    "Dog-Friendly Neighborhood Park",
  ]);
  expect(broader.body.points[2].match).toMatchObject({
    tier: "fallback",
    extensionId: "dog_friendly_parks",
    conditions: ["Verify local leash rules", "Not a dedicated dog park"],
  });
  expect(broader.body.points.map((point) => point.name)).not.toContain("No Dogs Park");
});

test("grocery result extensions are opt-in and keep convenience stores separate", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";
  const requestedTypes: string[][] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("places.googleapis.com/v1/places:searchNearby")) {
      const requestBody = JSON.parse(String(init?.body || "{}"));
      requestedTypes.push(requestBody.includedTypes || []);

      return jsonResponse({
        places: [
          {
            id: "full-grocery",
            displayName: { text: "Capital Region Supermarket" },
            formattedAddress: "1 Main St",
            location: { latitude: 42.78, longitude: -73.84 },
            types: ["supermarket", "grocery_store", "convenience_store"],
          },
          {
            id: "discount-grocery",
            displayName: { text: "Discount Food Market" },
            formattedAddress: "1B Main St",
            location: { latitude: 42.785, longitude: -73.845 },
            types: ["discount_supermarket"],
          },
          {
            id: "hannaford",
            displayName: { text: "Hannaford" },
            formattedAddress: "1C Main St",
            location: { latitude: 42.786, longitude: -73.846 },
            types: ["grocery_store", "food_store"],
          },
          {
            id: "specialty-market",
            displayName: { text: "Schenectady Trading Post" },
            formattedAddress: "2 Main St",
            location: { latitude: 42.79, longitude: -73.85 },
            types: ["market", "food_store"],
          },
          {
            id: "corner-store",
            displayName: { text: "Neighborhood Corner Store" },
            formattedAddress: "3 Main St",
            location: { latitude: 42.77, longitude: -73.83 },
            types: ["convenience_store"],
          },
          {
            id: "niskayuna-coop",
            displayName: { text: "Niskayuna Co-op" },
            formattedAddress: "3B Main St",
            location: { latitude: 42.771, longitude: -73.831 },
            types: ["grocery_store", "butcher_shop", "health_food_store"],
          },
          {
            id: "vitamin-shoppe",
            displayName: { text: "The Vitamin Shoppe" },
            formattedAddress: "3C Main St",
            location: { latitude: 42.772, longitude: -73.832 },
            types: ["health_food_store", "grocery_store"],
          },
          {
            id: "stewarts",
            displayName: { text: "Stewart's Shops" },
            formattedAddress: "3D Main St",
            location: { latitude: 42.773, longitude: -73.833 },
            types: ["convenience_store", "grocery_store", "food_store"],
          },
          {
            id: "qunins-deli",
            displayName: { text: "Qunins deli & grocery" },
            formattedAddress: "3E Main St",
            location: { latitude: 42.774, longitude: -73.834 },
            types: ["deli", "grocery_store", "restaurant"],
          },
          {
            id: "liquor-store",
            displayName: { text: "Main Street Liquors" },
            formattedAddress: "4 Main St",
            location: { latitude: 42.775, longitude: -73.835 },
            types: ["liquor_store", "store"],
          },
          {
            id: "restaurant",
            displayName: { text: "Main Street Restaurant" },
            formattedAddress: "5 Main St",
            location: { latitude: 42.776, longitude: -73.836 },
            types: ["restaurant", "food"],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const primary = await callServicePoints({
    category: "grocery",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(primary.body.points.map((point) => point.name)).toEqual([
    "Capital Region Supermarket",
    "Discount Food Market",
    "Hannaford",
  ]);
  expect(primary.body.points[0].match).toMatchObject({ tier: "primary" });
  expect(primary.body.extensions.map((extension) => extension.id)).toEqual([
    "specialty_food",
    "convenience_food",
  ]);
  expect(requestedTypes[0]).toEqual([
    "grocery_store",
    "supermarket",
    "discount_supermarket",
    "hypermarket",
  ]);

  const specialty = await callServicePoints({
    category: "grocery",
    include: "specialty_food",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(specialty.body.points.map((point) => point.name)).toEqual([
    "Capital Region Supermarket",
    "Discount Food Market",
    "Hannaford",
    "Niskayuna Co-op",
    "Schenectady Trading Post",
    "The Vitamin Shoppe",
  ]);
  expect(specialty.body.points[4].match).toMatchObject({
    tier: "related",
    extensionId: "specialty_food",
    subclassification: "Specialty food store",
  });
  expect(requestedTypes[1]).toEqual(
    expect.arrayContaining(["grocery_store", "supermarket", "asian_grocery_store", "market"]),
  );
  expect(requestedTypes[1]).not.toContain("convenience_store");

  const convenience = await callServicePoints({
    category: "grocery",
    include: "convenience_food",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(convenience.body.points.map((point) => point.name)).toEqual([
    "Capital Region Supermarket",
    "Discount Food Market",
    "Hannaford",
    "Neighborhood Corner Store",
    "Qunins deli & grocery",
    "Stewart's Shops",
  ]);
  expect(convenience.body.points[3].match).toMatchObject({
    tier: "fallback",
    extensionId: "convenience_food",
  });
  expect(requestedTypes[2]).toContain("convenience_store");
  expect(convenience.body.points.map((point) => point.name)).not.toContain("Main Street Liquors");
  expect(convenience.body.points.map((point) => point.name)).not.toContain(
    "Main Street Restaurant",
  );
});

test("coffee results require an explicit cafe or coffee-shop provider type", async () => {
  process.env.GOOGLE_PLACES_API_KEY = "test-google-key";
  let requestedTypes: string[] = [];

  globalThis.fetch = async (input, init) => {
    const url = String(input);

    if (url.includes("places.googleapis.com/v1/places:searchNearby")) {
      requestedTypes = JSON.parse(String(init?.body || "{}")).includedTypes || [];
      return jsonResponse({
        places: [
          {
            id: "cafe",
            displayName: { text: "Neighborhood Cafe" },
            formattedAddress: "1 Coffee St",
            location: { latitude: 42.78, longitude: -73.84 },
            types: ["cafe", "coffee_shop"],
          },
          {
            id: "restaurant",
            displayName: { text: "Breakfast Restaurant" },
            formattedAddress: "2 Coffee St",
            location: { latitude: 42.79, longitude: -73.85 },
            types: ["restaurant", "food"],
          },
          {
            id: "panera",
            displayName: { text: "Panera Bread" },
            formattedAddress: "3 Coffee St",
            location: { latitude: 42.77, longitude: -73.83 },
            types: ["cafe", "coffee_shop", "bakery", "breakfast_restaurant"],
          },
          {
            id: "brueggers",
            displayName: { text: "Bruegger's Bagels" },
            formattedAddress: "4 Coffee St",
            location: { latitude: 42.775, longitude: -73.835 },
            types: ["coffee_shop", "cafe", "bagel_shop", "fast_food_restaurant"],
          },
          {
            id: "mcdonalds",
            displayName: { text: "McDonald's" },
            formattedAddress: "5 Coffee St",
            location: { latitude: 42.776, longitude: -73.836 },
            types: [
              "coffee_shop",
              "cafe",
              "fast_food_restaurant",
              "hamburger_restaurant",
              "breakfast_restaurant",
            ],
          },
          {
            id: "balloons",
            displayName: { text: "Candy Balloons and More" },
            formattedAddress: "6 Coffee St",
            location: { latitude: 42.777, longitude: -73.837 },
            types: ["coffee_shop", "cafe", "store"],
          },
        ],
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const { body } = await callServicePoints({
    category: "coffee",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(requestedTypes).toEqual(["cafe", "coffee_shop"]);
  expect(body.points.map((point) => point.name)).toEqual(["Neighborhood Cafe"]);
  expect(body.extensions.map((extension) => extension.id)).toEqual([
    "bakery_cafes",
    "coffee_available",
  ]);

  const bakeryCafes = await callServicePoints({
    category: "coffee",
    include: "bakery_cafes",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(bakeryCafes.body.points.map((point) => point.name)).toEqual([
    "Neighborhood Cafe",
    "Bruegger's Bagels",
    "Panera Bread",
  ]);
  expect(bakeryCafes.body.points[1].match).toMatchObject({
    tier: "related",
    extensionId: "bakery_cafes",
  });

  const coffeeAvailable = await callServicePoints({
    category: "coffee",
    include: "coffee_available",
    bbox: "-73.91,42.72,-73.74,42.84",
  });

  expect(coffeeAvailable.body.points.map((point) => point.name)).toEqual([
    "Neighborhood Cafe",
    "Candy Balloons and More",
    "McDonald's",
  ]);
  expect(coffeeAvailable.body.points[2].match).toMatchObject({
    tier: "fallback",
    extensionId: "coffee_available",
  });
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
