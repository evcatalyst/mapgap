# MapGap /v2 First-Time User Guide

Public demo URL:

```text
https://mapgap-access.netlify.app/v2
```

MapGap helps answer a simple question: nearby is not always easy to reach. The
`/v2` demo is built for quick field use on a phone, tablet, or desktop. Pan to a
place, choose a daily-life category, and see places plus practical access
evidence.

## Quick Start

1. Open `https://mapgap-access.netlify.app/v2`.
2. Pan or zoom the map to the town, neighborhood, or corridor you want to test.
3. Tap `Explore Nearby`.
4. Choose one category:
   - `Laundry`
   - `Coffee`
   - `Groceries`
   - `Libraries`
   - Or use `Custom category` for your own search, such as `pharmacies`,
     `parks`, `daycare`, or `late dinner`.
5. Review the markers on the map and the matching list in the bottom drawer.
6. Tap a marker or result row to open details.
7. Optional: turn on `Walk` or `Drive` access evidence from the drawer.

The most important habit is to move the map first. The app searches the current
map view, so what you see on the screen controls what MapGap looks for.

MapGap keeps the active category and map bounds in the URL. Copying the browser
address or using `Share` reproduces the same search area for another person.

## Best First Demo

For a fast public walkthrough:

1. Open `/v2` on a phone.
2. Pan to Jersey City, NJ, around Journal Square or another dense neighborhood.
3. Tap `Explore Nearby`.
4. Tap `Laundry`.
5. Show the returned places and source labels.
6. Turn on the `Walk` heatmap if you want to compare "close on the map" with
   actual walking access.

This is the clearest everyday example: laundromats are simple, practical, and
easy for people to understand without a policy explanation.

## What You Are Seeing

The map is the primary workspace. The bottom drawer is the control surface.

- Markers show service points found for the selected category.
- The drawer lists the same points so map and list stay in sync.
- Source badges explain where each result came from.
- Detail views focus on access evidence, not photos or marketing content.

The first screen intentionally hides advanced controls, editable tables, export
buttons, profile tools, and civic planning workflows. Those are later-stage
workflows. The `/v2` demo is meant to be calm, direct, and shareable.

## Source Badges

Every result includes a source badge.

- `Google Places`: daily-life businesses such as laundromats, cafes, and grocery
  stores, plus custom category searches.
- `NY Open Data`: official New York library data where configured and available.
- `NJ Open Data`: official New Jersey library data where configured and
  available.

Libraries prefer official NY/NJ public data where possible. If an official
source is unavailable or returns no useful records, MapGap may fall back to
Google Places and show a quiet warning.

The default New York source is the NYS ITS public-library FeatureServer based
on input from the New York State Education Department. The default New Jersey
source is the NJGIN public-library FeatureServer.

## Access Heatmaps

POIs load first. Access heatmaps are optional because routing is more expensive
and can take longer.

- `Off`: show places only.
- `Walk`: show practical walking access from the selected service points.
- `Drive`: show driving access when the routing provider supports it.

Use the heatmap when the question is about practical reach, not just where
places exist. A point can look nearby on the map but still be hard to reach
because of highways, rivers, rail lines, disconnected streets, or real travel
friction.

If the heatmap is unavailable, the POIs are still useful. The app should keep
showing places and source evidence even when routing fails or is slow.

## Mobile Tips

- Use the bottom drawer handle to move between compact and expanded views.
- Close the drawer if you want more map space.
- Pan or zoom the map, then tap `Search this area` to refresh the current category.
- Browser back closes or restores drawer stages before leaving `/v2`.
- Refresh preserves a shared or active URL search. Use `Reset nearby search` to
  clear the category, results, heatmap, and URL state.
- If browser controls cover the bottom of the screen, scroll or collapse the
  drawer before tapping map markers.
- Larger tablets and desktop browsers use the same flow, but the map has more
  room for context.

## Troubleshooting

If no places appear:

- Zoom out slightly and try the category again.
- Pan so the town center or main corridor is inside the visible map.
- Try another category to check whether provider coverage is sparse in that
  area.

If the results look wrong:

- Tighten the viewport around the intended neighborhood.
- Check the source badge. Provider categorization can vary, especially for
  businesses that mix laundromat, dry cleaning, or cleaning services.
- For custom categories, try a more specific phrase, such as `public parks`
  instead of `parks`, or `self-service laundromats` instead of `cleaning`.
- Treat the demo as evidence to inspect, not as a final audited dataset.

If the heatmap is slow or unavailable:

- Wait briefly after POIs load.
- Try `Walk` first.
- Zoom in to reduce the number of visible service points.
- Continue using the POI list and markers; heatmap failure should not block
  basic exploration.

## What To Send Back As Feedback

Useful feedback includes:

- The town or neighborhood tested.
- The category selected.
- The device and browser used.
- What you expected to see.
- What MapGap actually returned.
- A screenshot if the issue is visual or map-specific.

Good example:

```text
Jersey City, NJ near Journal Square. iPhone Safari. Laundry returned several dry
cleaners and one carpet cleaner. Expected laundromats only. Screenshot attached.
```

## Current Scope

This `/v2` demo is Stage 1. It is focused on daily-life POI exploration and
optional access evidence.

The public daily-life entrypoint does not yet include:

- user accounts;
- saved projects;
- full transit routing;
- AI search or recommendation workflows.

Focused relocation and civic pilot workflows are available separately at
`/v2/relocate` and `/v2/audit`. They reuse the current deterministic profile,
candidate, CSV asset, routing, and decision-memo foundations while field
validation determines whether they should become primary product journeys.

Those are roadmap items. The current goal is to make the first public experience
clear enough that someone can open it, pan to a place, tap one obvious control,
and understand practical access within a few minutes.
