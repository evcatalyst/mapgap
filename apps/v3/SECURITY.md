# V3 internal-alpha security disposition

Status: **internal alpha — publication and production promotion blocked**

The purpose-built Intelligence renderer is isolated under `apps/v3`; it is not
a root dependency, not bundled with V2, and not configured for the V2 Netlify
site. It pins MapLibre GL JS 5.24.0, selected deck.gl 9.3.6 packages, and
`h3-js` 4.5.0. Kepler, Hubble, Redux, styled-components, and the public Kepler
fork are prohibited runtime dependencies. A fresh production-dependency audit
on 2026-07-12 reports **0 findings at every severity**.

This is a fixture-only internal alpha while V2 stays independent. It is not
approved for partner data or production promotion. The machine-checked scope, owner,
package paths, review date, constraints, and exit criteria are in
[`security/audit-disposition.json`](security/audit-disposition.json). Run:

```sh
npm run audit:alpha
```

The check fails if any vulnerability appears, the review date expires, the
status changes, or the formal constraints are missing.

## Additional production blockers

- A candidate deployment must pass its strict CSP without `unsafe-eval`, plus
  live smoke and token-free request checks.
- The direct renderer build is about 647 KB gzip JavaScript plus 13 KB gzip CSS,
  below the 3 MB application target. CI measures all shipped runtime files,
  including generated workers and WASM, rather than treating Vite's warning as
  an enforcement gate. Public source maps are disabled pending an explicit
  observability and source-exposure decision.
- The corrected direct-stack build is not deployed. The current
  `https://mapgap-v3-preview.netlify.app` site remains the superseded Kepler
  research spike and must not be used as release evidence for this branch. The
  direct-stack alpha has no saved-project persistence, authentication, or
  partner-data intake. It embeds
  the independently deployed V2 route through an exact-origin frame and accepts
  only the bounded `mapgap.v2.context/v1` bridge message.
- The CSP permits one map provider origin, `https://tiles.openfreemap.org`.
  Browser security tests require a successful vector-tile response, reject all
  other remote origins and credential-bearing query parameters, and verify
  complete OpenFreeMap/OpenMapTiles/OpenStreetMap attribution. The free service
  has no SLA, so availability and self-hosting remain production decisions.
- V2 and V3 bridge headers, keyboard/frame behavior, WebGL recovery, 10k/100k/1M
  scale tiers, 30-minute memory stability, SBOM/license review, SLOs, and rollback
  evidence remain production gates.

The required production decision is intentionally fail-closed:

```sh
npm run production:gate
```

It reports the outstanding blockers and exits non-zero until they are resolved.
