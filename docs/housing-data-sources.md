# Housing Listing Sources

MapGap treats housing inventory as evidence with explicit provenance. A marker
must say whether it came from a live API, a licensed feed, a user-provided file,
or illustrative workflow data. The application must never make an example look
like an available home.

## Current Integration

`GET /api/housing/listings` accepts a viewport, tenure, maximum price, and
minimum bedrooms. It returns normalized housing records for `/v2/relocate`.

Live requests are deliberately fail-closed. Both settings are required:

```text
RENTCAST_API_KEY=...
HOUSING_LIVE_PROVIDER_ENABLED=true
```

Without both values, the endpoint returns clearly labeled illustrative records.
Those records test the workflow and scorecard; they are not real properties.

The RentCast adapter:

- runs only after the user explicitly selects `Find homes in this view`;
- marks existing results as needing refresh after the map or filters change,
  without issuing another provider request;
- sends one circular viewport query to the appropriate rental or sale endpoint;
- filters the response back to the requested bounding box;
- caps results at 40;
- caches identical requests for 15 minutes by default;
- never exposes the API key to the browser;
- records source, access mode, and observation time on every listing.

RentCast documents a free developer allowance of 50 successful requests per
month, followed by plan-specific pricing and overage charges. The cache and
explicit-search interaction protect that allowance, but they are not a durable
monthly budget system. A production pilot should add persistent quota telemetry
before enabling unrestricted public live search.

Official references:

- [RentCast rental listing endpoint](https://developers.rentcast.io/reference/rental-listings-long-term)
- [RentCast billing and pricing](https://developers.rentcast.io/reference/billing-and-pricing)
- [RentCast rate limits](https://developers.rentcast.io/reference/rate-limits)

## Zillow And Trulia

Zillow Group publishes partner offerings for MLS and broker listings, public
records, metrics, and rental feed integrations. Listing display is not an
unrestricted scraping surface. Zillow's terms prohibit automated querying and
reuse of listing content unless specifically permitted.

MapGap therefore supports Zillow- or Trulia-derived rows only when one of these
conditions is true:

1. A licensed Zillow Group, Bridge Interactive, or MLS feed is configured.
2. A user imports records they are authorized to use.

Imported records are labeled `Imported Zillow` or `Imported Trulia` and retain
`user-provided` access provenance. That label does not claim a live integration
or provider endorsement.

Official references:

- [Zillow Group Data and APIs](https://www.zillowgroup.com/developers/)
- [Zillow Terms of Use](https://www.zillow.com/corporate/terms-of-use/)
- [RESO Web API access model](https://www.reso.org/reso-web-api/)

## Craigslist

Craigslist's terms prohibit unlicensed software interaction and automated or
manual-equivalent collection of Craigslist content. MapGap does not scrape,
search, proxy, or aggregate Craigslist.

A user may import a record only when they have the right to use it. MapGap marks
that record `Imported Craigslist`, keeps the source URL optional, and states
that the application did not retrieve or verify the listing.

Official reference:

- [Craigslist Terms of Use](https://www.craigslist.org/about/terms)

## Authorized CSV Contract

Required columns:

```text
latitude,longitude,price
```

Optional columns:

```text
title,address,tenure,bedrooms,bathrooms,square_feet,property_type,source,source_url
```

Recognized source values include `Zillow`, `Trulia`, `Craigslist`, `MLS`, and
`RESO`. Coordinates and a positive price are required because Stage 2 does not
silently geocode or infer listing locations.

## Next Provider Work

- Add a durable request budget and usage dashboard before public live enablement.
- Add a licensed RESO/MLS adapter behind the same normalized contract.
- Add HUD fair-market-rent and ACS rent-burden context as market evidence, not
  listing inventory.
- Add saved-project persistence before treating a shortlist as a durable client
  record.
- Review provider display, attribution, retention, and refresh requirements as
  part of each commercial agreement.
