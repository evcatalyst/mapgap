# MapGap V3 public prerelease

V3 is a separately installable analyst workbench published at
`https://mapgap-v3-preview.netlify.app`. It proves the MapGap project contract
and Kepler presentation seam without changing V2's dependency graph, build,
routing, or deploy. It remains fixture-only and is not approved for partner data.

Scenario links:

- `https://mapgap-v3-preview.netlify.app/#relocation`
- `https://mapgap-v3-preview.netlify.app/#civic`

```sh
npm --prefix apps/v3 ci
npm --prefix apps/v3 run build
npm --prefix apps/v3 run test
```

The two fixture-driven presets are deliberately read-only:

- **Relocation** shows why a nearby candidate can fail a routed commute while a
  lower-proximity candidate passes.
- **Civic capacity** renders the 24-capacity computer lab and 48-capacity
  library, normalized utilization, routed reach, and an explicitly labeled
  deterministic underserved-capacity proxy.

The preview uses the real OpenFreeMap Liberty vector basemap. It provides
streets, water, land use, and place labels without an API key. Runtime map
requests are restricted by CSP to `https://tiles.openfreemap.org`, and the map
keeps the required OpenMapTiles/OpenStreetMap attribution visible. OpenFreeMap
is a public, as-is service with no SLA; a production decision must pin or
self-host an approved basemap and define an availability/rollback policy.

The responsive shell is map-first: the map owns more than 65% of the desktop
width and appears in the first mobile viewport. Browser acceptance waits for
real vector tiles, checks fitted scenario coordinates and canvas sizing, and
captures both presets at 1440×960 and 390×844.

`packages/project-contract` is the portable `mapgap-project/v1` boundary.
`src/lib/v3ProjectAdapter.ts` is the one-way V2 adapter. Kepler Redux only owns
V3 presentation state; it never persists the MapGap project or writes into V2.

This is **not production software**. See [SECURITY.md](SECURITY.md) for the
active Kepler audit, peer-conflict, CSP, and bundle blockers. The V2 Netlify
site does not route `/v3`; `netlify.toml` here is the active configuration for
the independently rollbackable V3 preview site only.
