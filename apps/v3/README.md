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

`packages/project-contract` is the portable `mapgap-project/v1` boundary.
`src/lib/v3ProjectAdapter.ts` is the one-way V2 adapter. Kepler Redux only owns
V3 presentation state; it never persists the MapGap project or writes into V2.

This is **not production software**. See [SECURITY.md](SECURITY.md) for the
active Kepler audit, peer-conflict, CSP, and bundle blockers. The V2 Netlify
site does not route `/v3`; `netlify.toml` here is a future separate-site config
only.
