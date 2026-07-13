# Kepler security patch line

This directory tracks MapGap's public, upstream-first security fork prerelease.
The fork is `evcatalyst/kepler.gl`, its integration branch is
`mapgap-v3-security`, and its package assets are published under the
`mapgap-v3.0.0-alpha.1` GitHub prerelease. This is public prerelease evidence,
not a claim of production readiness.

## Base and verified result

- Upstream: `keplergl/kepler.gl`
- Base branch: `master`
- Base commit: `73af58e99e3971b89d556aab9a21814e6e6b31e7`
- Patches: `patches/0001-security-runtime-spike.patch`, then
  `patches/0002-lodash-4.18.1.patch`, then
  `patches/0003-esm-deck-react19-alignment.patch`
- Verification date: 2026-07-11
- Node test result: 11,386 passed, 0 failed
- New `@kepler.gl/task-runtime` declaration build: passed

The patch line upgrades Kepler's direct D3 dependencies to advisory-safe majors,
resolves `node-fetch` to 2.7.0 and Thrift to 0.23.0, and replaces
`react-palm` with a framework-neutral task runtime. The lock refresh removed
`react-palm`, React 16, `react-reconciler`, `fbjs`, `isomorphic-fetch`, and the
vulnerable `node-fetch` version. A focused re-audit found none of those
packages and no vulnerable workspace-owned D3, Thrift, or `node-fetch` path.

The second patch upgrades Lodash to 4.18.1, outside the current advisory
ranges, adds the missing direct DuckDB dependency, and consolidates the legacy
`lodash.isequal` import. It also passes all 11,386 Node tests, and the focused
re-audit no longer reports Lodash.

The companion Hubble patch removes the old Kepler/D3 subtree, and the
loaders.gl patch makes Thrift 0.23 a published dependency rather than a Yarn
resolution. Installing the patched core packages with the verified versions in
`consumer-overrides.json` produced a packed npm graph with **0 audit findings
at every severity**. After deck-family alignment, the current graph contains
836 production dependencies and 845 total dependencies. AI assistant and
DuckDB packages were deliberately excluded because MapGap does not use them
and they add unrelated server/LLM exposure.

The third patch aligns editable-layers and its community layer peer with the
deck/luma 9.3 family, moves React Intl consumers to version 7, and publishes a
real ESM component entry. Vite 8 now builds the packed consumer without aliases,
and Chrome renders 833 exports across actions, components, processors, reducers,
and the task runtime. A same-version duplicate-luma initialization warning
remains because the package family still mixes CommonJS and ESM entrypoints.
The Mapbox compatibility peer and strict-CSP deployment also remain open, so
zero audit findings and a rendered smoke test still do not imply production
readiness.

## Reproduce the spike

```sh
git clone https://github.com/keplergl/kepler.gl.git
cd kepler.gl
git checkout 73af58e99e3971b89d556aab9a21814e6e6b31e7
git apply /path/to/mapgap/fork/kepler-gl/patches/0001-security-runtime-spike.patch
git apply /path/to/mapgap/fork/kepler-gl/patches/0002-lodash-4.18.1.patch
git apply /path/to/mapgap/fork/kepler-gl/patches/0003-esm-deck-react19-alignment.patch
corepack yarn install --mode=skip-build
corepack yarn fix-dependencies
corepack yarn exec tsc --project src/task-runtime/tsconfig.production.json
corepack yarn test-node-debug
corepack yarn npm audit --all --recursive --json
```

The patch series includes its lockfile edits so each slice can be reviewed and
reproduced from the immutable base commit.

## Upstream contribution shape

The spike should be split before submission:

1. Upgrade D3 majors and add focused color/scale/brush compatibility tests.
2. Resolve Thrift and `node-fetch` independently with loader/fetch tests.
3. Add `@kepler.gl/task-runtime`, migrate imports, and remove `react-palm`.
4. Submit the Hubble companion patch so video export no longer pins an old
   Kepler graph.
5. Submit the verified Lodash 4.18.1 package update as a narrow dependency PR.
6. Add the proven npm-consumer pack/install/audit job to upstream CI. Yarn resolutions
   alone do not protect npm consumers.
7. Align editable/deck/luma, React Intl, and ESM packaging, then extend true ESM
   entries across the remaining packages to eliminate duplicate initialization.

See [PATCH_LEDGER.md](PATCH_LEDGER.md) for ownership and exit conditions.
