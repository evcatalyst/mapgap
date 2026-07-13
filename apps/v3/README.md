# MapGap V3 Access × Intelligence

V3 preserves the real, independently deployed MapGap V2 on the left and adds a
purpose-built MapGap location-intelligence workbench on the right. Kepler.gl is
a product-pattern reference only; it is not a runtime dependency.

This directory contains the corrected direct-stack internal alpha. It is
separately installable and deployable from V2. The existing
`https://mapgap-v3-preview.netlify.app` release may continue to show the
superseded Kepler comparison spike until this branch passes its release gates
and is deliberately published; do not use the current public URL as evidence
that this implementation is deployed.

```sh
npm --prefix apps/v3 ci
npm --prefix apps/v3 run build
npm --prefix apps/v3 run test
npm --prefix packages/project-contract test
```

After the coordinated V2/V3 preview deployment, run the real cross-origin
composition canary (including live frame content, bridge context, and both CSP
headers):

```sh
PLAYWRIGHT_BASE_URL=https://mapgap-v3-preview.netlify.app npm --prefix apps/v3 run test:smoke
```

## Runtime boundary

- **MapGap V2:** the exact `https://mapgap-access.netlify.app/v2` route in a
  titled, sandboxed cross-origin frame. Its Leaflet map, search, Walk/Drive
  heat, routing, results, sharing, and release lifecycle stay independent.
- **Intelligence:** MapLibre GL JS 5.24.0 with deck.gl 9.3.6 attached through
  `MapboxOverlay({interleaved: true})`.
- **Bridge:** one way from V2 to Intelligence. The host validates exact origin,
  frame window, schema, shape, field allowlists, 384 KiB limit, geometry limits,
  and monotonically increasing revision before following a V2 bounding box.

Wide qualified viewports show both surfaces. iPad portrait and phones mount only
the active heavyweight map and offer a MapGap/Intelligence switch. The hidden V2
frame stays alive so switching surfaces does not discard its search/history
session.

## Intelligence behavior

The first bounded workbench loads three overlays in both civic and relocation
stories. Analysts can reorder layers, change visibility and opacity, filter a
numeric field, inspect provenance, and switch an eligible point source among
proportional symbols, density heat, hex aggregation, and grid aggregation
without fetching it again. Polygon sources support choropleth; point sources
also support stable H3 cells. Authoritative
isochrone, route-path, and temporal-trip factories fail closed unless a governed
source carries the required geometry and routing/time semantics. Those governed
route/time factories are contract and renderer capabilities, not finished alpha
timeline controls or claims that fixture lines are routed paths.

`?failSource=housing#civic` demonstrates source-local failure: V2, capacity,
underserved evidence, and the intelligence renderer stay available.

The preview uses OpenFreeMap Liberty and keeps OpenMapTiles/OpenStreetMap
attribution visible. CSP permits network map resources only from
`https://tiles.openfreemap.org` and frames only the exact V2 origin.

## Alpha boundary and remaining gates

The civic and relocation stories use bounded portable project/analysis data;
they are not a general file uploader, live data catalog, or partner-data path.
The source/layer state is validated as `mapgap-intelligence-view/v1`, independent
of deck or MapLibre props. A source can fail without taking down the other
sources or reloading V2, and retry reconstructs only the Intelligence map.

Before promotion, V3 still needs the corrected public V2/V3 bridge deployment,
saved/shareable workspace and evidence export behavior, table/text equivalents,
complete route/time interaction, keyboard/screen-reader/touch/device evidence,
WebGL recovery qualification, 100k query and 1M+ tiled adapters, long-session
performance, SBOM/license review, identity/persistence decisions, SLOs, and a
tested rollback. Partner or authenticated data remains prohibited.

Kepler fork evidence lives on an optional upstream-research track. It is not
installed, bundled, or checked as a required release dependency for this app.
