# MapGap Phase 1 User Stories

These stories are the current regression and design-review baseline for the live-backed app.

## Story 1 - First run to generated heatmap

As a first-time evaluator, I want to enter the Valhalla access secret and immediately understand how to generate a heatmap, so I can validate that MapGap is using real routing rather than a static demo.

Success criteria:
- API status shows ready.
- The secret field is discoverable when Valhalla requires access.
- A visible primary generate action is available after the secret is entered.
- The app renders nonzero rings.

## Story 2 - Quickly add and edit locations

As an operator building a demo, I want a visible way to add another point and edit its label/coordinates, so I do not have to hunt through a hidden panel or command palette.

Success criteria:
- A top-level add point action is visible.
- Adding a point updates the point count.
- The table/card editor exposes editable name, address, latitude, and longitude fields.

## Story 3 - Relocation scenario profile review

As a relocation user, I want the selected scenario to explain its anchors, constraints, and scoring weights, so the map feels like a decision workflow rather than only geometry.

Success criteria:
- The default relocation profile is visible.
- Anchors and constraints are visible.
- Job-market constraint language is represented.
- Score weights are visible and adjustable.

## Story 4 - Dual-career scenario

As a dual-career household, I want to switch scenarios and see two work anchors and job-market assumptions, so I can evaluate whether one home base can support both commutes.

Success criteria:
- Scenario selector changes the active profile.
- Two job anchors are visible.
- A job constraint is visible.
- The profile remains visible without destroying map context.

## Story 5 - Mobile first run

As a mobile user, I want to enter the Valhalla secret, generate, and reach the location table without horizontal scrolling, so I can demo the product on a phone.

Success criteria:
- No horizontal overflow.
- The drawer exposes the secret field.
- Generate is visible from the main surface.
- The table/card editor is reachable.

## Story 6 - Export-ready evidence

As a civic or relocation reviewer, I want exports to become available after points/rings exist, so I can turn exploration into shareable evidence.

Success criteria:
- CSV is available when points exist.
- GeoJSON is available when points or rings exist.
- PNG export is visible.
- Generated ring count is visible before export.

## Story 7 - iPad map and controls balance

As a tablet user in a meeting or field review, I want to enter routing credentials, generate rings, and inspect the table without losing map context, so the app remains useful on a device that is larger than a phone but still not a desktop workstation.

Success criteria:
- No horizontal overflow at an iPad portrait width.
- The drawer exposes the Valhalla secret field.
- Generate remains visible after the secret is entered.
- Generated rings and the location table remain reachable without layout collisions.

## Story 8 - Guided relocation journey

As a relocating household, I want to move through needs, homes, daily life, and
comparison as separate steps, so I can make progress without understanding a GIS
workbench.

Success criteria:
- The map remains visible throughout the journey.
- Step changes reset the panel to useful context on short phones.
- Household, dual-career, and hospital on-call stories change deterministic inputs.
- A user can skip or revisit a step without losing current-session evidence.

## Story 9 - Housing overlay with honest provenance

As a relocation user, I want housing candidates to look different from amenities
and disclose how MapGap received them, so I do not mistake examples or imports for
verified live inventory.

Success criteria:
- Housing uses price markers at neighborhood zoom and compact dots regionally.
- Live, imported, and illustrative records have distinct source/access labels.
- Illustrative records state that they are not real or available homes.
- Zillow, Trulia, Craigslist, and MLS imports remain user-provided evidence.

## Story 10 - Cost-controlled live listing search

As the product operator, I want live listing calls to happen only after an
explicit search and behind a server-side enable flag, so map panning and public
traffic do not create uncontrolled provider charges.

Success criteria:
- Panning never triggers a listing request.
- Map or filter changes visibly mark previous provider results as needing
  refresh.
- A live provider requires a server-side key and explicit enable flag.
- Identical searches use a bounded TTL cache.
- Live failure falls back to labeled examples rather than ambiguous stale data.

## Story 11 - Transparent housing shortlist

As a household or relocation advisor, I want saved homes scored against budget,
anchors, and visible daily-life evidence, so I can explain why one candidate is a
better fit and what assumptions remain.

Success criteria:
- Only user-saved homes enter the listing comparison.
- Affordability uses the recorded price and selected budget.
- Over-budget homes produce a visible failed constraint.
- The exported brief includes price, address, source access mode, and caveats.
