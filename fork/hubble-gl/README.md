# Hubble companion security patch

Base: `uber/hubble.gl@089f603f81ac088a1ba6a82747cdf6cfe71090da`.

`0001-remove-kepler-constants-pin.patch` replaces one use of
`FILTER_VIEW_TYPES.enlarged` with Hubble's local string value and removes the
otherwise unnecessary `@kepler.gl/constants@3.1.0` dependency. This prevents
Hubble video export from installing an old Kepler/D3 graph.

`0002-remove-unused-react-onclickoutside.patch` removes a dependency that has no
source imports and whose peer range stops at React 18. This clears that Hubble
peer conflict for Kepler's React 19 consumer without changing runtime code.

Verification on 2026-07-11:

- Hubble build passed after both dependency removals, including CommonJS output.
- The patched Hubble graph no longer contains `@kepler.gl/constants` or the
  vulnerable `d3-color@2` path.
- Hubble's full test command is independently incompatible with Node 24: its
  harness assigns to the read-only global `navigator` before tests execute.
  This is recorded as an upstream harness issue, not counted as a patch pass.
