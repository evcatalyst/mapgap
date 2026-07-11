# V3 public prerelease security disposition

Status: **public prerelease — production promotion blocked**

The pinned `evcatalyst/kepler.gl@mapgap-v3.0.0-alpha.1` package set is isolated under `apps/v3`; it is not a
root dependency, not bundled with V2, and not configured for the V2 Netlify
site. A fresh production-dependency audit on 2026-07-11 reports **0 findings at
every severity**. The install uses React 19 and the aligned deck/luma 9.3
family from immutable public fork release assets.

This is a fixture-only public prerelease while V2 stays independent. It is not
approved for partner data or production promotion. The machine-checked scope, owner,
package paths, review date, constraints, and exit criteria are in
[`security/audit-disposition.json`](security/audit-disposition.json). Run:

```sh
npm run audit:alpha
```

The check fails if any vulnerability appears, the review date expires, the
status changes, or the formal constraints are missing.

## Additional production blockers

- The deployed site passes its strict CSP without `unsafe-eval`, plus live
  smoke and token-free request checks.
- The current full-workbench payload is about 5.16 MB gzip (JavaScript plus
  Parquet WASM). It exceeds the 3 MB production target and must be reduced or
  explicitly re-reviewed before production promotion.
- The public prerelease is `https://mapgap-v3-preview.netlify.app`. It has no
  saved-project persistence, authentication, partner-data intake, or V2 route.

The required production decision is intentionally fail-closed:

```sh
npm run production:gate
```

It reports the outstanding blockers and exits non-zero until they are resolved.
