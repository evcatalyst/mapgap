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
