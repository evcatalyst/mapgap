# Kepler patch ledger

| ID | Patch slice | State | Evidence | Upstream target | Removal condition |
| --- | --- | --- | --- | --- | --- |
| KSEC-001 | D3 3/4 upgrades across components, constants, reducers, layers, and utils | Spike verified | 11,386 Node tests pass; workspace D3 audit paths clear | Separate Kepler PR | Upstream release contains equivalent upgrades |
| KSEC-002 | Thrift 0.23 and `node-fetch` 2.7 resolutions | Spike verified | Focused audit no longer reports either vulnerable version | Separate Kepler/loaders PRs | Upstream dependency graph resolves safe versions for npm consumers |
| KSEC-003 | Replace `react-palm` with `@kepler.gl/task-runtime` | Spike verified | Runtime declarations compile; 11,386 Node tests pass; React 16 chain removed from refreshed lock | Kepler PR | Upstream publishes the framework-neutral runtime and removes `react-palm` |
| KSEC-004 | Upgrade vulnerable Lodash 4 runtime to 4.18.1 | Spike verified | 11,386 Node tests pass; focused audit no longer reports Lodash | Narrow Kepler dependency PR | Upstream release resolves 4.18.1 for every Kepler package and npm consumer |
| KSEC-005 | Remove Hubble's unnecessary Kepler constants pin | Spike verified | Hubble builds; patched graph removes old Kepler/D3 path | Hubble PR | Released Hubble package contains no Kepler runtime dependency |
| KSEC-006 | npm pack/install/audit consumer fixture | Build and audit verified; runtime warning remains | Packed core: 836 production deps, 0 findings; Vite 8 builds without aliases; Chrome renders 833 exports; mixed CJS/ESM still initializes luma twice | Kepler CI and packaging PRs | Published-shape fixture passes audit, build, browser runtime, and peer checks without warnings |
| KSEC-008 | Align editable/deck/luma 9.3, React Intl 7, and component ESM output | Spike verified | One installed deck/luma version family; Vite 8 build passes; 11,386 Node assertions pass | Kepler packaging PR | Released packages expose consistent ESM entries and React 19-compatible peers |
| KSEC-009 | Remove Hubble's unused React-18-only click-outside dependency | Spike verified | No source usage; Hubble build passes; patched consumer removes this React 19 peer conflict | Hubble PR | Released Hubble package omits `react-onclickoutside` |
| KSEC-007 | CSP-safe worker path and removal of direct `eval` | Planned | Existing MapGap V3 build still emits loader worker warnings | loaders.gl/Kepler PR | Deployed strict-CSP test passes without `unsafe-eval` |

Owner: MapGap engineering until an upstream maintainer accepts each slice.

Public-fork trigger: publish a MapGap-scoped package only if upstream review or
release timing prevents a security-cleared V3 beta, and only after the runtime
half of KSEC-006 plus KSEC-007 are verified. Domain features remain outside
this patch line.
