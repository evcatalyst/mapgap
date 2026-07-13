# MapGap V3 public prerelease

> **Research-spike notice (2026-07-12):** This deployed Kepler comparison is
> retained as technical evidence; it is not the target V3 product architecture.
> The corrected direction preserves the actual V2 product on the left and builds
> a purpose-built MapGap Intelligence workbench on the right. See the
> [fresh architecture review](../../docs/reports/v3-visual-intelligence-architecture-review.md).

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

The two fixture-driven presets are deliberately read-only and now share one
responsive comparison workbench:

- **Relocation** places its Jersey City routed surface on the Access side and
  candidates/nearby places on the Intelligence side.
- **Civic + housing** places the V2-compatible routed access surface on the left
  and a bounded ACS 2024/TIGER 2023 housing materialization on the right, while
  retaining the 24-capacity computer lab, 48-capacity library, and transparent
  underserved-capacity proxy.

Wide containers use Kepler's native synchronized dual-map mode. iPad portrait
and phone use one persistent canvas with an Access/Intelligence switch. Both
modes share the selected feature and bottom evidence drawer. Context sources
never modify MapGap's routed score.

The preview uses the real OpenFreeMap Liberty vector basemap. It provides
streets, water, land use, and place labels without an API key. Runtime map
requests are restricted by CSP to `https://tiles.openfreemap.org`, and the map
keeps the required OpenMapTiles/OpenStreetMap attribution visible. OpenFreeMap
is a public, as-is service with no SLA; a production decision must pin or
self-host an approved basemap and define an availability/rollback policy.

The responsive shell is map-first. Browser acceptance waits for real vector
tiles, proves two equal map containers and converged cameras on wide viewports,
proves one persistent canvas under the 480-pixel-per-pane threshold, preserves
selection through rotation, caps initial dual-map tile traffic, and verifies a
localized intelligence-source failure.

`packages/project-contract` is the portable `mapgap-project/v1` boundary.
`src/lib/v3ProjectAdapter.ts` is the one-way V2 adapter. Kepler Redux only owns
V3 presentation state; it never persists the MapGap project or writes into V2.

This is **not production software**. See [SECURITY.md](SECURITY.md) for the
active Kepler audit, peer-conflict, CSP, and bundle blockers. The V2 Netlify
site does not route `/v3`; `netlify.toml` here is the active configuration for
the independently rollbackable V3 preview site only.
