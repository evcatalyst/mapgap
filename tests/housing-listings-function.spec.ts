import { expect, test } from "@playwright/test";
import {
  formatCompactHousingPrice,
  parseHousingListingsCsv,
} from "../src/domain/housing";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = {
  RENTCAST_API_KEY: process.env.RENTCAST_API_KEY,
  HOUSING_LIVE_PROVIDER_ENABLED: process.env.HOUSING_LIVE_PROVIDER_ENABLED,
};

async function importHandler() {
  const module = await import(
    `../netlify/functions/housing-listings.mjs?test=${Date.now()}-${Math.random()}`
  );
  return module.handler as (event: {
    httpMethod: string;
    queryStringParameters?: Record<string, string>;
  }) => Promise<{ statusCode: number; body: string; headers?: Record<string, string> }>;
}

function restoreEnv(name: string, value?: string) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  restoreEnv("RENTCAST_API_KEY", ORIGINAL_ENV.RENTCAST_API_KEY);
  restoreEnv("HOUSING_LIVE_PROVIDER_ENABLED", ORIGINAL_ENV.HOUSING_LIVE_PROVIDER_ENABLED);
});

test("housing listings return filtered, unmistakable examples when live access is disabled", async () => {
  delete process.env.RENTCAST_API_KEY;
  delete process.env.HOUSING_LIVE_PROVIDER_ENABLED;
  globalThis.fetch = async () => {
    throw new Error("Illustrative mode must not make a provider request");
  };

  const handler = await importHandler();
  const response = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      bbox: "-74.0,42.6,-73.6,42.9",
      tenure: "rent",
      maxPrice: "2200",
      minBedrooms: "2",
    },
  });
  const body = JSON.parse(response.body);

  expect(response.statusCode).toBe(200);
  expect(body.mode).toBe("illustrative");
  expect(body.liveProviderConfigured).toBe(false);
  expect(body.listings.length).toBeGreaterThan(0);
  expect(body.listings.every((listing: { source: string }) => listing.source === "illustrative")).toBe(true);
  expect(body.listings.every((listing: { bedrooms: number }) => listing.bedrooms >= 2)).toBe(true);
  expect(body.listings.every((listing: { price: number }) => listing.price <= 2200)).toBe(true);
  expect(body.warnings[0]).toContain("not available homes");
});

test("housing listings normalize one cached RentCast request and enforce viewport bounds", async () => {
  process.env.RENTCAST_API_KEY = "test-rentcast-key";
  process.env.HOUSING_LIVE_PROVIDER_ENABLED = "true";
  let fetchCount = 0;

  globalThis.fetch = async (input, init) => {
    fetchCount += 1;
    const url = new URL(String(input));

    expect(url.pathname).toBe("/v1/listings/rental/long-term");
    expect(url.searchParams.get("status")).toBe("Active");
    expect(url.searchParams.get("price")).toBe("*:2600");
    expect(url.searchParams.get("bedrooms")).toBe("1:*");
    expect((init?.headers as Record<string, string>)["X-Api-Key"]).toBe("test-rentcast-key");

    return new Response(
      JSON.stringify([
        {
          id: "100-Main-St-Albany-NY",
          formattedAddress: "100 Main St, Albany, NY 12207",
          addressLine1: "100 Main St",
          latitude: 42.651,
          longitude: -73.755,
          propertyType: "Apartment",
          bedrooms: 2,
          bathrooms: 1,
          squareFootage: 930,
          status: "Active",
          price: 2100,
          listedDate: "2026-07-01T00:00:00.000Z",
          lastSeenDate: "2026-07-13T12:00:00.000Z",
        },
        {
          id: "outside",
          formattedAddress: "Outside viewport",
          latitude: 41.5,
          longitude: -73.755,
          status: "Active",
          price: 1900,
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const handler = await importHandler();
  const event = {
    httpMethod: "GET",
    queryStringParameters: {
      bbox: "-73.9,42.55,-73.65,42.8",
      tenure: "rent",
      maxPrice: "2600",
      minBedrooms: "1",
    },
  };
  const first = await handler(event);
  const second = await handler(event);
  const firstBody = JSON.parse(first.body);
  const secondBody = JSON.parse(second.body);

  expect(first.statusCode).toBe(200);
  expect(firstBody.mode).toBe("live");
  expect(firstBody.listings).toHaveLength(1);
  expect(firstBody.listings[0]).toMatchObject({
    title: "100 Main St",
    source: "rentcast",
    sourceLabel: "RentCast",
    price: 2100,
    bedrooms: 2,
    provenance: { access: "live-api" },
  });
  expect(secondBody.cache.hit).toBe(true);
  expect(fetchCount).toBe(1);
});

test("explicit live housing requests fail closed when the cost gate is disabled", async () => {
  process.env.RENTCAST_API_KEY = "test-rentcast-key";
  process.env.HOUSING_LIVE_PROVIDER_ENABLED = "false";
  const handler = await importHandler();
  const response = await handler({
    httpMethod: "GET",
    queryStringParameters: {
      bbox: "-73.9,42.55,-73.65,42.8",
      source: "rentcast",
    },
  });

  expect(response.statusCode).toBe(503);
  expect(JSON.parse(response.body).message).toContain("HOUSING_LIVE_PROVIDER_ENABLED=true");
});

test("authorized housing CSV retains source context without claiming a live integration", () => {
  const csv = [
    "title,latitude,longitude,price,bedrooms,bathrooms,source,source_url",
    "Imported Zillow home,42.65,-73.75,$2200,2,1,Zillow,https://www.zillow.com/example",
    "Imported Craigslist rental,42.67,-73.78,1850,1,1,Craigslist,https://albany.craigslist.org/example",
    "Invalid row,nope,-73.8,1700,1,1,Trulia,https://trulia.com/example",
  ].join("\n");
  const parsed = parseHousingListingsCsv(csv);

  expect(parsed.listings).toHaveLength(2);
  expect(parsed.skippedRows).toBe(1);
  expect(parsed.listings[0]).toMatchObject({
    source: "zillow_group",
    sourceLabel: "Imported Zillow",
    provenance: { access: "user-provided" },
  });
  expect(parsed.listings[1]).toMatchObject({
    source: "craigslist",
    sourceLabel: "Imported Craigslist",
    provenance: { access: "user-provided" },
  });
});

test("compact housing prices round half-thousands for readable map labels", () => {
  expect(formatCompactHousingPrice(1_650)).toBe("$1.7k");
  expect(formatCompactHousingPrice(2_240)).toBe("$2.2k");
  expect(formatCompactHousingPrice(315_000)).toBe("$315k");
});
